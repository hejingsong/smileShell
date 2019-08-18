
var func = require('./functions');

// 为了简便，标签页也有这个类控制
function CMyTerminal(manager) {
  this.container = null;
  this.nav_container = null;
  this.nav = null;
  this.nav_img = null;
  this.nav_cls_btn = null;
  this.terminal = null;
  this.terminal_parent = null;
  this.manager = manager;
  this.clipboard_event = document.createEvent("HTMLEvents");
  this.clipboard_event.clipboardData = this.manager.clipboard;
  this.term_id = func.UUID();
  this.move = false;
}

CMyTerminal.prototype.create = function(term, parent, on_key_event) {
  let self = this;
  let container = document.createElement('div');
  container.className = 'term';
  container.id = 't' + (this.term_id).toString();
  container.style.zIndex = 1;
  parent.appendChild(container);
  term.open(container);
  term.fit();
  term.on('data', function (data) {
    on_key_event(self, data);
  });
  this.on_key_event = on_key_event;
  this.terminal = term;
  this.terminal_parent = parent;
  this.container = container;
  if (this.manager.get_terminal_num() == 0) {
    this.container.style.background = '#000';
  }
  this.container.onmouseup = (evt) => { this.copy_handler(evt); };
  this.container.onmousedown = (evt) => { this.paste_handler(evt) };
}

CMyTerminal.prototype.copy_handler = function(evt) {
  if ( evt.button != 0 ) {
    return false;
  }
  this.clipboard_event.initEvent("copy", false, false);
  this.terminal.element.dispatchEvent(this.clipboard_event);
}

CMyTerminal.prototype.paste_handler = function(evt) {
  if ( evt.button != 2 )
    return false;
  this.clipboard_event.initEvent("paste", false, false);
  this.terminal.element.dispatchEvent(this.clipboard_event);
}

CMyTerminal.prototype.create_nav = function(parent, title, force_exit_func) {
  let nav = document.createElement('div');
  let img = document.createElement('img');
  let span = document.createElement('span');
  let cls_img = document.createElement('img');

  nav.className = 'nav-active';
  img.src = 'static/img/load.png';
  img.className = 'load';
  span.innerHTML = title;
  span.style.padding = '0px 5px';
  cls_img.className = 'nav-close';
  cls_img.src = 'static/img/close.png';
  cls_img.title = '关闭';

  nav.onclick = () => {
    this.manager.active_terminal(this.term_id);
  }

  nav.ondblclick = () => {
    this.manager.copy_terminal(this.term_id);
  }

  cls_img.onclick = () => {
    force_exit_func(this);
    this.manager.remove_terminal(this.get_id());
  }

  nav.appendChild(img);
  nav.appendChild(span);
  nav.appendChild(cls_img);
  parent.appendChild(nav);

  this.nav = nav;
  this.nav_img = img;
  this.nav_cls_btn = cls_img;
  this.nav_container = parent;
  if (this.manager.get_terminal_num() == 0) {
    this.nav_container.style.display = 'block';
  }
}

CMyTerminal.prototype.set_inactive = function() {
  this.container.style.zIndex = -1;
  this.nav.className = '';
  this.terminal.blur();
}

CMyTerminal.prototype.set_active = function() {
  this.container.style.zIndex = 1;
  this.nav.className = 'nav-active';
  this.nav_img.src = 'static/img/true.png';
  this.terminal.focus();
}

CMyTerminal.prototype.destroy = function() {
  this.container.remove();
  this.nav.remove();
  this.terminal.destroy();
  delete this.terminal;
  if (this.manager.get_terminal_num() == 1) {
    this.nav_container.style.display = 'none';
    this.container.style.background = '';
  }
}

CMyTerminal.prototype.write = function(data) {
  this.terminal.write(data);
  if (this.nav.className === '') {
    this.nav_img.src = 'static/img/warning.png';
  }
}

CMyTerminal.prototype.get_id = function() {
  return this.term_id;
}

CMyTerminal.prototype.on_login_response = function(status, msg) {
  this.nav_img.className = '';
  if (status) {
    this.nav_img.src = 'static/img/true.png';
  }else {
    this.nav_img.src = 'static/img/false.png';
    this.terminal.write('***** \033[40;36m'+msg+'\033[0m *****\r\n');
  }
}

CMyTerminal.prototype.resize = function() {
  this.terminal.fit();
}

CMyTerminal.prototype.get_size = function() {
  return {
    row: this.terminal.rows,
    col: this.terminal.cols,
  }
}

CMyTerminal.prototype.focus = function() {
  this.terminal.focus();
}


function CTerminalManager(win, clipboard) {
  this.win = win;
  this.clipboard = clipboard;

  this.clipboard.setData = (type, text) => {
    this.clipboard.set(text, 'text');
  }

  this.clipboard.getData = (type) => {
    return this.clipboard.get('text');
  }

  this.active_term_id = 0;
  this.terminals = {};
}

CTerminalManager.prototype.new_terminal = function(term, terminal_parent, nav_parent, title, on_key_press, force_close_func) {
  let terminal = new CMyTerminal(this);
  let term_id = terminal.get_id();

  for(let t_id in this.terminals) {
    this.terminals[t_id].set_inactive();
  }

  terminal.create(term, terminal_parent, on_key_press);
  terminal.create_nav(nav_parent, title, force_close_func);
  this.terminals[term_id] = terminal;
  this.active_term_id = term_id;
  return term_id;
}

CTerminalManager.prototype.active_terminal = function(term_id) {
  let term = this.get_terminal(term_id);
  if (!term) return;
  let cur_active_term = this.get_terminal(this.active_term_id);
  if (cur_active_term)
    cur_active_term.set_inactive();
  term.set_active();
  this.active_term_id = term_id;
}

CTerminalManager.prototype.get_terminal = function(term_id) {
  return this.terminals[term_id];
}

CTerminalManager.prototype.remove_terminal = function(term_id) {
  let term = this.terminals[term_id];
  if (!term) return;
  term.destroy();
  delete this.terminals[term_id];
  // 如果当前使用的没有被关闭
  term = this.terminals[this.active_term_id];
  if (term) return;
  let t_id = null;
  for(;;) {
    for (t_id in this.terminals) {
      break;
    }
    if (!t_id) return;
    term = this.get_terminal(t_id);
    if (!term) {
      delete this.terminals[t_id];
      t_id = null;
      continue;
    }
    term.set_active();
    this.active_term_id = t_id;
    return;
  }
}

CTerminalManager.prototype.get_terminal_num = function() {
  return Object.keys(this.terminals).length;
}

CTerminalManager.prototype.resize = function() {
  let term_id = -1;
  for (term_id in this.terminals) {
    this.terminals[term_id].resize();
  }
  if (term_id == -1) return null;
  return this.terminals[term_id].get_size();
}

CTerminalManager.prototype.focus = function() {
  let term = this.terminals[this.active_term_id];
  if (!term) return;
  term.focus();
}

CTerminalManager.prototype.copy_terminal = function(term_id) {

}


exports.CTerminalManager = CTerminalManager;
