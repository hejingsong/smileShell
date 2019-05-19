/**
 * 放一些通用的函数
 */

PROTOCOL = {
  P_EXIT      : 0x01,
  P_LOGIN     : 0x02,
  P_SESSION   : 0x03,
  P_LOGOUT    : 0x04,
  P_FORCE_EXIT: 0x05,
  P_RESIZE    : 0x06,
  P_CREATE_KEY: 0x07
};


TERM_ID = 1;
/**
 * 生成一个UUID
 */
function UUID() {
  return TERM_ID++;
}


function hover(ele, callback, clear_callback=null) {
  ele.addEventListener("mouseenter", (event) => {
    let timeobj = setTimeout(() => {
      callback();
    }, 500);
    ele.addEventListener('mouseleave', (event) => {
      clearTimeout(timeobj);
      clear_callback && clear_callback();
    });
  });
}


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

function remove_all_children(parent) {
  while( parent.childElementCount ) {
    parent.firstElementChild.remove();
  }
}

function on_node_press(node, box, win, evt) {
  let is_move = true;
  let x = evt.pageX - box.offsetLeft;
  let y = evt.pageY - box.offsetTop;
  node.style.cursor = 'move';
  win.onmousemove = function (evt) {
    if (is_move) {
        box.style.left = (evt.pageX - x)+"px";
        box.style.top = (evt.pageY - y)+"px";
    };
  }
  win.onmouseup = function (evt) {
    is_move = false;
    node.style.cursor = 'default';
    node.onmousemove = null;
    node.onmouseup = null;
  }
}

function show_message(status, parent, title, content, win, hide=0) {
  let box = document.createElement('div')
  let msg_box = document.createElement('div');
  let msg_header = document.createElement('div');
  let msg_title = document.createElement('span');
  let cls_btn = document.createElement('img');
  let msg_content = document.createElement('div');
  let msg_img = document.createElement('img');
  let msg_span = document.createElement('span');
  let offset_box = document.createElement('div');
  let src = status == 1 ? 'static/img/true.png' :
            status == 0 ? 'static/img/false.png' : 'static/img/warning.png';
  let color = status  == 1 ? 'white' :
              status == 0 ? 'red' : 'yellow';

  box.className = 'full-box';
  msg_box.className = 'msg-box';
  msg_header.className = 'msg-header';
  msg_title.className = 'msg-title';
  msg_title.innerHTML = title;
  msg_span.innerHTML = content;
  msg_img.src = src;
  msg_img.style.marginTop = '10px';
  msg_img.style.height = '25px';
  msg_span.style.marginLeft = '10px';
  msg_span.style.position = 'fixed';
  msg_span.style.marginTop = '14px';
  msg_span.style.color = color;
  msg_span.style.fontWeight = 'bold';
  cls_btn.className = 'cancel-btn';
  cls_btn.src = 'static/img/close.png';
  cls_btn.title = '关闭';
  msg_content.className = 'msg-content';
  offset_box.style.height = '10px';

  cls_btn.onclick = () => { box.remove(); }
  msg_header.addEventListener('mousedown', (evt) => {on_node_press(msg_header, msg_box, win, evt);});

  if (!hide) {
    msg_header.appendChild(cls_btn);
  }

  msg_header.appendChild(msg_title);
  msg_content.appendChild(msg_img);
  msg_content.appendChild(msg_span);
  msg_box.appendChild(msg_header);
  msg_box.appendChild(msg_content);
  msg_box.appendChild(offset_box);
  box.appendChild(msg_box);
  parent.appendChild(box);
  return box;
}

