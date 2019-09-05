/**
 * 主入口
 */

/**
 * 全局变量定义
 */
var DEBUG = false;
var appPath = require('path');
var gui = require('nw.gui');
var g_win = gui.Window.get();
if (DEBUG)
  g_win.showDevTools();
var sshclient = require('./static/js/sshclient');
var terminal = require('./static/js/myterminal');
var func = require('./static/js/functions');

var EXEC_STRING = "/backend/webSocketServer.exe";
var URL = 'ws://127.0.0.1:12345';


function create_select_file_box( file_input ) {
  let select_input = document.createElement('input');

  select_input.style.display = 'none';
  select_input.type = 'file';
  select_input.className = 'File';
  select_input.onchange = function () {
    file_input.value = select_input.value;
    select_input.remove();
  };
  select_input.oncancel = () => {
    select_input.remove();
  }
  select_input.click();
}

function create_select_folder_box( dir_input ) {
  var select_input = document.createElement('input');

  select_input.style.display = 'none';
  select_input.nwdirectory = 'true';
  select_input.type = 'file';

  select_input.onchange = function(){
      dir_input.value = select_input.value;
      select_input.remove();
  };
  select_input.oncancel = () => {
    select_input.remove();
  };

  select_input.click();
}

function create_folder_list_box(title, confirm_callback) {
  let data = null;
  if (arguments.length == 3) {
    data = arguments[2];
  }else {
    data = {
      name: '',
      host: '',
      port: '',
      user: '',
      pass: '',
      priv: '',
      login_type: 0,
      remember: 0
    };
  }
  let content = func.create_box(document.getElementsByTagName('body')[0], title, window);
  let full_box = content.full_box;
  let box = content.content;
  let confirm = content.confirm;
  let name_box = document.createElement('div');
  let name_input = document.createElement('input');
  let host_box = document.createElement('div');
  let host_input =  document.createElement('input');
  let port_input = document.createElement('input');
  let user_box = document.createElement('div');
  let user_input = document.createElement('input');
  let login_type_box = document.createElement('div');
  let passwd_radio = document.createElement('input');
  let private_radio = document.createElement('input');
  let select_box = document.createElement('div');
  let pass_input = document.createElement('input');
  let private_input = document.createElement('input');
  let file_btn = document.createElement('button');
  let spantext1 = document.createElement('span');
  let spantext2 = document.createElement('span');
  let spantext3 = document.createElement('span');
  let remember_input = document.createElement('input');

  name_box.className = 'link-name';
  name_input.type = 'text';
  name_input.name = 'link-name';
  name_input.value = data.name;
  name_input.placeholder = '连接名';
  host_box.className = 'host-info';
  host_input.type = 'text';
  host_input.name = 'host';
  host_input.value = data.host;
  host_input.placeholder = '主机地址';
  port_input.type = 'text';
  port_input.name = 'port';
  port_input.value = data.port;
  port_input.placeholder = '端口';
  user_box.className = 'user-info';
  user_input.type = 'text';
  user_input.name = 'user';
  user_input.value = data.user;
  user_input.placeholder = '用户名';
  login_type_box.className = 'login-type';
  passwd_radio.type = 'radio';
  passwd_radio.name = 'loginType';
  private_radio.type = 'radio';
  private_radio.name = 'loginType';
  select_box.className = 'select-box';
  pass_input.type = 'password';
  pass_input.name = 'password';
  pass_input.placeholder = '密码';
  pass_input.value = data.pass;
  private_input.type = 'text';
  private_input.name = 'privateKey';
  private_input.placeholder = '密钥路径';
  private_input.readOnly = true;
  private_input.value = data.priv;
  file_btn.innerHTML = '..';
  spantext1.innerHTML = '密码登录';
  spantext2.innerHTML = '密钥登录';
  spantext3.innerHTML = '记住密码';
  spantext3.className = 'remember-text';
  remember_input.type = 'checkbox';
  remember_input.name = 'remember';
  remember_input.className = 'remember-checkbox';
  remember_input.checked = data.remember;

  passwd_radio.onchange = () => {
    func.remove_all_children(select_box);
    pass_input.value = data.pass;
    private_input.value = '';
    select_box.appendChild(pass_input);
    select_box.appendChild(spantext3);
    select_box.appendChild(remember_input);
  };

  private_radio.onchange = () => {
    func.remove_all_children(select_box);
    private_input.value = data.priv;
    pass_input.value = data.pass;
    select_box.appendChild(private_input);
    select_box.appendChild(file_btn);
    select_box.appendChild(pass_input);
    select_box.appendChild(spantext3);
    select_box.appendChild(remember_input);
  };

  file_btn.onclick = () => {
    create_select_file_box(private_input);
  };

  confirm.onclick = () => {
    let name = name_input.value.trim();
    let host = host_input.value.trim();
    let port = port_input.value.trim();
    let user = user_input.value.trim();
    let login_type = passwd_radio.checked ? 0 : 1;
    let priv = private_input.value === 'undefined' ? '' : private_input.value.trim();
    let remember = remember_input.checked ? 1 : 0;
    let pass = pass_input.value.trim();
    if (name == '' || host == '' || user == '' || port == '' || isNaN(port)) {
      func.show_message(0, document.getElementsByTagName('body')[0], '错误', '输入不合法', window);
      return;
    }
    if (login_type && priv == '') {
      func.show_message(0, document.getElementsByTagName('body')[0], '错误', '输入不合法', window);
      return;
    }
    if (remember && pass == '') {
      func.show_message(0, document.getElementsByTagName('body')[0], '错误', '输入不合法', window);
      return;
    }
    pass = remember ? pass : '';
    confirm_callback(full_box, {
      name: name,
      host: host,
      port: port,
      user: user,
      pass: pass,
      priv: priv,
      login_type: login_type,
      remember: remember
    });
  };
  name_box.appendChild(name_input);
  host_box.appendChild(host_input);
  host_box.appendChild(port_input);
  user_box.appendChild(user_input);
  login_type_box.appendChild(passwd_radio);
  login_type_box.appendChild(spantext1);
  login_type_box.appendChild(private_radio);
  login_type_box.appendChild(spantext2);
  if (data.login_type) {
    private_radio.checked = true;
    select_box.appendChild(private_input);
    select_box.appendChild(file_btn);
    select_box.appendChild(pass_input);
    select_box.appendChild(spantext3);
    select_box.appendChild(remember_input);
  } else {
    passwd_radio.checked = true;
    select_box.appendChild(pass_input);
    select_box.appendChild(spantext3);
    select_box.appendChild(remember_input);
  }

  box.appendChild(name_box);
  box.appendChild(host_box);
  box.appendChild(user_box);
  box.appendChild(login_type_box);
  box.appendChild(select_box);
}



