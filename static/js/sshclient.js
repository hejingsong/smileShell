/**
 * 与后端通信的类，全局唯一
 * 采用websocket通信协议
 */

/**
 * 发送
 * exit: 主协议(1字节)
 * login: 主协议(1字节) + 终端编号(1字节) + 远程主机长度(1字节) + 远程主机 + 端口(2字节) + 登陆类型(1字节) + 用户名长度(1字节) + 用户名 + 密码/密钥长度(4字节) + 密码/密钥 + row(两个字节) + col(两个字节)
 * session: 主协议(1字节) + 终端编号(1字节) + 信息长度(4字节) + 信息
 * force_exit: 主协议(1字节) + 终端编号(1字节)
 * resize: 主协议(1字节) + row(两个字节) + col(两个字节)
 */

/**
 * 接收
 * login: 主协议(1字节) + 终端编号(1字节) + 远程主机长度(1字节) + 远程主机 + 端口(2字节) + 登陆类型(1字节) + 用户名长度(1字节) + 用户名 + 密码/密钥长度(4字节) + 密码/密钥 + row(两个字节) + col(两个字节)
 * session: 主协议(1字节) + 终端编号(1字节) + 信息长度(4字节) + 信息
 * logout: 主协议(1字节) + 终端编号(1字节)
 */


var func = require('./functions.js');

function str2utf8(str) {
  var back = [];
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (0x00 <= code && code <= 0x7f) {
      back.push(code);
    } else if (0x80 <= code && code <= 0x7ff) {
      back.push((192 | (31 & (code >> 6))));
      back.push((128 | (63 & code)))
    } else if ((0x800 <= code && code <= 0xd7ff) 
          || (0xe000 <= code && code <= 0xffff)) {
      back.push((224 | (15 & (code >> 12))));
      back.push((128 | (63 & (code >> 6))));
      back.push((128 | (63 & code)))
    }
  }
  for (i = 0; i < back.length; i++) {
    back[i] &= 0xff;
  }
  return back;
}

function initbyte(array) {
  for (var i = 0; i < array.length; i++) {
    array[i] &= 0xff;
  }
  return array;
}

function utf82str(arr) {
  var UTF = '', _arr = initbyte(arr);
  for (var i = 0; i < _arr.length; i++) {
    var one = _arr[i].toString(2),
        v = one.match(/^1+?(?=0)/);
    if (v && one.length == 8) {
      var bytesLength = v[0].length;
      var store = _arr[i].toString(2).slice(7 - bytesLength);
      for (var st = 1; st < bytesLength; st++) {
        store += _arr[st + i].toString(2).slice(2)
      }
      UTF += String.fromCharCode(parseInt(store, 2));
      i += bytesLength - 1
    } else {
      UTF += String.fromCharCode(_arr[i])
    }
  }
  return UTF
}


function CPacket(data=null, size=0) {
  this.offset = 0;
  if (!data) {
    this.buffer = Buffer.alloc(size);
  } else {
    this.buffer = data;
    this.size = data.length;
  }
}

CPacket.prototype.packet_uint8 = function (data) {
  this.buffer.writeUInt8(data, this.offset);
  this.offset += 1;
}

CPacket.prototype.packet_uint16 = function(data) {
  this.buffer.writeUInt16BE(data, this.offset);
  this.offset += 2;
}

CPacket.prototype.packet_uint32 = function(data) {
  this.buffer.writeUInt32BE(data, this.offset);
  this.offset += 4;
}

CPacket.prototype.packet_string = function(codes, len) {
  for (let i = 0; i < len; ++i) {
    this.buffer.writeUInt8(codes[i], this.offset + i);
  }
  this.offset += len;
}

CPacket.prototype.unpacket_uint8 = function() {
  this.offset += 1;
  return this.buffer[this.offset - 1];
}

CPacket.prototype.unpacket_uint16 = function() {
  this.offset += 2;
  let h = this.buffer[this.offset - 2];
  let l = this.buffer[this.offset - 1];
  return (h << 8) | l;
}

CPacket.prototype.unpacket_uint32 = function() {
  let ret = 0;

  this.offset += 4;
  ret |= this.buffer[this.offset - 4] << 24;
  ret |= this.buffer[this.offset - 3] << 16;
  ret |= this.buffer[this.offset - 2] << 8;
  ret |= this.buffer[this.offset - 1];
  return ret;
}

CPacket.prototype.unpacket_string = function(len) {
  let codes = [];
  let data = '';
  for (let i = 0; i < len; i++) {
    codes.push(this.buffer[this.offset + i]);
  }
  data = utf82str(codes);
  this.offset += len;
  return data;
}

CPacket.prototype.get_buffer = function() {
  return this.buffer;
}





function CSshClient(url, logger) {
  this.url = url;
  this.logger = logger;
  this.clients = {};  // term_id: {protocol: callback, }
  this.conn = null;
}

