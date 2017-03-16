var gui, win, shell, clipboard, appPath = null;
var wscArray = new Array();
var clientNum = 0;
var localUrl = 'ws://127.0.0.1:12345';
var isMaxScreen = false;
// websocket readyState 状态码
// 0. CONNECTING    连接尚未建立
// 1. OPEN          websocket已经建立
// 2. CLOSING       连接正在关闭
// 3. CLOSED        连接已经关闭或者不可用
var READYSTATE = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
};

if ( typeof(require) != 'undefined' ) {
    gui = require('nw.gui');
    win = gui.Window.get();
    appPath = require('path');
    shell = gui.Shell;
    shell.openItem(appPath.dirname(process.execPath)+'/bin/webSocketServer.exe');
    // console.log(appPath.dirname(process.execPath)+'/bin/webSocketServer.exe');
    clipboard = gui.Clipboard.get();
    // debug
    // win.showDevTools()
    // debug end
}
// WebSocketClient类 与服务器沟通，创建term
function WebSocketClient($hostInfo) {
    this.hostInfo = $hostInfo;
    this.term = null;
    this.conn = null;
    this.navElement = null;
    this.termElement = null;
    this.sessionNum = 0;
    this.sessionStatus = false;
}
// 开启终端 创建导航栏 连接webSocketServer服务器
WebSocketClient.prototype.open = function () {
    this.createTerm();
    this.createNav();
    this.connectServer();
}
// 创建终端
WebSocketClient.prototype.createTerm = function () {
    var $obj = this;
    var $_termId = 'term'+clientNum;
    var $_termDiv = $('<div id='+$_termId+' class="term"></div>');
    $_termDiv.bind('click', function () {
        $('.contextMenu').remove();
        hiddenList();
    });
    $_termDiv.bind('mousedown', function (event) {
        createContextMenu(event, $obj);
    });
    $('#term-box').append($_termDiv);
    this.termElement = document.getElementById($_termId);
    while ( this.termElement.children.length ) {
        this.termElement.removeChild( this.termElement.children[0] );
    }
    this.term = new Terminal({
        cols: 120,
        cursorBlink: 5,
        scrollback: 1024,
        tabStopWidth: 4
    });
    this.term.open(this.termElement);
    this.term.fit();
    
    $('.term').css('z-index', '0');
    $($obj.termElement).css('z-index', '1');
}
// 创建导航栏
WebSocketClient.prototype.createNav = function () {
    var $obj = this;
    var $nodeName = (this.hostInfo['nodeName'])?this.hostInfo['nodeName']:this.hostInfo['host'];
    var $nav = $('<div>\
            <img class="load" src="img/load.png">\
            '+$nodeName+'\
        </div>');
    var $closeImg = $('<img class="nav-close" src="img/close.png" title="关闭">');
    $closeImg.bind('click', function () {$obj.destroy();});
    $nav.append($closeImg);
    $('.conn-nav').append($nav);
    $nav.bind('click', function() {
        $('.conn-nav').children('div').css('box-shadow', '0px 0px 5px gray inset');
        $(this).css('box-shadow', '0px 0px 10px red inset');
        $('.term').css('z-index', '0');
        $($obj.termElement).css('z-index', '1');
        $obj.term.focus();
    });
    this.navElement = $nav;
    if ( this.sessionNum == 0 ) {
        $('.conn-nav').css('display', 'block');
        $('body').css('background-color', '#000');
    }
    $('.conn-nav').children('div').css('box-shadow', '0px 0px 5px gray inset');
    $nav.css('box-shadow', '0px 0px 10px red inset');
}
// 连接webSocketServer
WebSocketClient.prototype.connectServer = function () {
    var $obj = this;
    this.conn = new WebSocket(localUrl);
    this.conn.onerror = function () { showErrorMessage('连接webSocketServer失败。请启动webSocketServer，重启软件') };
    this.conn.onmessage = function(event) { recvMessage(event, $obj) };
    this.conn.onopen = function () { loginSshServer($obj); }
}
// 关闭终端、连接、导航栏
WebSocketClient.prototype.destroy = function () {
    this.term.destroy();
    this.navElement.remove();
    $(this.termElement).remove();
    if ( this.sessionStatus == true ) {
        this.conn.send(JSON.stringify({'request':'data', 'data':'logout'}));
    }
    this.conn.send(JSON.stringify({'request':'quit'}));
    this.conn.close()
    // 从数组中删除
    wscArray.splice(this.sessionNum, 1);
    clientNum--;
    if ( clientNum == 0 ) { // 如果没有连接 就关闭 连接导航
        $('.conn-nav').css('display', 'none');
        $('body').css('background-color', '#444');
    }
}
// 连接列表类 存储全部的连接列表
function FolderList() {
    this.folderList = new Object();
    this.hostList= new Object();
    this.conn = null;
    this.listParent = null;
    this.currentNode = null;
    this.requestFolderNum = 0;
}
// 创建连接列表
FolderList.prototype.createFolderList = function () {
    var $obj = this;
    var $fullBox = $('<div class="full-box"></div>');
    var $folderBox = $('<div class="folder-box"></div>');
    var $folderHeader = $('<div class="folder-header">连接列表</div>');
    var $closeImg = $('<img src="img/close.png" title="关闭" />');
    var $folderContent = $('<div class="folder-content"></div>');
    var $folderBtn = $('<div class="folder-content-btn"></div>');
    var $folderUl = $('<ul></ul>');
    var $addBtn = $('<img src="img/add.png" title="新建" />');
    var $modifyBtn = $('<img src="img/modify.png" title="修改" />');
    var $deleteBtn = $('<img src="img/close.png" title="删除" />');
    this.listParent = $folderUl;
    for ( var $item in this.hostList ) {
        var $node = new ListNode(this.hostList[$item]);
        $node.createNewNode($folderUl);
        this.folderList[$item] = $node;
    }
    // 绑定事件
    $folderHeader.bind('mousedown', function (event) {moveDiv(event, $folderBox)});
    $closeImg.bind('click', function () {closeDiv($fullBox);});
    $addBtn.bind('click', function () { $obj.createNewNodeBox(); });
    $modifyBtn.bind('click', function () { $obj.createModifyNodeBox(); });
    $deleteBtn.bind('click', function () { $obj.deleteNode(); });
    // 显示
    $folderHeader.append($closeImg);
    $folderBtn.append($addBtn, $modifyBtn, $deleteBtn);
    $folderContent.append($folderBtn, $folderUl);
    $folderBox.append($folderHeader, $folderContent);
    $fullBox.append($folderBox);
    $folderContent.SimpleTree();
    $('body').append($fullBox);
}
// 创建新建连接的div
FolderList.prototype.createNewNodeBox = function () {
    var $obj = this;
    var $fullBox = $('<div class="full-box"></div>');
    var $newBox = $('<div class="new-box"></div>');
    var $newHeader = $('<div class="new-header">新建连接</div>');
    var $closeImg = $('<img src="img/close.png"/>');
    var $newContent = $('<div class="new-content"></div>');
    var $linkName = $('<div class="link-name"></div>');
    var $linkNameInput =$('<input type="text"name="link-name" placeholder="连接名"/>');
    var $hostInfoDiv = $('<div class="host-info"></div>');
    var $hostInput = $('<input type="text" name="host" placeholder="主机地址"/>');
    var $portInput = $('<input type="text" name="port" placeholder="Ssh端口" />');
    var $userInfoBox = $('<div class="user-info"></div>');
    var $userInput = $('<input type="text" name="user" placeholder="用户名" />');
    var $loginTypeBox = $('<div class="login-type"></div>');
    var $passwordRadio = $('<input type="radio" name="loginType" value="0"/>');
    var $privateRadio = $('<input type="radio" name="loginType" value="1"/>');
    var $selectBox = $('<div class="select-box"></div>');
    var $passwordInput = $('<input type="password" name="password" placeholder="密码" />');
    var $privateInput = $('<input type="text" name="privateKey" placeholder="密钥路径" disabled="true"/>');
    var $fileInput = $('<input id="fileDialog" type="file" name="privateKeyFile"/>');
    var $btnBox = $('<div class="new-btn"></div>');
    var $addBtn = $('<button>新建</button>');
    var $cancelBtn = $('<button>取消</button>');

    // 绑定事件
    $closeImg.bind('click', function () {closeDiv($fullBox);});
    $newHeader.bind('mousedown', function (event) {moveDiv(event, $newBox);});
    $passwordRadio.bind('click', function () {$selectBox.children().remove();$selectBox.append($passwordInput);});
    $privateRadio.bind('click', function () {$selectBox.children().remove();$selectBox.append($privateInput,$fileInput);});
    $fileInput.bind('change', function (event) { $privateInput.val(this.value); });
    $addBtn.bind('click', function () {
        var $hostInfo = {
            'nodeName': $linkNameInput.val(),
            'host': $hostInput.val(),
            'port': $portInput.val(),
            'user': $userInput.val(),
            'loginType': $('input[name="loginType"]:checked').val(),
            'password': $passwordInput.val(),
            'privateKey': $privateInput.val()
        };
        $obj.addNewNode($hostInfo);
    });
    $cancelBtn.bind('click', function () {closeDiv($fullBox);});
    // 显示
    $newHeader.append($closeImg);
    $linkName.append($linkNameInput);
    $hostInfoDiv.append($hostInput, $portInput);
    $userInfoBox.append($userInput);
    $passwordRadio.attr('checked', 'true');
    $loginTypeBox.append($passwordRadio,'密码登录',$privateRadio,'密钥登录');
    $selectBox.append($passwordInput);
    $btnBox.append($addBtn, $cancelBtn);
    $newContent.append($linkName,$hostInfoDiv,$userInfoBox,$loginTypeBox,$selectBox,$btnBox);
    $newBox.append($newHeader, $newContent);
    $fullBox.append($newBox);
    $('body').append($fullBox);
}
// 创建修改连接的div
FolderList.prototype.createModifyNodeBox = function () {
    var $currentNode = $('#currentNode');
    if ( !$currentNode.length ) {
        // 没有选择节点的情况
        showErrorMessage('没有选择节点。');
        return false;
    }
    // 显示信息
    var $currentNodeName = $currentNode.html();
    var $currentNodeInfo = this.hostList[$currentNodeName];
    var $obj = this;
    var $fullBox = $('<div class="full-box"></div>');
    var $modBox = $('<div class="modify-box"></div>');
    var $modHeader = $('<div class="modify-header">新建连接</div>');
    var $closeImg = $('<img src="img/close.png"/>');
    var $modContent = $('<div class="modify-content"></div>');
    var $linkName = $('<div class="link-name"></div>');
    var $linkNameInput =$('<input type="text"name="linkName" placeholder="连接名"/>');
    var $hostInfoDiv = $('<div class="host-info"></div>');
    var $hostInput = $('<input type="text" name="host" placeholder="主机地址"/>');
    var $portInput = $('<input type="text" name="port" placeholder="Ssh端口" />');
    var $userInfoBox = $('<div class="user-info"></div>');
    var $userInput = $('<input type="text" name="user" placeholder="用户名" />');
    var $loginTypeBox = $('<div class="login-type"></div>');
    var $passwordRadio = $('<input type="radio" name="loginType" value="0"/>');
    var $privateRadio = $('<input type="radio" name="loginType" value="1"/>');
    var $selectBox = $('<div class="select-box"></div>');
    var $passwordInput = $('<input type="password" name="password" placeholder="密码" />');
    var $privateInput = $('<input type="text" name="privateKey" placeholder="密钥路径" disabled="true" />');
    var $fileInput = $('<input id="fileDialog" type="file" name="privateKeyFile"/>');
    var $btnBox = $('<div class="mod-btn"></div>');
    var $modBtn = $('<button>修改</button>');
    var $cancelBtn = $('<button>取消</button>');

    // 绑定事件
    $closeImg.bind('click', function () {closeDiv($fullBox)});
    $modHeader.bind('mousedown', function (event) {moveDiv(event, $modBox)});
    $passwordRadio.bind('click', function () {$selectBox.children().remove();$selectBox.append($passwordInput);});
    $privateRadio.bind('click', function () {$selectBox.children().remove();$selectBox.append($privateInput, $fileInput);});
    $fileInput.bind('change', function () {$privateInput.val(this.value);});
    $cancelBtn.bind('click', function () {closeDiv($fullBox)});
    $modBtn.bind('click', function () {
        var $modNode = {
            'nodeName': $linkNameInput.val(),
            'host': $hostInput.val(),
            'port': $portInput.val(),
            'user': $userInput.val(),
            'loginType': $('input[name="loginType"]:checked').val(),
            'password': $passwordInput.val(),
            'privateKey': $privateInput.val()
        };
        $obj.modifyNode($modNode);
    });
    // 显示数据
    $linkNameInput.val($currentNodeInfo['nodeName']);
    $hostInput.val($currentNodeInfo['host']);
    $portInput.val($currentNodeInfo['port']);
    $userInput.val($currentNodeInfo['user']);

    if ( $currentNodeInfo['loginType'] == 0 ) {
        $passwordRadio.attr('checked', 'true');
        $passwordInput.val($currentNodeInfo['password']);
        $selectBox.append($passwordInput);
    }else {
        $privateRadio.attr('checked', 'true');
        $privateInput.val($currentNodeInfo['privateKey']);
        $selectBox.append($privateInput, $fileInput);
    }
    // 显示
    $modHeader.append($closeImg);
    $linkName.append($linkNameInput);
    $hostInfoDiv.append($hostInput, $portInput);
    $userInfoBox.append($userInput);
    $loginTypeBox.append($passwordRadio,'密码登录', $privateRadio, '密钥登录');
    $btnBox.append($modBtn, $cancelBtn);
    $modContent.append($linkName, $hostInfoDiv, $userInfoBox, $loginTypeBox, $selectBox, $btnBox);
    $modBox.append($modHeader, $modContent);
    $fullBox.append($modBox);
    $('body').append($fullBox);
}
// 添加新节点处理函数
FolderList.prototype.addNewNode = function ($hostInfo) {
    var $obj = this;
    // 错误判断
    var $hostRet = $hostInfo['host'].search(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/g);
    var $portRet = ($hostInfo['port']>0&&$hostInfo['port']<65535)?0:-1;
    if (($hostRet+$portRet) < 0) {
        showErrorMessage('输入格式错误。');
        return false;
    }
    // 判断是否有重名
    for ( var $item in this.hostList ) {
        if ( $item == $hostInfo['nodeName'] ) {
            showErrorMessage('该节点已经存在。');
            return false;
        }
    }
    // 正式添加
    this.currentNode = $hostInfo;
    var $tmpFolder = new Object();
    copyJson($tmpFolder, this.hostList);
    $tmpFolder[$hostInfo['nodeName']] = $hostInfo;
    this.conn = new WebSocket(localUrl);
    this.conn.onopen = function () {
        var $sendJson = {'request':'folder', 'data':'new', 'info': $tmpFolder};
        var $sendStr = JSON.stringify($sendJson);
        this.send($sendStr);
    };
    this.conn.onerror = function () {showErrorMessage('连接webSocketServer异常。添加失败。');};
    this.conn.onmessage = function (event) { recvMessage(event, $obj); };
}
// 修改节点
FolderList.prototype.modifyNode = function ( $modNode ) {
    var $obj = this;
    var $currentNodeName = $('#currentNode').html();
    var $tmpFolder = new Object();
    copyJson($tmpFolder, this.hostList);
    this.currentNode = $modNode;
    if ( $currentNodeName == $modNode['nodeName'] ) {
        // 连接名没有改变的情况
        $tmpFolder[$currentNodeName] = $modNode;
    }else {
        // 连接名被改变的情况
        delete $tmpFolder[$currentNodeName];
        $tmpFolder[$modNode['nodeName']] = $modNode;
    }
    this.conn = new WebSocket(localUrl);
    this.conn.onopen = function () {
        var $sendStr = JSON.stringify({'request':'folder', 'data':'mod','info':$tmpFolder});
        this.send($sendStr);
    }
    this.conn.onerror = function () { showErrorMessage('连接webSocketServer异常。添加失败。'); }
    this.conn.onmessage = function (event) {recvMessage(event, $obj)} 
}
// 删除节点
FolderList.prototype.deleteNode = function () {
    var $obj = this;
    var $currentNodeName = '';
    var $currentNode = $('#currentNode');
    if (!$currentNode.length) {
        showErrorMessage('没有选择节点。');
        return false;
    }
    $currentNodeName = $currentNode.html();
    var $tmpFolder = new Object();
    copyJson($tmpFolder, this.folderList);
    delete $tmpFolder[$currentNodeName];
    this.conn = new WebSocket(localUrl);
    this.conn.onopen = function () {
        var $sendStr = JSON.stringify({'request':'folder','data':'del','info':$tmpFolder});
        this.send($sendStr);
    };
    this.conn.onerror = function () {showErrorMessage('连接webSocketServer异常。删除失败');};
    this.conn.onmessage = function (event) { recvMessage(event, $obj);};
}
// 向服务器发起请求 请求用户保存的连接列表
FolderList.prototype.requestFolderList = function () {
    var $obj = this;
    this.conn = new WebSocket(localUrl);
    this.conn.onopen = function () {
        var $sendStr = JSON.stringify({'request': 'folder', 'data': 'get'});
        this.send($sendStr);
        $obj.requestFolderNum = 0;
    };
    this.conn.onerror = function () { 
        if (++$obj.requestFolderNum > 3) {
            showErrorMessage('获取列表失败。请检查webSocketServer是否开启。');
        }else {
            $obj.requestFolderList();
        }
    };
    this.conn.onmessage = function (event) { recvMessage(event, $obj); };
}
// FolderList Node class
function ListNode($hostInfo) {
    this.hostInfo = $hostInfo;
    this.node = null;
}
// 创建新的节点
ListNode.prototype.createNewNode = function ($parent) {
    var $obj = this;
    var $li = $('<li>'+this.hostInfo['nodeName']+'</li>');
    $li.bind('click', function () {$parent.children('li').attr('id', '');$(this).attr('id', 'currentNode')});
    $li.bind('dblclick', function () {
        var $webClient = new WebSocketClient($obj.hostInfo);
        $webClient.open();
        $webClient.sessionNum = clientNum;
        wscArray.push($webClient);
        clientNum++;
    });
    $parent.append($li);
    this.node = $li;
}
ListNode.prototype.destroy = function () {
    this.node.remove();
}
// 设置类
function Setting() {
    this.conn = null;
}
// 创建存储privateKey路径框
Setting.prototype.createSshPrivateBox = function () {
    var $obj = this;
    var $fullBox = $('<div class="full-box"></div>');
    var $settingBox = $('<div class="setting-box"></div>');
    var $settingHeader = $('<div class="setting-header">设置</div>');
    var $closeImg = $('<img src="img/close.png"/>');
    var $settingContent = $('<div class="setting-content"></div>');
    var $privateKeyInput = $('<input type="text" name="privateKeyPath" placeholder="sshKey存储路径(./sshKey/)" disabled="true" />');
    var $selectFolder = $('<input type="file" id="FolderDialog" nwdirectory/>');
    var $settingBtn = $('<div class="setting-btn"></div>');
    var $trueBtn = $('<button>确定</button>');
    var $falseBtn = $('<button>取消</button>');

    // 事件绑定
    $settingHeader.bind('mousedown', function (event) {moveDiv(event, $settingBox)});
    $closeImg.bind('click', function () {closeDiv($fullBox);});
    $selectFolder.bind('change', function () {$privateKeyInput.val(this.value);});
    $falseBtn.bind('click', function () {closeDiv($fullBox);});
    $trueBtn.bind('click', function () {
        var $privateKeyPath = $privateKeyInput.val();
        $obj.setPrivateSshPath($privateKeyPath);
        closeDiv($fullBox);
    });
    // 显示
    $settingHeader.append($closeImg);
    $settingBtn.append($trueBtn, $falseBtn);
    $settingContent.append($privateKeyInput, $selectFolder, $settingBtn);
    $settingBox.append($settingHeader, $settingContent);
    $fullBox.append($settingBox);
    $('body').append($fullBox);
}
// 设置privateKey 存储路径
Setting.prototype.setPrivateSshPath = function ($path) {
    var $obj = this;
    this.conn = new WebSocket(localUrl);
    this.conn.onopen = function () {
        var $sendStr = JSON.stringify({'request':'setting', 'data':'privateKeyPath', 'info':$path});
        this.send($sendStr);
    };
    this.conn.onerror = function () {showErrorMessage('连接webSocketServer异常。设置失败。');};
    this.conn.onmessage = function (event) {recvMessage(event, $obj)};
}
// json 复制
function copyJson($newJson, $oldJson) {
    for ( var $item in $oldJson ) {
        $newJson[$item] = $oldJson[$item];
    }
}
// 发送初始化数据 登录sshServer
function loginSshServer($crt) {
    var $cols = $crt.term.cols;
    var $rows = $crt.term.rows;
    var $sendJson = {'request': 'init', 'data': $crt.hostInfo, 'cols':$cols, 'rows':$rows};
    var $sendStr = JSON.stringify($sendJson);
    $crt.term.write('connect ssh server...\r\n');
    $crt.conn.send($sendStr);
}
// 接受webSocketServer数据并处理
function recvMessage(event, $crt) {
    var $recvStr = event.data;
    var $recvJson = JSON.parse($recvStr);
    var $command = '';
    // WebSocketClient class
    if ( $recvJson['response'] == 'init' ) {
        if ( $recvJson['data'] == 'false' ) {
            // 登录失败
            showErrorMessage($recvJson['errMes']);
            $($crt.navElement.children('img')[0]).attr('src', 'img/false.png');
            $crt.sessionStatus = false;
        }else {
            // 登录成功
            $crt.sessionStatus = true;
            $($crt.navElement.children('img')[0]).attr('src', 'img/true.png');
            $crt.term.on('data', function ($data) {
                if ( $crt.sessionStatus == true ) {
                    var $sendStr = JSON.stringify({'request': 'data', 'data':$data});
                    $crt.conn.send($sendStr);
                }else if ( $data == '\r' ) {
                    loginSshServer($crt);
                    $($crt.navElement.children('img')[0]).attr('class', 'load');
                    $($crt.navElement.children('img')[0]).attr('src', 'img/load.png');
                    $crt.term.off('data');
                    return;
                }
            });
        }
        $crt.navElement.children('.load').attr('class', '');
    }else if ( $recvJson['response'] == 'data' ) {
        // 接受数据 显示数据
        $crt.term.write( $recvJson['data'] );
    }else if ( $recvJson['response'] == 'logout' ) {
        // 注销情况
        $($crt.navElement.children('img')[0]).attr('src', 'img/false.png');
        $crt.term.write('请按下Enter键继续会话.\r\n');
        $crt.sessionStatus = false;
    }else if ( $recvJson['response'] == 'upload' ) {
        // 发送文件事件
        $fileInput = $('<input type="file" name="uploadFile">');
        $fileInput.css('display', 'block');
        $fileInput.bind('change', function () { unloadFile($crt, $fileInput); });
        $('body').append($fileInput);
        $fileInput.trigger('click');
    }
    // FolderList class
    else if ( $recvJson['response'] == 'folder' ) {
        if ( $recvJson['data'] ) {
            // 表示成功获取到节点
            $crt.hostList = $recvJson['data'];
        }
        else {
            if ($recvJson['info'] == 'new') {
                // 表示成功更新节点
                // 添加节点到界面上
                var $node = new ListNode($crt.currentNode);
                $node.createNewNode($crt.listParent);
                $crt.hostList[$crt.currentNode['nodeName']] = $crt.currentNode;
                $crt.folderList[$crt.currentNode['nodeName']] = $node;
            }
            else if ($recvJson['info'] == 'del') {
                // 删除
                var $currentNode = $('#currentNode');
                var $nodeName = $currentNode.html();
                delete $crt.hostList[$nodeName];
                $crt.folderList[$nodeName].destroy();
            }else if ($recvJson['info'] == 'mod') {
                var $currentNodeName = $('#currentNode').html();
                if ( $currentNodeName == $crt.currentNode ) {
                    // 名字没有改变的情况
                    $crt.hostList[$currentNodeName] = $crt.currentNode;
                    $crt.folderList[$currentNodeName].hostInfo = $crt.currentNode;
                }else {
                    delete $crt.hostList[$currentNodeName];
                    $crt.folderList[$currentNodeName].destroy();
                    delete $crt.folderList[$currentNodeName];
                    var $node = new ListNode( $crt.currentNode );
                    $node.createNewNode($crt.listParent);
                    $crt.hostList[$crt.currentNode['nodeName']] = $crt.currentNode;
                    $crt.folderList[$crt.currentNode['nodeName']] = $node;
                }
            }
        }
        var $sendStr = JSON.stringify({'request':'quit'});
        $crt.conn.send( $sendStr );
    }
    // Setting class
    else if ( $recvJson['response'] == 'setting' ) {
        if ( $recvJson['data'] == 'false' ) {
            showErrorMessage('设置失败。');
        }
        var $sendStr = JSON.stringify({'request': 'quit'});
        $crt.conn.send($sendStr);
    }
    // get sshKey
    else if ( $recvJson['response'] == 'genKey' ) {
        if ( $recvJson['data'] == 'false' ) {
            showErrorMessage($recvJson['info']);
        }else {
            showErrorMessage('创建成功。');
        }
        var $sendStr = JSON.stringify({'request': 'quit'});
        $crt.send($sendStr);
    }
}
// rz上传文件
function unloadFile($clt, $fileObj) {
    var $fileName = $fileObj.val();
    var $sendJson = {'request':'upload','data':$fileName};
    $sendStr = JSON.stringify($sendJson);
    $clt.conn.send($sendStr);
    $fileObj.remove();
}
// 显示错误信息
function showErrorMessage($mes) {
    var $fullBox = $('<div class="full-box"></div>');
    var $errBox = $('<div class="error-box"></div>');
    var $errHeader = $('<div class="error-header">信息</div>');
    var $errClose = $('<img src="img/close.png" title="关闭" />');
    var $errContent = $('<div class="error-content">'+$mes+'</div>');
    // 时间绑定
    $errHeader.bind('mousedown', function (event){ moveDiv(event, $errBox); } );
    $errClose.bind('click', function () {closeDiv($fullBox)});
    // 显示
    $errHeader.append($errClose);
    $errBox.append($errHeader, $errContent);
    $fullBox.append($errBox);
    $('body').append($fullBox);
}
// 关闭div框
function closeDiv($element) {
    $element.remove();
}
// 关闭列表
function hiddenList() {
    var $showBtn = $('.show-btn');
    var $rightBox = $('.right-nav');
    $showBtn.css('transform', 'translateX(0px)');
    $showBtn.attr('id', '');
    $rightBox.fadeOut('slow');
}
// 展开列表
function showList() {
    var $showBtn = $('.show-btn');
    var $rightBox = $('.right-nav');
    if ( !$showBtn.attr('id') ) {
        $showBtn.css('transform', 'translateX(-50px)');
        $showBtn.attr('id', 'up');
        $rightBox.fadeIn('slow');
    }else {
        hiddenList();
    }
}
// 创建连接框 用于用户暂时连接ssh服务器
function createConnectBox() {
    var $fullBox = $('<div class="full-box"></div>');
    var $connBox = $("<div class='conn-box'></div>");
    var $connHeader = $('<div class="conn-header"><span>快速连接</span></div>');
    var $closeImg = $('<img src="img/close.png" title="关闭" />');
    var $connContent = $('<div class="conn-content"></div>');
    var $hostInfoBox = $('<div class="host-info"></div>');
    var $userInfoBox = $('<div class="user-info"></div>');
    var $hostInput = $('<input type="text" name="host" placeholder="主机地址"/>');
    var $portInput = $('<input type="text" name="port" placeholder="Ssh端口">');
    var $userInput = $('<input type="text" name="user" placeholder="用户名">');
    var $passInput = $('<input type="password" name="password" placeholder="密码">');
    var $connBtn = $('<div class="conn-btn"></div>');
    var $trueBtn = $('<button>确定</button>');
    var $falseBtn = $('<button>取消</button>');
    // 绑定事件
    $closeImg.bind('click', function () {closeDiv($connBox);closeDiv($fullBox);});
    $connHeader.bind('mousedown', function(event) {moveDiv(event, $connBox);});
    $trueBtn.bind('click', function () {
        var $hostInfo = {
            'nodeName': $hostInput.val(),
            'host': $hostInput.val(),
            'port': $portInput.val(),
            'user': $userInput.val(),
            'password': $passInput.val(),
            'loginType': 0
        }
        var $webClient = new WebSocketClient($hostInfo);
        $webClient.open();
        $webClient.sessionNum = clientNum;
        wscArray.push($webClient);
        clientNum++;
    });
    $falseBtn.bind('click', function () {closeDiv($connBox);closeDiv($fullBox);});
    // 显示
    $connHeader.append($closeImg);
    $connBtn.append($trueBtn, $falseBtn);
    $hostInfoBox.append($hostInput, $portInput);
    $userInfoBox.append($userInput, $passInput);
    $connContent.append($hostInfoBox, $userInfoBox, $connBtn);
    $connBox.append($connHeader, $connContent);
    $('body').append($fullBox,$connBox);
}
// 移动div框
function moveDiv(event, $element) {
    var isMove = true;
    var abs_x = event.pageX - $element.offset().left;
    var abs_y = event.pageY - $element.offset().top;
    $(document).mousemove(function(event) {
        if (isMove) {
            $element.css({'left':event.pageX - abs_x, 'top':event.pageY - abs_y});
        };
    }).mouseup(function(event) {
        isMove = false;
    });;
}
// 创建右键菜单
function createContextMenu(event, $crt) {
    if (event.which != 3) {
        return false;
    }
    $('body').children('.contextMenu').remove();
    var $contextMenu = $('<div class="contextMenu"></div>');
    var $ulBox = $('<ul></ul>');
    var $copyBtn = $('<li>复制</li>');
    var $pasteBtn = $('<li>黏贴</li>');
    var $cpBtn = $('<li>复制并黏贴</li>');
    if ( clipboard.get('text') == '' ) {
        $pasteBtn.css({
            'color':'#222',
            'cursor':'not-allowed'
        });
    }else {
        $pasteBtn.bind('click', function () {
            var $sendStr = JSON.stringify({'request':'data', 'data':clipboard.get('text')});
            $crt.conn.send($sendStr);
        });
    }
    if ( window.getSelection().toString() == '' ) {
        $copyBtn.css({
            'color':'#222',
            'cursor':'not-allowed'
        });
        $cpBtn.css({
            'color':'#222',
            'cursor':'not-allowed'
        });
    }else {
        $copyBtn.bind('mousedown', function () {
            var $selectString = window.getSelection().toString();
            $selectString = $selectString.replace(/\xa0/g, ' ');
            clipboard.set($selectString, 'text');
        });
        $cpBtn.bind('mousedown', function () {
            var $selectString = window.getSelection().toString();
            $selectString = $selectString.replace(/\xa0/g, ' ');
            clipboard.set($selectString, 'text')
            var $sendStr = JSON.stringify({'request':'data', 'data':$selectString});
            $crt.conn.send($sendStr);
        });
    }
    $ulBox.append($copyBtn, $pasteBtn, $cpBtn);
    $ulBox.children('li').bind('click', function () {$contextMenu.remove();$crt.term.focus();})
    $contextMenu.css({ 
        'top': event.pageY+10+'px',
        'left': event.pageX+10+'px'
    });
    $contextMenu.append($ulBox);
    $('body').append($contextMenu);
}