function CWindow() {
  this.win = g_win;
  this.shell = gui.Shell;
  if (!DEBUG)
    document.oncontextmenu = function(evt) { evt.preventDefault(); };

  window.ondragover = function(e) { e.preventDefault(); return false; };
  window.ondrop = function(e) { e.preventDefault(); return false; };

  this.open_server();
  this.is_max_window = false;
  this.client = null;
  this.terminal_manager = null;
  this.data = [];
  this.conf = {priv: '', down: ''};
}

CWindow.prototype.init = function() {
  let boxes             = func.show_message(2, document.getElementsByTagName('body')[0], '连接后端', '正在连接后端...', window, 1);
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
  this.client           = new sshclient.CSshClient(URL);
  this.terminal_manager = new terminal.CTerminalManager(window, gui.Clipboard.get());
  this.client.init(() => { obj.on_connect_server(boxes); });

  app_min_btn.onclick  = () => { obj.minimize(); };
  app_max_btn.onclick  = () => { obj.maximize(); };
  app_cls_btn.onclick  = () => { obj.close_window(); };
  app_conn_btn.onclick = () => { obj.quick_connect(); };
  app_fold_btn.onclick = () => { obj.folder(); };
  app_set_btn.onclick  = () => { obj.setting(); };
  app_key_btn.onclick  = () => { obj.create_key(); };
  window.onresize      = () => { obj.on_resize() };
  for (let btn of box_cls_btns) {
    btn.onclick = f;
  }

  func.hover(app_menu_btn, () => { this.open_menu(app_menu_box); }, () => { this.close_menu(app_menu_box); } );

  if (DEBUG) {
    app_reload_btn.onclick = () => { obj.reload(); };
  } else {
    app_reload_btn.style.display = 'none';
  }
  func.read_data_file((err, data) => { if (!err && data) { this.data = data;} });
  func.read_conf_file((err, data) => { this.conf = data; });
  this.client.reg_event(0, func.PROTOCOL.P_CREATE_KEY, (data) => { this.rep_create_key(data); });
}

CWindow.prototype.on_connect_server = function(box) {
  box.remove();
}

