/**
 * 主入口
 */

/**
 * 全局变量定义
 */
var DEBUG = true;
var appPath = require('path');
var gui = require('nw.gui');
var g_win = gui.Window.get();
g_win.showDevTools();
var sshclient = require('./static/js/sshclient.js');
var terminal = require('./static/js/myterminal.js');
var func = require('./static/js/functions.js');

var EXEC_STRING = "/backend/webSocketServer.exe";
var URL = 'ws://127.0.0.1:12345';



function CWindow() {
  this.win = g_win;
  this.shell = gui.Shell;
  if (DEBUG) {
    this.win.showDevTools();
  }
  this.open_server();
  this.is_max_window = false;
  this.client = null;
  this.terminal_manager = null;
}

CWindow.prototype.init = function() {
  let obj               = this;
  let f                 = () => {obj.close_box();};
  let app_min_btn       = document.getElementsByClassName('app-min')[0];
  let app_max_btn       = document.getElementsByClassName('app-max')[0];
  let app_cls_btn       = document.getElementsByClassName('app-close')[0];
  let app_menu_btn      = document.getElementsByClassName('show-btn')[0];
  let app_menu_box      = document.getElementsByClassName('right-nav')[0];
  let box_cls_btns      = document.getElementsByClassName('cancel-btn');
  let app_conn_btn      = document.getElementById('conn');
  let app_fold_btn      = document.getElementById('folder');
  let app_set_btn       = document.getElementById('setting');
  let app_key_btn       = document.getElementById('key');
  let app_reload_btn    = document.getElementById('reload');
  this.client           = new sshclient.CSshClient(URL, console.log);
  this.terminal_manager = new terminal.CTerminalManager(console.log);
  this.client.init();

  app_min_btn.onclick  = () => { obj.minimize(); };
  app_max_btn.onclick  = () => { obj.maximize(); };
  app_cls_btn.onclick  = () => { obj.close_window(); };
  app_conn_btn.onclick = () => { obj.quick_connect(); };
  app_fold_btn.onclick = () => { obj.folder(); };
  app_set_btn.onclick  = () => { obj.setting(); };
  app_key_btn.onclick  = () => { obj.create_key(); };
  for (let btn of box_cls_btns) {
    btn.onclick = f;
  }
  
  window.onresize      = () => { obj.on_resize() };
  func.hover(app_menu_btn, () => { this.open_menu(app_menu_box); }, () => { this.close_menu(app_menu_box); } );

  if (DEBUG) {
    app_reload_btn.onclick = () => { obj.reload(); };
  } else {
    app_reload_btn.style.display = 'none';
  }
}

CWindow.prototype.on_resize = function() {

}

CWindow.prototype.minimize = function() {
  this.win.minimize();
}

CWindow.prototype.maximize = function () {
  this.is_max_window ? this.win.unmaximize() : this.win.maximize();
  this.is_max_window = !this.is_max_window;
}

CWindow.prototype.close_window = function () {
  this.win.hide();
  this.client.exit();
  this.win.close();
}

CWindow.prototype.open_menu = function(menu_box) {
  menu_box.style.transform = "translateX(0px)";
}

CWindow.prototype.close_menu = function (menu_box) {
  menu_box.style.transform = "translateX(60px)";
}

CWindow.prototype.open_server = function () {
  if (!DEBUG) {
    let baseDir = appPath.dirname(process.execPath);
    this.shell.openItem(baseDir + EXEC_STRING);
  }
}

CWindow.prototype.quick_connect = function () {
  let obj = this;
  let full_box = document.getElementsByClassName('full-box')[0];
  let box = document.getElementsByClassName('msg-content')[0];
  let host_box = document.createElement('div');
  let host_input = document.createElement('input');
  let port_input = document.createElement('input');
  let user_box = document.createElement('div');
  let user_input = document.createElement('input');
  let pass_input = document.createElement('input');
  let confirm_btn = document.getElementsByClassName('confirm-btn')[0];
  let title = document.getElementsByClassName('msg-title')[0];

  host_box.className = 'host-info';
  user_box.className = 'user-info';
  host_input.type = 'text';
  port_input.type = 'text';
  user_input.type = 'text';
  pass_input.type = 'password';
  host_input.name = 'host';
  port_input.name = 'port';
  user_input.name = 'user';
  pass_input.name = 'password';
  host_input.placeholder = '主机地址';
  port_input.placeholder = 'Ssh端口';
  user_input.placeholder = '用户名';
  pass_input.placeholder = '密码';
  title.innerHTML = '快速连接';
  host_box.appendChild(host_input);
  host_box.appendChild(port_input);
  user_box.appendChild(user_input);
  user_box.appendChild(pass_input);
  box.appendChild(host_box);
  box.appendChild(user_box);

  confirm_btn.onclick = () => {
    obj.require_login({
      host: host_input.value,
      port: parseInt(port_input.value, 10),
      type: 0,
      user: user_input.value,
      pass: pass_input.value,
    });
    obj.close_box();
  };
  full_box.style.display = 'block';
}

CWindow.prototype.folder = function () {

}

CWindow.prototype.setting = function () {

}

CWindow.prototype.create_key = function () {

}

CWindow.prototype.require_login = function(data) {
  let obj = this;
  let term = new Terminal({
    scrollback: 1024,
    cursorBlink: 5,
    tabStopWidth: 4,
  });
  let term_id = this.terminal_manager.new_terminal(
    term,
    document.getElementById('term-box'),
    document.getElementsByClassName('conn-nav')[0],
    data.host,
    (term, data) => { obj.on_key_press(term, data); },
    (term) => { obj.force_close_terminal(term); }
  );
  this.client.reg_event(term_id, func.PROTOCOL.P_LOGIN, (data) => { obj.rep_login(data); });
  this.client.reg_event(term_id, func.PROTOCOL.P_SESSION, (data) => { obj.rep_session(data); });
  this.client.reg_event(term_id, func.PROTOCOL.P_LOGOUT, (data) => { obj.rep_logout(data); });
  data.term = term_id;
  data.row = term.rows;
  data.col = term.cols;
  this.client.login(data);
}

CWindow.prototype.on_key_press = function(term, data) {
  this.client.session(term.get_id(), data);
}

CWindow.prototype.force_close_terminal = function(term) {
  this.client.force_exit(term.get_id());
}

CWindow.prototype.rep_login = function(data) {
  let term = this.terminal_manager.get_terminal(data.term_id);
  if (!term) return;
  term.on_login_response(data.status, data.msg);
}

CWindow.prototype.rep_session = function(data) {
  let term = this.terminal_manager.get_terminal(data.term_id);
  if (!term) return;
  term.write(data.msg);
}

CWindow.prototype.rep_logout = function(data) {
  this.terminal_manager.remove_terminal(data.term_id);
  this.client.remove_event(data.term_id);
}

CWindow.prototype.close_box = function() {
  let content = document.getElementsByClassName('msg-content')[0];
  let box = document.getElementsByClassName('full-box')[0];
  box.style.display = 'none';

  for (; content.childElementCount; ) {
    content.firstElementChild.remove();
  }
}

CWindow.prototype.reload = function () {
  this.client.exit();
  this.win.reload();
}




function main() {
  let window = new CWindow();
  window.init();
}


window.onload = () => {
  main();
};
