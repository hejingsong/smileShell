/**
 * script.js
 * Author: Hejs
 * Email:  240197153@qq.com
 */
var gui, win, shell, clipboard, appPath, fs, os = null;
var localUrl = 'ws://127.0.0.1:12345';
var isMaxScreen = false;    // 判断是否是最大化
var wsc = null;             // WebsocketClient的实例化
var folderList = null;      // 连接列表实例
var try_conn = 0;           // 尝试连接后端WebSocketServer次数
var max_try = 10;           // 最大尝试连接次数
var dataDir = '';           // 保存用户数据文件夹
var dataFile = '';          // 用户保存的数据
var confDir = '';           // 用户配置文件夹
var confFile = '';          // 用户配置文件名
var user_conf = {           // 
    'down_dir': '',
    'key_dir' : ''
};
// var down_dir = '';          // 下载文件保存路径
// var key_dir = '';           // sshKey保存路径


/**
*  Base64 encode / decode
*
*  @author haitao.tu
*  @date   2010-04-26
*  @email  tuhaitao@foxmail.com
*
*/
function Base64() {
 
    // private property
    _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
 
    // public method for encoding
    this.encode = function (input) {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;
        input = _utf8_encode(input);
        while (i < input.length) {
            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);
            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;
            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }
            output = output +
            _keyStr.charAt(enc1) + _keyStr.charAt(enc2) +
            _keyStr.charAt(enc3) + _keyStr.charAt(enc4);
        }
        return output;
    }
 
    // public method for decoding
    this.decode = function (input) {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        while (i < input.length) {
            enc1 = _keyStr.indexOf(input.charAt(i++));
            enc2 = _keyStr.indexOf(input.charAt(i++));
            enc3 = _keyStr.indexOf(input.charAt(i++));
            enc4 = _keyStr.indexOf(input.charAt(i++));
            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;
            output = output + String.fromCharCode(chr1);
            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }
        }
        output = _utf8_decode(output);
        return output;
    }
 
    // private method for UTF-8 encoding
    _utf8_encode = function (string) {
        string = string.replace(/\r\n/g,"\n");
        var utftext = "";
        for (var n = 0; n < string.length; n++) {
            var c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            } else if((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            } else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
 
        }
        return utftext;
    }
 
    // private method for UTF-8 decoding
    _utf8_decode = function (utftext) {
        var string = "";
        var i = 0;
        var c = c1 = c2 = 0;
        while ( i < utftext.length ) {
            c = utftext.charCodeAt(i);
            if (c < 128) {
                string += String.fromCharCode(c);
                i++;
            } else if((c > 191) && (c < 224)) {
                c2 = utftext.charCodeAt(i+1);
                string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            } else {
                c2 = utftext.charCodeAt(i+1);
                c3 = utftext.charCodeAt(i+2);
                string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
        }
        return string;
    }
}

/**
 * [init 初始化环境]
 */
function init() {
    gui = require('nw.gui');
    fs = require('fs');
    os = require('os');
    win = gui.Window.get();
    shell = gui.Shell;
    clipboard = gui.Clipboard.get();

    // 菜单事件绑定
    var $app_menu_btn = document.getElementsByClassName('show-btn')[0];
    var $app_min_btn = document.getElementsByClassName('app-min')[0];
    var $app_max_btn = document.getElementsByClassName('app-max')[0];
    var $app_cls_btn = document.getElementsByClassName('app-close')[0];
    var $app_conn_btn = document.getElementById('conn');
    var $app_fold_btn = document.getElementById('folder');
    var $app_set_btn = document.getElementById('setting');
    var $app_key_btn = document.getElementById('key');
    var $app_reload_btn = document.getElementById('reload');

    $app_menu_btn.onclick = showMenu;

    $app_min_btn.onclick = on_app_min;
    $app_max_btn.onclick = on_app_max;
    $app_cls_btn.onclick = on_app_close;

    $app_conn_btn.onclick = on_click_conn;
    $app_fold_btn.onclick = on_click_fold;
    $app_set_btn.onclick = on_click_set;
    $app_key_btn.onclick = on_click_key;
    $app_reload_btn.onclick = on_click_reload;

    // 取消原始右键菜单
    document.oncontextmenu = function($event) { $event.preventDefault(); };

    // debug
    baseDir = process.cwd(); // 开发环境使用这个
    win.showDevTools();
    // debug end

    // production
    // appPath = require('path');
    // baseDir = appPath.dirname(process.execPath);     // 正式场景使用这个
    // $app_reload_btn.style.display = 'none';     // 正式场景不显示
    // production end

    // 启动WebSocketServer
    shell.openItem(baseDir+'/backend/webSocketServer.exe');
    var $homes = os.homedir().split('\\');
    var $currentUser = $homes[ $homes.length - 1 ];
    dataDir = baseDir+'/data';
    dataFile = dataDir+'/'+$currentUser+'.dat';
    confDir = baseDir + '/conf';
    confFile = confDir + '/' + $currentUser + '.conf';
    createDataFolder();
    folderList = new Folder;
    folderList.readUserData();

    connectBackend();
}

function on_resize($event) {
    if ( wsc == null ) {
        return;
    }
    for( var $i = 0; $i < wsc.clients.length; $i++ ) {
        wsc.clients[$i].terminal.fit();
    }
}

/**
 * [on_copy_handle 复制事件]
 * @param  {[object]} $event [鼠标事件]
 * 当鼠标左键弹起的时候, 复制选中内容。
 */
function on_copy_handle($event) {
    if ( $event.button != 0 ) {
        return false;
    }
    var copiedText = window.getSelection().toString()
        , text = prepareTextForClipboard(copiedText);
    if ( text == '' ) { return false; }
    clipboard.set(text, 'text');
    $event.preventDefault();
}

/**
 * [on_paste_handle 黏贴事件]
 * @param  {[object]} $event [鼠标事件]
 * 当鼠标右键按下的时候, 黏贴黏贴板的内容
 */
function on_paste_handle($event, $sshclient) {
    if ( $event.button != 2 ) {
        return;
    }
    $event.stopPropagation();
    var text = clipboard.get('text');

    if ( text == '' ) { return false; }
    $sshclient.on_key_event(text);
}

/**
 * [WebSocketClient 客户端所有的ssh都由这个类来发送和接受消息]
 */
function WebSocketClient() {
    this.clients = new Array();
    this.conn = new WebSocket(localUrl);
    this.conn.onopen = this.on_open;
    this.conn.onclose = this.on_close;
    this.conn.onerror = this.on_error;
    this.conn.onmessage = this.on_message;
}

WebSocketClient.prototype.addClient = function (obj) {
    return this.clients.push(obj);
}