CWindow.prototype.on_resize = function() {
  let data = this.terminal_manager.resize();
  if (!data) return;
  this.client.resize(data);
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
  func.write_data_file(this.data, (err) => {
    func.write_conf_file(this.conf, (err) => {
      this.win.close();
    });
  });
}

CWindow.prototype.open_menu = function(menu_box) {
  menu_box.style.transform = "translateX(-6px)";
}

CWindow.prototype.close_menu = function (menu_box) {
  menu_box.style.transform = "translateX(66px)";
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
  let confirm_btn = document.getElementsByClassName('confirm-btn')[0];
  let title = document.getElementsByClassName('msg-title')[0];
  let host_box = document.createElement('div');
  let host_input = document.createElement('input');
  let port_input = document.createElement('input');
  let user_box = document.createElement('div');
  let user_input = document.createElement('input');
  let pass_input = document.createElement('input');

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
      login_type: 0,
      user: user_input.value,
      pass: pass_input.value,
      remember: 1,
      name: host_input.value
    });
    obj.close_box();
  };
  full_box.style.display = 'block';
}

CWindow.prototype.folder = function () {
  let folder_btn = document.createElement('div');
  let folder_ul = document.createElement('ul');
  let add_btn = document.createElement('img');
  let mod_btn = document.createElement('img');
  let del_btn = document.createElement('img');
  let full_box = document.getElementsByClassName('full-box')[0];
  let box = document.getElementsByClassName('msg-content')[0];
  let confirm_btn = document.getElementsByClassName('confirm-btn')[0];
  let title = document.getElementsByClassName('msg-title')[0];

  folder_btn.className = 'folder-content-btn';
  folder_ul.id = 'folder-list';
  add_btn.src = 'static/img/add.png';
  add_btn.title = '新建';
  mod_btn.src = 'static/img/modify.png';
  mod_btn.title = '修改';
  del_btn.src = 'static/img/close.png';
  del_btn.title = '删除';
  title.innerHTML = '连接列表';

  add_btn.onclick = () => { this.open_add_node_box(); };
  mod_btn.onclick = () => { this.open_mod_node_box(); };
  del_btn.onclick = () => { this.del_node(); };
  confirm_btn.onclick = () => {
    let node = document.getElementById('currentNode');
    if (node) {
      this.require_login(node.data);
    }
    this.close_box();
  };

  folder_btn.appendChild(add_btn);
  folder_btn.appendChild(mod_btn);
  folder_btn.appendChild(del_btn);

  for (let data of this.data) {
    this.add_node(folder_ul, data);
  }

  box.appendChild(folder_btn);
  box.appendChild(folder_ul);

  full_box.style.display = 'block';
}

CWindow.prototype.click_node = function(node) {
  let cur_node = document.getElementById('currentNode');
  if (cur_node) cur_node.id = '';
  node.id = 'currentNode';
}

CWindow.prototype.dblclick_node = function(node) {
  this.require_login(node.data);
}

CWindow.prototype.add_node = function(parent, data) {
  let li = document.createElement('li');
  li.innerHTML = data.name;
  li.data = data;

  li.onclick = () => { this.click_node(li); };
  li.ondblclick = () => { this.dblclick_node(li); };

  parent.appendChild(li);
}

CWindow.prototype.open_add_node_box = function() {
  create_folder_list_box('新建节点', (box, data) => {
    let parent = document.getElementById('folder-list');
    this.data.push(data);
    this.add_node(parent, data);
    box.remove();
  });
}

CWindow.prototype.open_mod_node_box = function() {
  let cur_node = document.getElementById('currentNode');
  if (!cur_node) return;
  create_folder_list_box('修改节点', (box, data) => {
    cur_node.innerHTML = data.name;
    let idx = this.data.indexOf(cur_node.data);
    this.data.splice(idx, 1, data);
    cur_node.data = data;
    box.remove();
  }, cur_node.data);
}

CWindow.prototype.del_node = function() {
  let cur_node = document.getElementById('currentNode');
  if (!cur_node) return;
  this.data.pop(cur_node.data);
  cur_node.remove();
}