function create_box(parent, title, win, hide=0) {
  let box = document.createElement('div')
  let msg_box = document.createElement('div');
  let msg_header = document.createElement('div');
  let msg_title = document.createElement('span');
  let cls_btn = document.createElement('img');
  let msg_content = document.createElement('div');
  let conn_box = document.createElement('div');
  let confirm_btn = document.createElement('button');
  let cancel_btn = document.createElement('button');
  let offset_box = document.createElement('div');

  box.className = 'full-box';
  msg_box.className = 'msg-box';
  msg_header.className = 'msg-header';
  msg_title.className = 'msg-title';
  msg_title.innerHTML = title;
  cls_btn.className = 'cancel-btn';
  cls_btn.src = 'static/img/close.png';
  cls_btn.title = '关闭';
  msg_content.className = 'msg-content';
  conn_box.className = 'conn-btn';
  confirm_btn.className = 'confirm-btn';
  cancel_btn.className = 'cancel-btn';
  confirm_btn.innerHTML = '确定';
  cancel_btn.innerHTML = '取消';
  offset_box.style.height = '10px';
  if (hide) {
    cls_btn.style.display = 'none';
    cancel_btn.style.display = 'none';
  }

  cls_btn.onclick = () => { box.remove(); }
  cancel_btn.onclick = () => { box.remove(); }
  msg_header.addEventListener('mousedown', (evt) => {on_node_press(msg_header, msg_box, win, evt);});

  msg_header.appendChild(msg_title);
  msg_header.appendChild(cls_btn);
  conn_box.appendChild(confirm_btn);
  conn_box.appendChild(cancel_btn);
  msg_box.appendChild(msg_header);
  msg_box.appendChild(msg_content);
  msg_box.appendChild(conn_box);
  msg_box.appendChild(offset_box);
  box.appendChild(msg_box);
  parent.appendChild(box);
  return {
    full_box: box,
    content: msg_content,
    confirm: confirm_btn,
  }
}

function encode_data(data) {
  let len = data.length;
  let term_name_len = 0;
  let host_len = 0;
  let user_len = 0;
  let pass_len = 0;
  let name = [];
  let pass = 0;
  let info = null;
  let codes = [];
  codes.push(len >> 8 & 0x00ff);
  codes.push(len & 0x00ff);
  for(let idx in data) {
    info = data[idx];
    name = str2utf8(info.name);
    term_name_len = name.length;
    host_len = info.host.length;
    user_len = info.user.length;
    pass = str2utf8(info.pass);
    priv = str2utf8(info.priv);
    pass_len = pass.length;
    priv_len = priv.length;
    codes.push(term_name_len);
    codes = codes.concat(name);
    codes.push(host_len);
    for (let host_byte of info.host) {
      codes.push(host_byte.charCodeAt(0));
    }
    codes.push(info.port >> 8 & 0x00ff);
    codes.push(info.port & 0x00ff);
    codes.push(user_len);
    for (let user_byte of info.user) {
      codes.push(user_byte.charCodeAt(0));
    }
    codes.push(pass_len >> 24 & 0xff);
    codes.push(pass_len >> 16 & 0xff);
    codes.push(pass_len >> 8 & 0xff);
    codes.push(pass_len & 0xff);
    codes = codes.concat(pass);
    codes.push(priv_len >> 24 & 0xff);
    codes.push(priv_len >> 16 & 0xff);
    codes.push(priv_len >> 8 & 0xff);
    codes.push(priv_len & 0xff);
    codes = codes.concat(priv);
    codes.push(info.login_type);
    codes.push(info.remember);
  }
  return codes;
}

function decode_data(codes) {
  let len = codes[0] << 8 | codes[1];
  let data = [];
  let term_name_len = 0;
  let host_len = 0;
  let user_len = 0;
  let pass_len = 0;
  let priv_len = 0;
  let offset = 2;
  let term_codes = [];
  let pass_codes = [];
  let priv_codes = [];
  let term_name = '';
  let host = '';
  let port = 0;
  let user = '';
  let pass = '';
  let login_type = 0;
  let remember = 0;
  for (let i = 0; i < len; ++i) {
    host = '';
    port = 0;
    user = '';
    pass = '';
    priv = '';
    term_name = '';
    login_type = 0;
    remember = 0;
    term_codes = [];
    pass_codes = [];
    term_name_len = codes[offset];
    offset += 1;
    for (let i = 0; i < term_name_len; i++) {
      term_codes.push(codes[offset++]);
    }
    term_name = utf82str(term_codes);
    host_len = codes[offset];
    offset += 1;
    for (let i = 0; i < host_len; i++) {
      let s = String.fromCharCode(codes[offset++]);
      host += s;
    }
    port = codes[offset] << 8 | codes[offset + 1];
    offset += 2;
    user_len = codes[offset];
    offset += 1;
    for (let i = 0; i < user_len; i++) {
      let s = String.fromCharCode(codes[offset++]);
      user += s;
    }
    pass_len = codes[offset] << 24 | codes[offset+1] << 16 | codes[offset+2] << 8 | codes[offset+3];
    offset += 4;
    for (let i = 0; i < pass_len; i++) {
      pass_codes.push(codes[offset++]);
    }
    pass = utf82str(pass_codes);
    priv_len = codes[offset] << 24 | codes[offset+1] << 16 | codes[offset+2] << 8 | codes[offset+3];
    offset += 4;
    for (let i = 0; i < priv_len; i++) {
      priv_codes.push(codes[offset++]);
    }
    priv = utf82str(priv_codes);
    login_type = codes[offset];
    offset += 1;
    remember = codes[offset];
    offset += 1;
    data.push({
      name: term_name,
      host: host,
      port: port,
      user: user,
      pass: pass,
      priv: priv,
      login_type: login_type,
      remember: remember
    });
  }
  return data;
}