WebSocketClient.prototype.delClient = function (obj) {
    var $i = 0;
    for ( $i = 0; $i < this.clients.length; $i++ ) {
        if ( this.clients[$i] == obj ) {
            break;
        }
    }
    if ( this.clients[$i] == obj ) {
        this.clients.splice($i, 1);
    }
    return $i;
}

WebSocketClient.prototype.findClient = function( $id ) {
    var $i = 0;
    for ( $i = 0; $i < this.clients.length; $i++ ) {
        if ( this.clients[$i].id == $id ) {
            break;
        }
    }
    if ( $i == this.clients.length ) {
        return null;
    }
    return this.clients[$i];
}

/**
 * [write 写消息]
 * @param  {[string]} msg [发送的内容]
 */
WebSocketClient.prototype.write = function (msg) {
    this.conn.send(msg);
}

/**
 * [on_open 成功连接时触发的事件]
 */
WebSocketClient.prototype.on_open = function() {
    folderList.getFolderList();
}

/**
 * [on_close 关闭时触发的事件]
 */
WebSocketClient.prototype.on_close = function() {
}

/**
 * [on_error 发生错误时触发的事件]
 */
WebSocketClient.prototype.on_error = function() {
    wsc = null;
    if ( try_conn++ < max_try ) {
        connectBackend()
    }else {
        showMessage('连接服务器失败。请手动启动WebSocketServer');
    }
}

/**
 * [on_message 有消息可读时触发的事件]
 * @return {[string]} [读取的数据]
 */
WebSocketClient.prototype.on_message = function($event) {
    var $data = $event.data;
    var $data_json = JSON.parse($data);
    if ( $data_json == null ) return;
    var $response = $data_json['response'];
    var $response_data = $data_json['data'];

    if ( $response == 'login' ) {
        wsc.login($response_data);
    } else if ( $response == 'data' ) {
        wsc.session($response_data);
    } else if ( $response == 'key' ) {
        showMessage($response_data['msg']);
    } else if ( $response == 'FolderList' ) {
        wsc.getFolderList($response_data);
    } else if ( $response == 'upload' ) {
        createUpDownMessage( $response_data );
    } else if ( $response == 'download' ) {
        createUpDownMessage( $response_data );
    }
}

WebSocketClient.prototype.login = function( $data ) {
    var $sshclient = wsc.findClient($data['id']);
    if ( !$sshclient ) { return; }
    if ( !$data['status'] ) {
        showMessage($data['data']);
        $sshclient.logout();
    }else {
        $sshclient.successLogin();
    }
}

WebSocketClient.prototype.session = function( $data ) {
    var $sshclient = wsc.findClient($data['id']);
    if ( !$sshclient ) { return; }
    if ( $data['data'] == 'logout' ) {
        $sshclient.logout();
    }else 
        $sshclient.write($data['data']);
}

WebSocketClient.prototype.getFolderList = function ( $data ) {
    if ( $data ) {
        folderList.list = $data;
    }
}

/* 不再使用
WebSocketClient.prototype.getConfig = function ( $data ) {
    down_dir = $data['down_dir'];
    key_dir = $data['key_dir'];
}*/

/**
 * [Ssh 用于读取用户输入和WebSocketClient传来的数据]
 */
function Ssh($ipaddr, $port, $user, $pass, $priKey, $loginType) {
    this.id = null;
    this.terminal = null;
    this.navElement = null;
    this.termElement = null;
    this.logined = 0;       // 登录状态 0 - 未登录 1 - 已登录 2 - 重新登录
    this.command_prompt = '';   // 提示字符串
    this.ipaddr = $ipaddr;
    this.port = $port;
    this.user = $user;
    this.pass = $pass;
    this.privateKey = $priKey;
    this.loginType = $loginType;
}

/**
 * [makeId 制作唯一的ID, 用于前后端通信]
 * @return {[string]} [唯一的ID]
 */