CWindow.prototype.setting = function () {
  let boxes = func.create_box(document.getElementsByTagName('body')[0], '设置', window);
  let full_box = boxes.full_box;
  let confirm = boxes.confirm;
  let content = boxes.content;
  let private_input = document.createElement('input');
  let private_btn = document.createElement('button');
  let download_input = document.createElement('input');
  let download_btn = document.createElement('button');

  private_input.type = 'text';
  private_input.name = 'privateKeyPath';
  private_input.placeholder = 'sshKey存储路径(./sshKey/)';
  private_input.disabled = "true";
  download_input.type = 'text';
  download_input.name = 'downloadPath';
  download_input.placeholder = '下载路径(./download/)';
  download_input.disabled = "true";
  private_btn.innerHTML = '..';
  private_btn.className = 'select-btn';
  download_btn.innerHTML = '..';
  download_btn.className = 'select-btn';
  private_input.value = this.conf.priv;
  download_input.value = this.conf.down;

  content.appendChild(private_input);
  content.appendChild(private_btn);
  content.appendChild(download_input);
  content.appendChild(download_btn);

  private_btn.onclick = () => { create_select_folder_box(private_input); };
  download_btn.onclick = () => { create_select_folder_box(download_input); };
  confirm.onclick = () => {
    let private_path = private_input.value.trim();
    let download_path = download_input.value.trim();
    this.conf.priv = private_path;
    this.conf.down = download_path;
    full_box.remove();
  };
}

CWindow.prototype.create_key = function () {
  let boxes = func.create_box(document.getElementsByTagName('body')[0], '创建密钥', window);
  let full_box = boxes.full_box;
  let confirm = boxes.confirm;
  let content = boxes.content;
  let key_box = document.createElement('div');
  let key_input = document.createElement('select');
  let dsa_opt = document.createElement('option');
  let rsa_opt = document.createElement('option');
  let pass_input = document.createElement('input');

  key_box.className = 'keyTypeBox';
  key_box.innerHTML = '密钥类型';
  key_input.className = 'keyType';
  rsa_opt.value = '0';
  rsa_opt.innerHTML = 'RSA';
  dsa_opt.value = '1';
  dsa_opt.innerHTML = 'DSA';
  pass_input.type = 'password';
  pass_input.name = 'keyPassword';
  pass_input.placeholder = '密钥密码';

  key_input.appendChild(rsa_opt);
  key_input.appendChild(dsa_opt);
  key_box.appendChild(key_input);
  content.appendChild(key_box);
  content.appendChild(pass_input);

  confirm.onclick = () => {
    let pass = pass_input.value.trim();
    let type = key_input.value;
    this.client.create_key(pass, type, this.conf.priv);
    full_box.remove();
  };
}

CWindow.prototype.require_login = function(data) {
  data = func.deepcopy(data);
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
    data.name,
    (term, data) => { obj.on_key_press(term, data); },
    (term) => { obj.force_close_terminal(term); }
  );
  term.setOption('cursorStyle', 'underline');
  this.client.reg_event(term_id, func.PROTOCOL.P_LOGIN, (data) => { obj.rep_login(data); });
  this.client.reg_event(term_id, func.PROTOCOL.P_SESSION, (data) => { obj.rep_session(data); });
  this.client.reg_event(term_id, func.PROTOCOL.P_LOGOUT, (data) => { obj.rep_logout(data); });
  data.term = term_id;
  data.row = term.rows;
  data.col = term.cols;
  if (!data.remember) {
    this.require_password((passwd) => {
      data.pass = passwd;
      this.client.login(data);
    });
  } else {
    this.client.login(data);
  }
}

CWindow.prototype.require_password = function(callback) {
  let boxes = func.create_box(document.getElementsByTagName('body')[0], '输入密码', window, 1);
  let box = boxes.full_box;
  let content = boxes.content;
  let confirm = boxes.confirm;
  let pass_box = document.createElement('div');
  let pass_input = document.createElement('input');

  pass_box.className = 'host-info';
  pass_input.type = 'password';
  pass_input.name = 'password';
  pass_input.placeholder = '密码';

  pass_box.appendChild(pass_input);
  content.appendChild(pass_box);

  confirm.onclick = () => {
    let pass = pass_input.value.trim();
    if (pass == '') {
      func.show_message(0, document.getElementsByTagName('body')[0], '错误', '密码不能为空', window);
      return;
    }
    callback(pass);
    box.remove();
  }
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

CWindow.prototype.rep_create_key = function(data) {
  if (data.code) {
    func.show_message(1, document.getElementsByTagName('body')[0], '创建密钥', '创建密钥成功', window);
  } else {
    func.show_message(0, document.getElementsByTagName('body')[0], '创建密钥', data.msg, window);
  }
}

CWindow.prototype.close_box = function() {
  let content = document.getElementsByClassName('msg-content')[0];
  let box = document.getElementsByClassName('full-box')[0];
  box.style.display = 'none';

  for (; content.childElementCount; ) {
    content.firstElementChild.remove();
  }
  this.terminal_manager.focus();
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
