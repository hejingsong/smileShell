
var func = require('./functions.js');

// 为了简便，标签页也有这个类控制
function CMyTerminal(manager) {
  this.container = null;
  this.nav = null;
  this.nav_img = null;
  this.nav_cls_btn = null;
  this.terminal = null;
  this.manager = manager;
  this.term_id = func.UUID();
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
  this.terminal = term;
  this.container = container;
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
}

CMyTerminal.prototype.set_inactive = function() {
  this.container.style.zIndex = -1;
  this.nav.className = '';
  this.terminal.blur();
}

CMyTerminal.prototype.set_active = function() {
  this.container.style.zIndex = 1;
  this.nav.className = 'nav-active';
  this.terminal.focus();
}

CMyTerminal.prototype.destroy = function() {
  this.container.remove();
  this.nav.remove();
  this.terminal.destroy();
  delete this.terminal;
}

CMyTerminal.prototype.write = function(data) {
  this.terminal.write(data);
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


function CTerminalManager(logger) {
  this.logger = logger;
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


exports.CTerminalManager = CTerminalManager;