CSshClient.prototype.init = function () {
  this.conn = new WebSocket(this.url);
  this.conn.binaryType = 'arraybuffer';
  this.conn.onopen = () => { this._on_open(); };
  this.conn.onclose = () => { this._on_close(); };
  this.conn.onerror = () => { this._on_error(); };
  this.conn.onmessage = (event) => {
    this.on_message(event.data);
  };
}

/**
 * 注册回调函数
 */
CSshClient.prototype.reg_event = function(term_id, event_type, callback) {
  let data = this.clients[term_id];
  if (data === undefined) {
    data = this.clients[term_id] = {event_type: callback};
  }
  data[event_type] = callback;
}

CSshClient.prototype.send = function(packet) {
  this.conn.send(packet.get_buffer());
}

CSshClient.prototype.close = function() {

}

CSshClient.prototype.exit = function () {
  // 主协议(1字节)
  let packet = new CPacket(null, 1);
  packet.packet_uint8(func.PROTOCOL.P_EXIT);
  this.send(packet);
  delete packet;
}

CSshClient.prototype.login = function(data) {
  let host_codes = str2utf8(data.host);
  let user_codes = str2utf8(data.user);
  let pass_codes = str2utf8(data.pass);
  let host_len = host_codes.length;
  let user_len = user_codes.length;
  let pass_len = pass_codes.length;
  let total_len = 1 + 1 + 1 + host_len + 2 + 1 + 1 + user_len + 4 + pass_len + 2 + 2;
  let packet = new CPacket(null, total_len);

  packet.packet_uint8(func.PROTOCOL.P_LOGIN);
  packet.packet_uint8(data.term);
  packet.packet_uint8(host_len);
  packet.packet_string(host_codes, host_len);
  packet.packet_uint16(data.port);
  packet.packet_uint8(data.type);
  packet.packet_uint8(user_len);
  packet.packet_string(user_codes, user_len);
  packet.packet_uint32(pass_len);
  packet.packet_string(pass_codes, pass_len);
  packet.packet_uint16(data.row);
  packet.packet_uint16(data.col);
  this.send(packet);
  delete packet;
}

CSshClient.prototype.session = function(term_id, data) {
  let msg_codes = str2utf8(data);
  let msg_len = msg_codes.length;
  let total_len = 1 + 1 + 4 + msg_len;
  let packet = new CPacket(null, total_len);
  packet.packet_uint8(func.PROTOCOL.P_SESSION);
  packet.packet_uint8(term_id);
  packet.packet_uint32(msg_len);
  packet.packet_string(msg_codes, msg_len);
  this.send(packet);
  delete packet;
}

CSshClient.prototype.force_exit = function(term_id) {
  let total_len = 1 + 1;
  let packet = new CPacket(null, total_len);
  packet.packet_uint8(func.PROTOCOL.P_FORCE_EXIT);
  packet.packet_uint8(term_id);
  this.send(packet);
  delete packet;
}

CSshClient.prototype.resize = function(data) {
  let total_len = 1 + 2 + 2;
  let packet = new CPacket(null, total_len);
  packet.packet_uint8(func.PROTOCOL.P_RESIZE);
  packet.packet_uint16(data.row);
  packet.packet_uint16(data.col);
  this.send(packet);
  delete packet;
}

CSshClient.prototype.remove_event = function(term_id) {
  delete this.clients[term_id];
}

CSshClient.prototype._on_open = function () {
  this.logger('open success');
}

CSshClient.prototype._on_close = function() {
  this.logger('connect close');
}

CSshClient.prototype._on_error = function () {
  this.logger('ssh client error.');
}

CSshClient.prototype.on_message = function (data) {
  let arr_int8 = new Uint8Array(data);
  let packet = new CPacket(arr_int8);
  let protocol = packet.unpacket_uint8();
  let ret = {};
  if (protocol == func.PROTOCOL.P_LOGIN) {
    ret = this.rep_login_(packet);
  } else if (protocol == func.PROTOCOL.P_SESSION) {
    ret = this.rep_session_(packet);
  } else if (protocol == func.PROTOCOL.P_LOGOUT) {
    ret = this.rep_logout_(packet);
  }
  delete arr_int8;
  delete packet;
  ret.protocol = protocol;
  let events = this.clients[ret.term_id];
  if (!events) return;
  let callback = events[protocol];
  if (!callback) return;
  callback(ret);
}

CSshClient.prototype.rep_login_ = function(packet) {
  let term_id = packet.unpacket_uint8();
  let status = packet.unpacket_uint8();
  let len = packet.unpacket_uint32();
  let msg = packet.unpacket_string(len);
  let data = {
    term_id: term_id,
    status: status,
    msg: msg
  };
  return data;
}

CSshClient.prototype.rep_session_ = function(packet) {
  let term_id = packet.unpacket_uint8();
  let len = packet.unpacket_uint32();
  let msg = packet.unpacket_string(len);
  let data = {
    term_id: term_id,
    msg: msg
  }
  return data;
}

CSshClient.prototype.rep_logout_ = function(packet) {
  let term_id = packet.unpacket_uint8();
  let data = {
    term_id: term_id
  };
  return data;
}

exports.CSshClient = CSshClient;