// 初始化
$(document).ready(function () {
    var $folder = new FolderList();
    $folder.requestFolderList();

    // 事件绑定
    $('.box-top').bind('mousedown', function (event) {moveDiv(event, $(window));});
    $('.show-btn').bind('click', showList);
    $('.conn').bind('click', createConnectBox);
    $('.folder').bind('click', function () { $folder.createFolderList(); });
    $('.setting').bind('click', function () {
        var $set = new Setting();
        $set.createSshPrivateBox();
    });
    $('.key').bind('click', function() {
        var $conn = new WebSocket(localUrl);
        $conn.onopen = function() {var $sendStr = JSON.stringify({'request':'getKey'});this.send($sendStr);}
        $conn.onerror = function () {showErrorMessage('连接webSocketServer异常。创建sshKey失败。');}
        $conn.onmessage = function (event) {recvMessage(event, this);}
    });
    $(window).bind('resize', function () {
        for ( var $i = 0; $i < clientNum; $i++ ) {
            if ( wscArray[$i].sessionStatus == true ) {
                wscArray[$i].term.fit();
                var $sendStr = JSON.stringify({'request':'resize', 'cols':wscArray[$i].term.cols, 'rows':wscArray[$i].term.rows});
                wscArray[$i].conn.send($sendStr);
            }
        }
    });
    // 窗口事件
    $(document).bind('contextmenu', function () {return false;});
    $('.app-min').bind('click', function () {
        win.minimize();
    });
    $('.app-max').bind('click', function () {
        // 最大化和取消最大化
        if (isMaxScreen){
            win.unmaximize();
            isMaxScreen = false;
        }else{
            win.maximize();
            isMaxScreen = true;
        }
    });
    $('.app-close').bind('click', function () {
        win.close();
    });
    win.on('close', function () {
        // 窗口关闭事件
        // 关闭所有开启的终端
        this.hide();
        for ( var $index = 0; $index < clientNum; $index++ ) {
            wscArray[$index].destroy();            
        }
        // 向webSocketServer发送退出信号
        var $conn = new WebSocket(localUrl);
        $conn.onopen = function () {
            var $sendStr = JSON.stringify({'request':'systemExit'});
            this.send($sendStr);
        }
        $conn.onclose = function () {
            win.close(true);
        }
    });
});