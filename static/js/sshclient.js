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
 * create_key: 主协议(1字节) + 密钥类型(1字节) + 密码长度(4字节) + 密码 + 保存路径长度(4字节) + 保存路径
 */

/**
 * 接收
 * login: 主协议(1字节) + 终端编号(1字节) + 远程主机长度(1字节) + 远程主机 + 端口(2字节) + 登陆类型(1字节) + 用户名长度(1字节) + 用户名 + 密码/密钥长度(4字节) + 密码/密钥 + row(两个字节) + col(两个字节)
 * session: 主协议(1字节) + 终端编号(1字节) + 信息长度(4字节) + 信息
 * logout: 主协议(1字节) + 终端编号(1字节)
 * create_key: 主协议(1字节) + 错误码(1字节) + 错误信息长度(4字节) + 错误信息
 */


var func = require('./functions');


function CSshClient(url) {
  this.url = url;
  this.clients = {};  // term_id: {protocol: callback, }
  this.conn = null;
}

CSshClient.prototype.init = function (connect_callback) {
  this.create_connect();
  this.connect_callback = connect_callback;
}

CSshClient.prototype.create_connect = function() {
  if (this.conn)
    delete this.conn;
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
  let packet = new func.CPacket(null, 1);
  packet.packet_uint8(func.PROTOCOL.P_EXIT);
  this.send(packet);
  delete packet;
}

CSshClient.prototype.login = function(data) {
  let host_codes = func.str2utf8(data.host);
  let user_codes = func.str2utf8(data.user);
  let pass_codes = func.str2utf8(data.pass);
  let host_len = host_codes.length;
  let user_len = user_codes.length;
  let pass_len = pass_codes.length;
  let total_len = 1 + 1 + 1 + host_len + 2 + 1 + 1 + user_len + 4 + pass_len + 2 + 2;
  let packet = new func.CPacket(null, total_len);

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
  let msg_codes = func.str2utf8(data);
  let msg_len = msg_codes.length;
  let total_len = 1 + 1 + 4 + msg_len;
  let packet = new func.CPacket(null, total_len);
  packet.packet_uint8(func.PROTOCOL.P_SESSION);
  packet.packet_uint8(term_id);
  packet.packet_uint32(msg_len);
  packet.packet_string(msg_codes, msg_len);
  this.send(packet);
  delete packet;
}

CSshClient.prototype.force_exit = function(term_id) {
  let total_len = 1 + 1;
  let packet = new func.CPacket(null, total_len);
  packet.packet_uint8(func.PROTOCOL.P_FORCE_EXIT);
  packet.packet_uint8(term_id);
  this.send(packet);
  delete packet;
  this.remove_event(term_id);
}

CSshClient.prototype.resize = function(data) {
  let total_len = 1 + 2 + 2;
  let packet = new func.CPacket(null, total_len);
  packet.packet_uint8(func.PROTOCOL.P_RESIZE);
  packet.packet_uint16(data.row);
  packet.packet_uint16(data.col);
  this.send(packet);
  delete packet;
}

CSshClient.prototype.create_key = function(pass, type, path) {
  let pass_codes = func.str2utf8(pass);
  let pass_len = pass_codes.length;
  let path_codes = func.str2utf8(path);
  let path_len = path_codes.length;
  let total_len = 1 + 1 + 4 + pass_len + 4 + path_len;
  let packet = new func.CPacket(null, total_len);
  packet.packet_uint8(func.PROTOCOL.P_CREATE_KEY);
  packet.packet_uint8(type);
  packet.packet_uint32(pass_len);
  packet.packet_string(pass_codes, pass_len);
  packet.packet_uint32(path_len);
  packet.packet_string(path_codes, path_len);
  this.send(packet);
  delete packet;
}

CSshClient.prototype.remove_event = function(term_id) {
  delete this.clients[term_id];
}

CSshClient.prototype._on_open = function () {
  this.connect_callback();
}

CSshClient.prototype._on_close = function() {
}

CSshClient.prototype._on_error = function () {
  this.create_connect();
}

CSshClient.prototype.on_message = function (data) {
  let arr_int8 = new Uint8Array(data);
  let packet = new func.CPacket(arr_int8);
  let protocol = packet.unpacket_uint8();
  let ret = {};
  if (protocol == func.PROTOCOL.P_LOGIN) {
    ret = this.rep_login_(packet);
  } else if (protocol == func.PROTOCOL.P_SESSION) {
    ret = this.rep_session_(packet);
  } else if (protocol == func.PROTOCOL.P_LOGOUT) {
    ret = this.rep_logout_(packet);
  } else if (protocol == func.PROTOCOL.P_CREATE_KEY) {
    ret = this.rep_create_key_(packet);
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

CSshClient.prototype.rep_create_key_ = function(packet) {
  let code = packet.unpacket_uint8();
  let msg_len = packet.unpacket_uint32();
  let msg = packet.unpacket_string(msg_len);
  let data = {
    term_id: 0,
    code: code,
    msg: msg
  };
  return data;
}

exports.CSshClient = CSshClient;