/**
 * 按照规则写入数据文件
 * 数据文件规则：
 * 数据个数（2字节） + 终端名字长度（1字节） + 终端名字 + 主机长度（1字节） + 主机数据 + 端口（2字节） + 用户名长度（1字节） + 用户名 + 密码长度（4字节） + 密码 + 密钥长度（4字节） + 密钥 + 登陆类型（1字节） + 是否记住密码（1字节）
 * 
 * @param {object} data 
 */
function write_data_file(data, callback) {
  let fs = require('fs');
  let path = require('path');
  let data_file = path.dirname(process.execPath) + '/data/data.db';
  let codes = encode_data(data);
  let buffer = Buffer.from(codes);
  fs.writeFile(data_file, buffer, (err) => {
    callback(err);
  });
}

/**
 * 按照规则读取数据
 */
function read_data_file(callback) {
  let fs = require('fs');
  let path = require('path');
  let data_file = path.dirname(process.execPath) + '/data/data.db';
  fs.readFile(data_file, (err, data) => {
    if (!err) {
      let infos = decode_data(data);
      callback(err, infos);
    } else {
      callback(err);
    }
  });
}

/**
 * 写入配置文件
 * @param {object} data 
 * @param {function} callback 
 * 密钥路径长度（4字节） + 密钥路径 + 下载路劲长度（4字节） + 下载路径
 */
function write_conf_file(data, callback) {
  let fs = require('fs');
  let path = require('path');
  let conf_file = path.dirname(process.execPath) + '/data/config.db';
  let private_path_codes = str2utf8(data.priv);
  let download_path_codes = str2utf8(data.down);
  let priv_len = private_path_codes.length;
  let down_len = download_path_codes.length;
  let codes = [];
  codes.push(priv_len >> 24 & 0xff);
  codes.push(priv_len >> 16 & 0xff);
  codes.push(priv_len >> 8 & 0xff);
  codes.push(priv_len & 0xff);
  codes = codes.concat(private_path_codes);
  codes.push(down_len >> 24 & 0xff);
  codes.push(down_len >> 16 & 0xff);
  codes.push(down_len >> 8 & 0xff);
  codes.push(down_len & 0xff);
  codes = codes.concat(download_path_codes);
  let buffer = Buffer.from(codes);
  fs.writeFile(conf_file, buffer, (err) => {
    callback(err);
  });
}

function read_conf_file(callback) {
  let fs = require('fs');
  let path = require('path');
  let parent_path = path.dirname(process.execPath);
  let conf_file = parent_path + '/data/config.db';

  fs.readFile(conf_file, (err, data) => {
    if (!err) {
      let offset = 0;
      let priv_codes = [];
      let down_codes = [];
      let down_len = 0;
      let priv_path = '';
      let down_path = '';
      let priv_len = data[0] << 24 | data[1] << 16 << data[2] << 8 | data[3];
      offset += 4;
      for (let i = 0; i < priv_len; ++i) {
        priv_codes.push(data[offset++]);
      }
      priv_path = utf82str(priv_codes);
      down_len = data[offset] << 24 | data[offset+1] << 16 << data[offset+2] << 8 | data[offset+3];
      offset += 4;
      for (let i = 0; i < down_len; ++i) {
        down_codes.push(data[offset++]);
      }
      down_path = utf82str(down_codes);
      callback(err, {priv: priv_path, down: down_path});
    } else {
      callback(err, {priv: parent_path+'/sshkey/', down: parent_path+'/download/'});
    }
  });
}

function deepcopy(data) {
  let ret = {};
  for (let i in data) {
    ret[i] = data[i];
  }
  return ret;
}

exports.UUID = UUID;
exports.hover = hover;
exports.PROTOCOL = PROTOCOL;
exports.str2utf8 = str2utf8;
exports.CPacket = CPacket;
exports.write_data_file = write_data_file;
exports.read_data_file = read_data_file;
exports.create_box = create_box;
exports.remove_all_children = remove_all_children;
exports.show_message = show_message;
exports.deepcopy = deepcopy;
exports.read_conf_file = read_conf_file;
exports.write_conf_file = write_conf_file;