Ssh.prototype.makeId = function () {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

/**
 * [create 创建ssh客户端]
 */
Ssh.prototype.create = function ($nodeName) {
    var $termbox = document.getElementById('term-box');
    var $connNav = document.getElementsByClassName('conn-nav')[0];
    var $body = document.getElementsByTagName('body')[0];
    if ( $termbox.children.length == 0 ) {
        $body.style.backgroundColor = '#000';
        $connNav.style.display = 'block';

    }

    wsc.addClient(this);

    this.id = this.makeId();
    this.createNav($nodeName);
    this.createTerm();
    this.login();
}

/**
 * [createNav 创建标签栏标签]
 * @param  {[string]} $nodeName [节点名称]
 */
Ssh.prototype.createNav = function ( $nodeName ) {
    var $obj = this;
    var $nav = document.createElement('div');
    var $img = document.createElement('img');
    var $navtext = document.createElement('span');
    var $cloimg = document.createElement('img');
    var $navs = document.getElementsByClassName('conn-nav')[0];

    $navtext.innerHTML = $nodeName; $navtext.style.padding = '0px 5px';
    $cloimg.className = 'nav-close'; $cloimg.src = 'static/img/close.png'; $cloimg.title = '关闭';

    $nav.appendChild($img); $nav.appendChild($navtext); $nav.appendChild($cloimg);
    $navs.appendChild($nav);

    this.navElement = {'nav': $nav, 'img': $img, 'closeimg': $cloimg};

    $cloimg.onclick = function() { $obj.destroy(); };
    $navtext.onclick =  function() { $obj.focus(); };
}

/**
 * [createTerm 创建终端]
 */
Ssh.prototype.createTerm = function () {
    var $term = this;
    var $termbox = document.getElementById('term-box');
    var $ssh = this;
    var $terms = document.getElementsByClassName('term');
    this.termElement = document.createElement('div');
    this.termElement.className = 'term';
    this.termElement.id = this.id;

    $termbox.appendChild(this.termElement);

    this.terminal = new Terminal({
        cols: 121,
        cursorBlink: 5,
        scrollback: 1024,
        tabStopWidth: 4
    });

    this.terminal.open(this.termElement);
    this.terminal.fit();

    for ( var $i = 0; $i < $terms.length; $i++ ) {
        $terms[$i].style.zIndex = -1;
    }
    this.termElement.style.zIndex = 1;

    this.termElement.onclick = hideMenu;
    this.termElement.onmouseup = on_copy_handle;
    this.termElement.onmousedown = function($event) {on_paste_handle($event, $term) };
    this.terminal.on('data', function($data) { $ssh.on_key_event($data); });
    this.terminal.on('resize', function(){ $ssh.on_resize(); });
}

/**
 * [login 向后端发送登录信息]
 */
Ssh.prototype.login = function () {
    var $login_json = {
        'request': 'login',
        'data': {
            'id': this.id,
            'host': this.ipaddr,
            'port': this.port,
            'user': this.user,
            'pass': this.pass,
            'key': this.privateKey,
            'rows': this.terminal.rows,
            'cols': this.terminal.cols,
            'loginType': this.loginType
        }
    };
    this.navElement.img.src = 'static/img/load.png';
    this.navElement.img.className = 'load';
    var $login_str = JSON.stringify($login_json);
    wsc.write($login_str);
}

Ssh.prototype.logout = function() {
    this.navElement.img.src = 'static/img/false.png';
    this.navElement.img.className = '';
    this.logined = 2;   // 重新登录状态
    this.command_prompt = '';
    this.write('***** \033[40;36mPress Enter to login again :)\033[0m *****\r\n');
}

Ssh.prototype.successLogin = function() {
    this.navElement.img.src = 'static/img/true.png';
    this.navElement.img.className = '';
    this.logined = 1;   // 已登录状态
}

/**
 * [focus 将鼠标控制在此终端]
 */
Ssh.prototype.focus = function () {
    var $currentNav = document.getElementById('current-nav');
    var $terms = document.getElementsByClassName('term');
    if ( $currentNav ) {
        $currentNav.id = '';
    }
    hideMenu();
    this.terminal.focus();
    this.navElement.nav.id = 'current-nav';
    for ( var $i = 0; $i < $terms.length; $i++ ) {
        $terms[$i].style.zIndex = -1;
    }
    this.termElement.style.zIndex = 1;
}

/**
 * [write 向终端中写入数据, 不发送给ssh服务器]
 * @param  {[string]} msg [写入的内容]
 */
Ssh.prototype.write = function (msg) {
    this.terminal.write(msg);
}

/**
 * [destroy 销毁客户端]
 */
Ssh.prototype.destroy = function () {
    var $id = 0;
    this.termElement.remove();
    this.navElement.nav.remove();
    this.terminal.destroy();
    $id = wsc.delClient(this);
    if ( wsc.clients.length == 0 ) {
        var $body = document.getElementsByTagName('body')[0];
        $body.style.backgroundColor = '#444';
        return;
    }
    if ( $id == wsc.clients.length ) {
        wsc.clients[ $id-1 ].focus();
    }else {
        wsc.clients[ $id ].focus();
    }
}

/**
 * [on_key_event xterm终端键盘响应事件]
 * @param  {[string]} $data [键盘按下的字符]
 */
Ssh.prototype.on_key_event = function ($data) {
    var $ssh = this;
    if ( this.logined == 0 ) return;    // 如果时为登录状态就直接返回

    // 重新登录状态 并且 按下回车
    if ( this.logined == 2 && $data == '\r') {
        this.login();
        this.logined = 0;
        return;
    }

    // 如果提示符为空, 表示刚开始登录, 获取登录提示符
    
    if ( this.command_prompt == '' ) {
        var $cursor = document.getElementsByClassName('terminal-cursor')[ wsc.clients.indexOf(this) ];
        this.command_prompt = prepareTextForClipboard($cursor.parentElement.textContent);
    }

    if ( $data == '\r' ) {
        var $cursor = document.getElementsByClassName('terminal-cursor')[ wsc.clients.indexOf(this) ];
        var $command = prepareTextForClipboard($cursor.parentElement.textContent);
        var $input = trim( $command.replace( this.command_prompt, '') );
        var $commandList = $input.split(' ');
        var $c = $commandList[0];
        $commandList.splice(0, 1);
        var $file = findStr($commandList);
        if ( $c == 'rz' ) {
            var $fileInput = createUploadFileBox();
            $fileInput.onchange = function() { $ssh.on_upload_file( this.value ); this.remove(); }
            $fileInput.oncancel = function() { $ssh.on_key_event( '\x15\r' ); this.remove(); }
            this.write('\r\n');
            return false;
        }else if ( $c == 'sz' ) {
            if ( $file == undefined ) {
                $ssh.on_key_event( '\x15\r' );
            }else
                this.on_download_file( $file );
            this.write('\r\n');
            return false;
        }
    }

    var $data_json = {
        'request': 'data',
        'data': {
            'id': this.id,
            'data': $data
        }
    };
    $data_str = JSON.stringify($data_json);
    wsc.write($data_str);
}

Ssh.prototype.on_resize = function() {
    var $data_json = {
        'request': 'resize',
        'data': {
            'id': this.id,
            'cols': this.terminal.cols,
            'rows': this.terminal.rows
        }
    };
    var $data_str = JSON.stringify($data_json);
    wsc.write($data_str);
}

/**
 * [on_upload_file 上传文件事件]
 * @param  {[string]} $filename [文件名]
 */
Ssh.prototype.on_upload_file = function($filename) {
    var $data_json = {
        'request': 'upload',
        'data': {
            'id': this.id,
            'data': ($filename == undefined)? '': $filename.replace(/\\/g, '/')
        }
    };
    $data_str = JSON.stringify($data_json);
    wsc.write($data_str);
}

/**
 * [on_download_file 下载文件事件]
 * @param  {[string]} $filename [文件名]
 * @return {[type]} [description]
 */
Ssh.prototype.on_download_file = function($filename) {
    var $data_json = {
        'request': 'download',
        'data': {
            'id': this.id,
            'path': (user_conf['down_dir'] == '')? '../download': user_conf['down_dir'],
            'data': ($filename == undefined)? '': $filename
        }
    };
    $data_str = JSON.stringify($data_json);
    wsc.write($data_str);
}

/**
 * [Folder Folder类 存放连接列表 列表的增删改查操作]
 */
function Folder() {
    this.list = new Array();   // 存放所有的连接列表
}

/**
 * [getFolderList 获取连接列表]
 * 在成功连接后端服务器时 被调用
 */
Folder.prototype.getFolderList = function () {

}

/**
 * [addNode 添加连接节点]
 * @param {[int]} $type     [0: 手动添加。1: 自动添加]
 * @param {[object]} $nodeInfo [节点信息]
 */
Folder.prototype.addNode = function ( $type, $nodeInfo ) {
    if ( $type == 0 ) {
        var $item = this.getNode($nodeInfo['nodeName']);
        if ( $item ) {
            showMessage('节点名称已经存在。');
            return false;
        }
        this.list.push($nodeInfo);
    }

    var $ul = document.getElementById('folder-list');
    var $li = document.createElement('li');
    var $curNode = document.getElementById('currentNode');

    $li.innerHTML = $nodeInfo['nodeName'];
    $ul.appendChild($li);

    $li.onclick = function () {
        var $curNode = document.getElementById('currentNode');
        if ($curNode) $curNode.id = '';
        this.id = 'currentNode';
    }
    $li.ondblclick = function () {
        if ( $nodeInfo['remember'] ) {
            createSshClient( $nodeInfo );
        }else {
            var $pass_object = {};
            createPasswdBox($pass_object);
            $pass_object.logBtn.onclick = function () {
                $nodeInfo['passwd'] = $pass_object.passwdInput.value;
                createSshClient( $nodeInfo );
                $pass_object.fullbox.remove();
            }
        }
    };
}

/**
 * [delNode 删除连接节点]
 */
Folder.prototype.delNode = function ( $nodeName ) {
    var $i = 0;
    for ( $i = 0; $i < this.list.length; $i++ ) {
        if ( this.list[$i]['nodeName'] == $nodeName ) {
            break;
        }
    }
    if ( $i < this.list.length ) {
        this.list.splice($i, 1);
    }else {
        return null;
    }
}

/**
 * [modNode 修改连接节点]
 */
Folder.prototype.modNode = function ( $nodeInfo ) {
    var $item = this.getNode( $nodeInfo['nodeName'] );
    if ( !$item ) return false;
    $item['ipaddr'] = $nodeInfo['ipaddr'];
    $item['port'] = $nodeInfo['port'];
    $item['user'] = $nodeInfo['user'];
    $item['passwd'] = $nodeInfo['passwd'];
    $item['loginType'] = $nodeInfo['loginType'];
    $item['privateKeyPath'] = $nodeInfo['privateKeyPath'];
    $item['remember'] = $nodeInfo['remember'];
}

/**
 * [getNode 获取节点信息]
 */
Folder.prototype.getNode = function ( $nodeName ) {
    var $i = 0;
    for ( $i = 0; $i < this.list.length; $i++ ) {
        if ( this.list[$i]['nodeName'] == $nodeName ) {
            break;
        }
    }
    if ( $i < this.list.length ) {
        return this.list[$i];
    }else {
        return null;
    }
}

/**
 * [saveUserData 保存用户的数据]
 */
Folder.prototype.saveUserData = function () {
    var $clearText = '';
    var $encryp_str = '';
    var $encryp = new Base64();
    var $conf_str = '';  

    for ( var $i = 0; $i < this.list.length; ++$i ) {
        var $write_str = JSON.stringify( this.list[$i] );
        $clearText += $write_str+'\n';
    }
    $encryp_str = $encryp.encode( $clearText );

    $conf_str = 'down_dir=' + user_conf['down_dir'] + '\n' + 'key_dir=' + user_conf['key_dir'];

    fs.open(dataFile, 'w', 0644, function (err, fp) {
        if (err) showMessage(err);
        else {
            fs.write(fp, $encryp_str, function(err){
                if (err) showMessage('写入文件失败.'); 
            });
        }
    });

    fs.open(confFile, 'w', 0644, function (err, fp) {
        if (err) showMessage(err);
        else {
            fs.write(fp, $conf_str, function(err){
                if (err) showMessage('写入文件失败.'); 
            });
        }
    });
}

/**
 * [readUserData 读取用户的数据]
 */
Folder.prototype.readUserData = function () {
    var $folder = this;
    var $clearText = '';
    var $encryp_str = '';
    var $dataList = undefined;
    var $encryp = new Base64();

    fs.readFile(dataFile, function (err, data) {
        if ( err ) return;
        $encryp_str = data.toString();
        $clearText = $encryp.decode( $encryp_str );
        $dataList = $clearText.split('\n');
        for ( var $i = 0; $i < $dataList.length; ++$i ) {
            $folder.list.push( JSON.parse( $dataList[$i] ) );
        }
    });

    fs.readFile(confFile, function (err, data) {
        if ( err ) return;
        var $confData = data.toString();
        $dataList = $confData.split('\n');
        for ( var $i = 0; $i < $dataList.length; ++$i ) {
            var $kv = $dataList[$i].split('=');
            user_conf[ trim( $kv[0] ) ] = trim( $kv[1] );
        }
    });
}

/**
 * [hideMenu 隐藏菜单]
 */
function hideMenu() {
    var $showBtn = document.getElementsByClassName('show-btn')[0];
    var $rightBox = document.getElementsByClassName('right-nav')[0];
    $showBtn.style.transform = "translateX(0px)";
    $showBtn.id = '';
    $rightBox.style.transform = "translateX(60px)";
}

/**
 * [showList 显示和关闭菜单]
 */
function showMenu() {
    var $showBtn = document.getElementsByClassName('show-btn')[0];
    var $rightBox = document.getElementsByClassName('right-nav')[0];

    if ( $showBtn.id == '' ) {
        $showBtn.style.transform = "translateX(-50px)";
        $showBtn.id = 'up';
        $rightBox.style.transform = "translateX(0px)";
    }else {
        hideMenu();
    }
}

/**
 * [createKey 创建ssh密钥]
 * @param  {[type]} $key_type [密钥类型RSA|DSA]
 * @param  {[type]} $passwd   [密钥密码]
 */
function createKey($key_type, $passwd) {
    if ( wsc == null ) return;
    var $data_json = {
        'request': 'createKey',
        'data': {
            'type': $key_type,
            'path': (user_conf['key_dir'] == '')? '../sshkey': user_conf['key_dir'],
            'passwd': $passwd
        }
    };
    var $data_str = JSON.stringify($data_json);
    wsc.write($data_str);
}

/**
 * [config 配置文件的下载地址和ssh密钥存放地址]
 * @param  {[type]} $sshKeyPath   [ssh存放地址]
 * @param  {[type]} $downloadPath [文件下载地址]
 */
function config( $sshKeyPath, $downloadPath ) {
    if ( wsc == null ) return;
    // 现在已经不用向后台发送配置命令
    // var $data_json = {
    //     'request': 'config',
    //     'data': {
    //         'sshKeyPath': $sshKeyPath,
    //         'downloadPath': $downloadPath
    //     }
    // };
    // var $data_str = JSON.stringify($data_json);
    // wsc.write( $data_str );

    user_conf['down_dir'] = $downloadPath;
    user_conf['key_dir'] = $sshKeyPath;
}

function createUploadFileBox() {
    var $selectInput = document.createElement('input');

    $selectInput.style.display = 'none';
    $selectInput.type = 'file';
    $selectInput.className = 'File';

    $selectInput.click();
    return $selectInput;
}

/**
 * [createSelectFileBox 创建文件选择窗口]
 * @param  {[type]} $fileInput [文件地址显示框]
 */
function createSelectFileBox( $fileInput ) {
    var $selectInput = document.createElement('input');

    $selectInput.style.display = 'none';
    $selectInput.type = 'file';
    $selectInput.className = 'File';
    $selectInput.onchange = function () {
        $fileInput.value = $selectInput.value;
        $selectInput.remove();
    };

    $selectInput.click();
}

/**
 * [createSelectFolderBox 创建选择文件夹窗口]
 * @param  {[type]} $dirInput [文件夹地址显示框]
 */
function createSelectFolderBox( $dirInput ) {
    var $selectInput = document.createElement('input');

    $selectInput.style.display = 'none';
    $selectInput.nwdirectory = 'true';
    $selectInput.type = 'file';

    $selectInput.onchange = function(){
        $dirInput.value = $selectInput.value;
        $selectInput.remove();
    };

    $selectInput.click();
}

/**
 * [createAddNodeBox 创建创建节点的窗口]
 */
function createAddNodeBox() {
    var $box_object = {};
    var $linkName = document.createElement('div');
    var $linkNameInput = document.createElement('input');
    var $hostInfo = document.createElement('div');
    var $hostInput =  document.createElement('input');
    var $portInput = document.createElement('input');
    var $userInfo = document.createElement('div');
    var $userInput = document.createElement('input');
    var $loginTypeBox = document.createElement('div');
    var $passwdRadio = document.createElement('input');
    var $privateRadio = document.createElement('input');
    var $selectBox = document.createElement('div');
    var $passwdInput = document.createElement('input');
    var $privateInput = document.createElement('input');
    var $fileBtn = document.createElement('button');
    var $btnBox = document.createElement('div');
    var $addBtn = document.createElement('button');
    var $cancelBtn = document.createElement('button');
    var $spantext1 = document.createElement('span');
    var $spantext2 = document.createElement('span');
    var $spantext3 = document.createElement('span');
    var $rememberInput = document.createElement('input');

    createMessageBox($box_object);

    $box_object.header.innerHTML = '新建节点';
    $linkName.className = 'link-name';
    $linkNameInput.type = 'text'; $linkNameInput.name = 'link-name'; $linkNameInput.placeholder = '连接名';
    $hostInfo.className = 'host-info';
    $hostInput.type = 'text'; $hostInput.name = 'host'; $hostInput.placeholder = '主机地址';
    $portInput.type = 'text'; $portInput.name = 'port'; $portInput.placeholder = '主机端口';
    $userInfo.className = 'user-info';
    $userInput.type = 'text'; $userInput.name = 'user'; $userInput.placeholder = '用户名';
    $loginTypeBox.className = 'login-type';
    $passwdRadio.type = 'radio'; $passwdRadio.name = 'loginType'; $passwdRadio.value = '0'; $passwdRadio.checked = 'true';
    $privateRadio.type = 'radio'; $privateRadio.name = 'loginType'; $privateRadio.value = '1';
    $selectBox.className = 'select-box';
    $passwdInput.type = 'password'; $passwdInput.name = 'password'; $passwdInput.placeholder = '密码';
    $privateInput.type = 'text'; $privateInput.name = 'privateKey'; $privateInput.placeholder = '密钥路径'; $privateInput.disabled = 'true';
    $fileBtn.innerHTML = '..';
    $btnBox.className = 'new-btn';
    $addBtn.innerHTML = '新建';
    $cancelBtn.innerHTML = '取消';
    $spantext1.innerHTML = '密码登录';
    $spantext2.innerHTML = '密钥登录';
    $spantext3.innerHTML = '记住密码'; $spantext3.className = 'remember-text';
    $rememberInput.type = 'checkbox'; $rememberInput.name = 'remember'; $rememberInput.className = 'remember-checkbox'; $rememberInput.value = '1';

    $linkName.appendChild($linkNameInput);
    $hostInfo.appendChild($hostInput); $hostInfo.appendChild($portInput);
    $userInfo.appendChild($userInput);
    $loginTypeBox.appendChild($passwdRadio); $loginTypeBox.appendChild($spantext1);
    $loginTypeBox.appendChild($privateRadio); $loginTypeBox.appendChild($spantext2);
    $selectBox.appendChild($passwdInput); $selectBox.appendChild($spantext3); $selectBox.appendChild($rememberInput);
    $btnBox.appendChild($addBtn); $btnBox.appendChild($cancelBtn);
    $box_object.content.appendChild( $linkName );
    $box_object.content.appendChild( $hostInfo );
    $box_object.content.appendChild( $userInfo );
    $box_object.content.appendChild( $loginTypeBox );
    $box_object.content.appendChild( $selectBox );
    $box_object.content.appendChild( $btnBox );

    // 事件绑定
    $passwdRadio.onchange = function() {
        removeAll($selectBox);
        $selectBox.appendChild($passwdInput);
        $selectBox.appendChild($spantext3);
        $selectBox.appendChild($rememberInput);
    }
    $privateRadio.onchange = function () {
        removeAll($selectBox);
        $selectBox.appendChild($privateInput);
        $selectBox.appendChild($fileBtn);
        $selectBox.appendChild($passwdInput);
        $selectBox.appendChild($spantext3);
        $selectBox.appendChild($rememberInput);
    }
    $addBtn.onclick = function () {
        var $nodeInfo = {
            'nodeName': $linkNameInput.value,
            'ipaddr': $hostInput.value,
            'port': $portInput.value,
            'user': $userInput.value,
            'passwd': $passwdInput.value,
            'loginType': ($passwdRadio.checked)? 0: 1,
            'privateKeyPath': $privateInput.value,
            'remember': $rememberInput.checked
        };
        folderList.addNode( 0, $nodeInfo );
        $box_object.fullBox.remove();
    };
    $fileBtn.onclick = function () { createSelectFileBox( $privateInput ); };
    $cancelBtn.onclick = function() { $box_object.fullBox.remove(); }
}

/**
 * [createModNodeBox 创建修改节点的窗口]
 */
function createModNodeBox() {
    var $curNode = document.getElementById('currentNode');
    if ( !$curNode ) {
        showMessage('没有选中节点');
        return false;
    }
    var $nodeName = $curNode.innerHTML;
    var $item = folderList.getNode($nodeName);
    if ( !$item ) {
        showMessage('该节点不存在。');
        return false;
    }

    var $box_object = {};
    var $linkName = document.createElement('div');
    var $linkNameInput = document.createElement('input');
    var $hostInfo = document.createElement('div');
    var $hostInput =  document.createElement('input');
    var $portInput = document.createElement('input');
    var $userInfo = document.createElement('div');
    var $userInput = document.createElement('input');
    var $loginTypeBox = document.createElement('div');
    var $passwdRadio = document.createElement('input');
    var $privateRadio = document.createElement('input');
    var $selectBox = document.createElement('div');
    var $passwdInput = document.createElement('input');
    var $privateInput = document.createElement('input');
    var $fileBtn = document.createElement('button');
    var $btnBox = document.createElement('div');
    var $modBtn = document.createElement('button');
    var $cancelBtn = document.createElement('button');
    var $spantext1 = document.createElement('span');
    var $spantext2 = document.createElement('span');
    var $spantext3 = document.createElement('span');
    var $rememberInput = document.createElement('input');

    createMessageBox($box_object);

    $box_object.header.innerHTML = '修改节点';
    $linkName.className = 'link-name';
    $linkNameInput.type = 'text'; $linkNameInput.name = 'link-name'; $linkNameInput.placeholder = '连接名';
    $hostInfo.className = 'host-info';
    $hostInput.type = 'text'; $hostInput.name = 'host'; $hostInput.placeholder = '主机地址';
    $portInput.type = 'text'; $portInput.name = 'port'; $portInput.placeholder = '主机端口';
    $userInfo.className = 'user-info';
    $userInput.type = 'text'; $userInput.name = 'user'; $userInput.placeholder = '用户名';
    $loginTypeBox.className = 'login-type';
    $passwdRadio.type = 'radio'; $passwdRadio.name = 'loginType'; $passwdRadio.value = '0'; $passwdRadio.checked = 'true';
    $privateRadio.type = 'radio'; $privateRadio.name = 'loginType'; $privateRadio.value = '1';
    $selectBox.className = 'select-box';
    $passwdInput.type = 'password'; $passwdInput.name = 'password'; $passwdInput.placeholder = '密码';
    $privateInput.type = 'text'; $privateInput.name = 'privateKey'; $privateInput.placeholder = '密钥路径'; $privateInput.disabled = 'true';
    $fileBtn.innerHTML = '..';
    $btnBox.className = 'new-btn';
    $modBtn.innerHTML = '修改';
    $cancelBtn.innerHTML = '取消';
    $spantext1.innerHTML = '密码登录';
    $spantext2.innerHTML = '密钥登录';
    $spantext3.innerHTML = '记住密码'; $spantext3.className = 'remember-text';
    $rememberInput.type = 'checkbox'; $rememberInput.name = 'remember'; $rememberInput.className = 'remember-checkbox'; $rememberInput.value = '1';

    // 填充数值
    $linkNameInput.value = $item['nodeName'];
    $hostInput.value = $item['ipaddr'];
    $portInput.value = $item['port'];
    $userInput.value = $item['user'];
    $passwdInput.value = $item['passwd'];
    $privateInput.value = $item['privateKeyPath'];
    $rememberInput.checked = $item['remember'];

    if ( $item['loginType'] == 0 ){
        $passwdRadio.checked = 'true';
        $selectBox.appendChild($passwdInput);
    }
    else{
        $privateRadio.checked = 'true';
        $selectBox.appendChild($privateInput);
        $selectBox.appendChild($fileBtn);
        $selectBox.appendChild($passwdInput);
    }
    $selectBox.appendChild($spantext3);
    $selectBox.appendChild($rememberInput);

    $linkName.appendChild($linkNameInput);
    $hostInfo.appendChild($hostInput); $hostInfo.appendChild($portInput);
    $userInfo.appendChild($userInput);
    $loginTypeBox.appendChild($passwdRadio); $loginTypeBox.appendChild($spantext1);
    $loginTypeBox.appendChild($privateRadio); $loginTypeBox.appendChild($spantext2);
    $btnBox.appendChild($modBtn); $btnBox.appendChild($cancelBtn);
    $box_object.content.appendChild( $linkName );
    $box_object.content.appendChild( $hostInfo );
    $box_object.content.appendChild( $userInfo );
    $box_object.content.appendChild( $loginTypeBox );
    $box_object.content.appendChild( $selectBox );
    $box_object.content.appendChild( $btnBox );

    // 事件绑定
    $passwdRadio.onchange = function() {
        removeAll($selectBox);
        $selectBox.appendChild($passwdInput);
        $selectBox.appendChild($spantext3);
        $selectBox.appendChild($rememberInput);
    }
    $privateRadio.onchange = function () {
        removeAll($selectBox);
        $selectBox.appendChild($privateInput);
        $selectBox.appendChild($fileBtn);
        $selectBox.appendChild($passwdInput);
        $selectBox.appendChild($spantext3);
        $selectBox.appendChild($rememberInput);
    }
    $modBtn.onclick = function () {
        var $nodeInfo = {
            'nodeName': $linkNameInput.value,
            'ipaddr': $hostInput.value,
            'port': $portInput.value,
            'user': $userInput.value,
            'passwd': $passwdInput.value,
            'loginType': ($passwdRadio.checked)? 0: 1,
            'privateKeyPath': $privateInput.value,
            'remember': $rememberInput.checked
        };
        folderList.modNode( $nodeInfo );
        $box_object.fullBox.remove();
    };
    $fileBtn.onclick = function () { createSelectFileBox( $privateInput ); };
    $cancelBtn.onclick = function() { $box_object.fullBox.remove(); }
}

/**
 * [createDelNodeBox 创建删除节点窗口]
 */
function createDelNodeBox() {
    var $curNode = document.getElementById('currentNode');
    if ( !$curNode ) {
        showMessage('没有选中节点');
        return false;
    }
    var $nodeName = $curNode.innerHTML;
    folderList.delNode( $nodeName );
    $curNode.remove();
}

/**
 * [on_app_min 程序最小化]
 */
function on_app_min() {
    win.minimize();
}

/**
 * [on_app_max 程序最大化]
 */
function on_app_max() {
    if (isMaxScreen){
        win.unmaximize();
        isMaxScreen = false;
    }else{
        win.maximize();
        isMaxScreen = true;
    }
}

/**
 * [on_app_close 关闭程序]
 */
function on_app_close() {
    // 先隐藏
    win.hide();
    // 做一些善后处理
    // 1. 保存用户数据
    folderList.saveUserData();
    // 2. 向服务端发退出请求
    var $data_json = {
        'request': 'app_close',
        'data': {}
    };
    var $data_str = JSON.stringify($data_json);
    wsc.write( $data_str );
    // 关闭窗口
    win.close();
}

/**
 * [on_click_conn 点击快速连接按钮时执行的事件]
 */
function on_click_conn() {
    var $box_object = {};
    var $hostInfoBox = document.createElement('div');
    var $userInfoBox = document.createElement('div');
    var $hostInput = document.createElement('input');
    var $portInput = document.createElement('input');
    var $userInput = document.createElement('input');
    var $passInput = document.createElement('input');
    var $connBtn = document.createElement('div');
    var $trueBtn = document.createElement('button');
    var $falseBtn = document.createElement('button');

    createMessageBox($box_object);

    $hostInfoBox.className = 'host-info';
    $userInfoBox.className = 'user-info';
    $hostInput.type = 'text'; $hostInput.name = 'host'; $hostInput.placeholder = '主机地址';
    $portInput.type = 'text'; $portInput.name = 'port'; $portInput.placeholder = 'Ssh端口';
    $userInput.type = 'text'; $userInput.name = 'user'; $userInput.placeholder = '用户名';
    $passInput.type = 'password'; $passInput.name = 'password'; $passInput.placeholder = '密码';
    $connBtn.className = 'conn-btn';
    $trueBtn.innerHTML = '确定';
    $falseBtn.innerHTML = '取消';

    $box_object.header.innerHTML = '快速连接';
    $hostInfoBox.appendChild($hostInput); $hostInfoBox.appendChild($portInput);
    $userInfoBox.appendChild($userInput); $userInfoBox.appendChild($passInput);
    $connBtn.appendChild($trueBtn); $connBtn.appendChild($falseBtn);
    $box_object.content.appendChild($hostInfoBox); $box_object.content.appendChild($userInfoBox); $box_object.content.appendChild($connBtn);

    $trueBtn.onclick = function () {
        createSshClient({
            nodeName        : $hostInput.value,
            ipaddr          : $hostInput.value,
            port            : $portInput.value,
            user            : $userInput.value,
            passwd          : $passInput.value,
            privateKeyPath  : '',
            loginType       : 0
        });
        $box_object.fullBox.remove();
    };
    $falseBtn.onclick = function() { $box_object.fullBox.remove(); };
}

/**
 * [on_click_conn 点击文件夹按钮时执行的事件]
 */
function on_click_fold() {
    var $box_object = {};
    var $folderBtn = document.createElement('div');
    var $folderUl = document.createElement('ul');
    var $addBtn = document.createElement('img');
    var $modBtn = document.createElement('img');
    var $delBtn = document.createElement('img');

    createMessageBox($box_object);

    $box_object.header.innerHTML = '连接列表';
    $box_object.content.className = 'folder-content';
    $folderBtn.className = 'folder-content-btn';
    $folderUl.id = 'folder-list';
    $addBtn.src = 'static/img/add.png'; $addBtn.title = '新建';
    $modBtn.src = 'static/img/modify.png'; $modBtn.title = '修改';
    $delBtn.src = 'static/img/close.png'; $delBtn.title = '删除';

    $folderBtn.appendChild($addBtn);
    $folderBtn.appendChild($modBtn);
    $folderBtn.appendChild($delBtn);
    $box_object.content.appendChild($folderBtn);
    $box_object.content.appendChild($folderUl);

    for ( var $i = 0; $i < $folderUl.children.length; $i++ ) {
        $folderUl.children[$i].remove();
    }
    for( $i = 0; $i < folderList.list.length; $i++ ) {
        folderList.addNode( 1, folderList.list[$i] );
    }

    $addBtn.onclick = createAddNodeBox;
    $modBtn.onclick = createModNodeBox;
    $delBtn.onclick = createDelNodeBox;
}

/**
 * [on_click_conn 点击设置按钮时执行的事件]
 */
function on_click_set() {
    $box_object = {};

    var $privateKeyInput = document.createElement('input');
    var $selectBtn = document.createElement('button');
    var $downLoadInput = document.createElement('input');
    var $selectBtn1 = document.createElement('button');
    var $settingBtn = document.createElement('div');
    var $trueBtn = document.createElement('button');
    var $falseBtn = document.createElement('button');    

    createMessageBox($box_object);

    $box_object.header.innerHTML = '设置';
    $privateKeyInput.type = 'text'; $privateKeyInput.name = 'privateKeyPath'; $privateKeyInput.placeholder = 'sshKey存储路径(./sshKey/)'; $privateKeyInput.disabled = "true";
    $downLoadInput.type = 'text'; $downLoadInput.name = 'downloadPath'; $downLoadInput.placeholder = '下载路径(./download/)'; $downLoadInput.disabled = "true";
    $selectBtn.innerHTML = '..'; $selectBtn.className = 'select-btn';
    $selectBtn1.innerHTML = '..'; $selectBtn1.className = 'select-btn';
    $settingBtn.className = 'setting-btn';
    $trueBtn.innerHTML = '确定'; 
    $falseBtn.innerHTML = '取消';
 
    // 填充数据
    $privateKeyInput.value = user_conf['key_dir'];
    $downLoadInput.value = user_conf['down_dir'];

    $settingBtn.appendChild($trueBtn); $settingBtn.appendChild($falseBtn);
    $box_object.content.appendChild($privateKeyInput);
    $box_object.content.appendChild($selectBtn);
    $box_object.content.appendChild($downLoadInput);
    $box_object.content.appendChild($selectBtn1);
    $box_object.content.appendChild($settingBtn);


    $selectBtn.onclick = function(){ createSelectFolderBox( $privateKeyInput ); };
    $selectBtn1.onclick = function(){ createSelectFolderBox( $downLoadInput ); };
    $trueBtn.onclick = function() {
        config( $privateKeyInput.value, $downLoadInput.value );
        $box_object.fullBox.remove();
    };
    $falseBtn.onclick = function() { $box_object.fullBox.remove(); };
}

/**
 * [on_click_conn 点击密钥按钮时执行的事件]
 */
function on_click_key() {
    $box_object = {};
    var $keyTypeBox = document.createElement('div');
    var $keyTypeInput = document.createElement('select');
    var $dsaOpt = document.createElement('option');
    var $rsaOpt = document.createElement('option');
    var $keypassInput = document.createElement('input');
    var $privateBtn = document.createElement('div');
    var $trueBtn = document.createElement('button');
    var $falseBtn = document.createElement('button');
    createMessageBox($box_object);

    $keyTypeBox.className = 'keyTypeBox'; $keyTypeBox.innerHTML = '密钥类型';
    $keyTypeInput.className = 'keyType';
    $rsaOpt.value = '0'; $rsaOpt.innerHTML = 'RSA';
    $dsaOpt.value = '1'; $dsaOpt.innerHTML = 'DSA';
    $keypassInput.type = 'password'; $keypassInput.name = 'keyPassword'; $keypassInput.placeholder = '密钥密码';
    $privateBtn.className = 'private-btn';
    $trueBtn.innerHTML = '确定';
    $falseBtn.innerHTML = '取消';
    $box_object.header.innerHTML = '生成密钥';

    $privateBtn.appendChild($trueBtn); $privateBtn.appendChild($falseBtn);
    $keyTypeInput.appendChild($rsaOpt); $keyTypeInput.appendChild($dsaOpt);
    $keyTypeBox.appendChild($keyTypeInput);
    $box_object.content.appendChild($keyTypeBox);
    $box_object.content.appendChild($keypassInput);
    $box_object.content.appendChild($privateBtn);

    $trueBtn.onclick = function() {
        createKey($keyTypeInput.value, $keypassInput.value);
        $box_object.fullBox.remove();
    }
    $falseBtn.onclick = function() { $box_object.fullBox.remove(); };
}

/**
 * [on_click_conn 点击重新加载按钮时执行的事件]
 */
function on_click_reload() {
    win.reload();
}

/**
 * 链接后端服务器, 尝试链接十次, 如果十次都失败, 表示websocketserver启动缓慢, 或者启动失败. 提示手动启动WebSocketServer
 */
function connectBackend() {
    if ( wsc == null ) {
        wsc = new WebSocketClient;
    }
}

/**
 * [createMessageBox 创建消息显示框]
 * @param  {[object]} $msg_obj [引用对象返回消息框的header, content, fullbox]
 */
function createMessageBox($msg_obj) {
    var $fullBox = document.createElement('div');
    var $Box = document.createElement('div');
    var $Header = document.createElement('div');
    var $Header_msg = document.createElement('span');
    var $Content = document.createElement('div');
    var $Close = document.createElement('img');
    var $body = document.getElementsByTagName('body')[0];

    $fullBox.className = 'full-box';
    $Box.className = 'msg-box';
    $Header.className = 'msg-header';
    $Close.src = 'static/img/close.png'; $Close.title = '关闭';
    $Content.className = 'msg-content';

    $Header.onmousedown = function(event) { moveDiv(event, $Box); };
    $Close.onclick = function() { $fullBox.remove(); };

    $Header.appendChild($Header_msg);
    $Header.appendChild($Close);
    $Box.appendChild($Header);
    $Box.appendChild($Content);
    $fullBox.appendChild($Box);
    $body.appendChild($fullBox);

    $msg_obj.header = $Header_msg;
    $msg_obj.content = $Content;
    $msg_obj.fullBox = $fullBox;
}

/**
 * [showMessage 显示信息]
 * @param  {[string]} msg [显示内容]
 */
function showMessage(msg) {
    var $msg_object = {};
    var $span = document.createElement('span');
    createMessageBox($msg_object);

    $span.innerHTML = msg;
    $span.style.color = 'red';
    $span.style.textAlign = 'center';
    $span.style.fontWeight = 'bold';

    $msg_object.header.innerHTML = '信息';
    $msg_object.content.appendChild($span);
}

function createPasswdBox( $ret_obj ) {
    var $box_object = {};
    var $passwdInput = document.createElement('input');
    var $btnBox = document.createElement('div');
    var $logBtn = document.createElement('button');
    var $cancelBtn = document.createElement('button');

    createMessageBox( $box_object );

    $passwdInput.type = 'password'; $passwdInput.placeholder = 'password';
    $box_object.header.innerHTML = '输入密码';
    $btnBox.className = 'new-btn';
    $logBtn.innerHTML = '登录';
    $cancelBtn.innerHTML = '取消';

    $btnBox.appendChild($logBtn);
    $btnBox.appendChild($cancelBtn);
    $box_object.content.appendChild($passwdInput);
    $box_object.content.appendChild($btnBox);

    // 事件绑定
    $cancelBtn.onclick = function () { $box_object.fullBox.remove(); }
    $ret_obj.logBtn = $logBtn;
    $ret_obj.passwdInput = $passwdInput;
    $ret_obj.fullbox = $box_object.fullBox;
}

/**
 * [createSshClient 创建ssh客户端]
 * @param  {[object]} $user_info [登录的相关信息]
 */
function createSshClient( $user_info ) {
    var $ssh = new Ssh(
        $user_info['ipaddr'],
        $user_info['port'],
        $user_info['user'],
        $user_info['passwd'],
        $user_info['privateKeyPath'],
        $user_info['loginType']
    );
    $ssh.create($user_info['nodeName']);
    $ssh.focus();
}

/**
 * [createDataFolder 判断用户文件夹是否存在]
 */
function createDataFolder() {
    // 创建用户保存数据文件夹
    fs.exists(dataDir, function (result) {
        // 判断目录是否存在
        if (!result) {
            // 不存在
            fs.mkdir(dataDir, 0755, function (err) {
                if (err) {
                    showMessage("创建用户数据目录失败。");
                }
            });
        }
    });
    // 创建用户配置数据文件夹
    fs.exists(confDir, function (result) {
        // 判断目录是否存在
        if (!result) {
            // 不存在
            fs.mkdir(confDir, 0755, function (err) {
                if (err) {
                    showMessage("创建用户配置目录失败。");
                }
            });
        }
    });
}

/**
 * [createUpDownMessage 创建上传和下载文件消息通知框]
 * @param  {[string]} $msg [消息]
 */
function createUpDownMessage( $msg ) {
    var $box = document.createElement('div');
    var $body = document.getElementsByTagName('body')[0];
    $box.innerHTML = $msg;
    $box.className = 'up_down';
    window.setTimeout(function () {
        $box.remove();
    }, 3000);
    $body.appendChild( $box );
}

function prepareTextForClipboard(text) {
    var space = String.fromCharCode(32), nonBreakingSpace = String.fromCharCode(160), allNonBreakingSpaces = new RegExp(nonBreakingSpace, 'g'), processedText = text.split('\n').map(function (line) {
        var processedLine = line.replace(/\s+$/g, '').replace(allNonBreakingSpaces, space);
        return processedLine;
    }).join('\n');
    return processedText;
}

/**
 * [moveDiv 移动DIV]
 */
function moveDiv(event, $box) {
    var $isMove = true;
    var $abs_x = event.pageX - $box.offsetLeft;
    var $abs_y = event.pageY - $box.offsetTop;
    window.onmousemove = function (evt) {
        if ($isMove) {
            $box.style.left = (evt.pageX - $abs_x)+"px";
            $box.style.top = (evt.pageY - $abs_y)+"px";
        };
    }
    window.onmouseup = function (evt) {
        $isMove = false;
        window.onmousemove = null;
        window.onmouseup = null;
    }
}

/**
 * [removeAll 删除元素下面的所有子元素]
 * @param  {[type]} $parentNode [父元素节点]
 */
function removeAll( $parentNode ) {
    while( $parentNode.childNodes.length ) {
        $parentNode.removeChild( $parentNode.childNodes[0] );
    }
}

/**
 * [trimStr 去除字符串首尾空格]
 * @param  {[string]} str [需要处理的字符串]
 * @return {[string]}     [处理之后的字符串]
 */
function trim(str){
    return str.replace(/(^\s*)|(\s*$)/g, "");
}

/**
 * [findStr 查找数组中最近的不为空的元素]
 * @param  {[Array]} arr [需要查找的数组]
 * @return {[string]}      [不为空的元素]
 */
function findStr(arr) {
    var $i = 0;

    for( $i = 0; $i < arr.length; ++$i ) {
        if ( arr[$i] != '' ) {
            return arr[$i];
        }
    }
}

window.onload = init;
window.onresize = on_resize;