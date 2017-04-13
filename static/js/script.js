var gui, win, shell, clipboard, appPath, fs, os = null;
var wscArray = new Array();
var clientNum = 0;
var localUrl = 'ws://127.0.0.1:12345';
var isMaxScreen = false;
var baseDir = '';   // 程序的目录
var dataDir = '';   // 用户存储的连接列表目录
var dataFile = '';   // 用户存储的连接列表文件
var confFile = '';  // 用户配置文件
var hostname = '';  // 系统的主机名
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
    appPath = require('path');
    fs = require("fs");
    os = require('os');
    win = gui.Window.get();
    shell = gui.Shell;
    baseDir = appPath.dirname(process.execPath);     // 正式场景使用这个
    // baseDir = process.cwd();                            // 开发环境使用这个
    hostname = os.hostname();
    dataDir = baseDir+'/data';
    dataFile = baseDir+'/data/'+hostname+'.dat';
    confFile = baseDir+'/data/'+hostname+'.conf';
    clipboard = gui.Clipboard.get();
    // 打开webSocketServer
    shell.openItem(baseDir+'/bin/webSocketServer.exe');
    // debug
    // win.showDevTools();
    // debug end
}

/* webSocketClient class start */
// WebSocketClient类 与服务器沟通，创建term
function WebSocketClient($hostInfo) {
    this.hostInfo = $hostInfo;
    this.term = null;
    this.conn = null;
    this.navElement = null;
    this.termElement = null;
    this.sessionNum = 0;
    this.sessionStatus = false;
    this.commandStart = '';
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
/* webSocketClient class end */
/* FolderList class start */
// 连接列表类 存储全部的连接列表
function FolderList() {
    this.folderList = new Object();
    this.hostList = new Object();
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
    var $fileBtn = $('<button>..</button>');
    var $btnBox = $('<div class="new-btn"></div>');
    var $addBtn = $('<button>新建</button>');
    var $cancelBtn = $('<button>取消</button>');

    // 绑定事件
    $closeImg.bind('click', function () {closeDiv($fullBox);});
    $newHeader.bind('mousedown', function (event) {moveDiv(event, $newBox);});
    $passwordRadio.bind('click', function () {$selectBox.children().remove();$selectBox.append($passwordInput);});
    $privateRadio.bind('click', function () {$selectBox.children().remove();$selectBox.append($privateInput,$fileBtn,$passwordInput);});
    $fileBtn.bind('click', function (event) {
        var $fileInput = $('<input type="file" name="fileDialog" />');
        $fileInput.css( 'display', 'none' );
        $fileInput.bind('change', function () {
            var $filePath = $fileInput.val();
            $privateInput.val( $filePath );
            $fileInput.remove();
        });
        $fileInput.trigger('click');
    });
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
        closeDiv($fullBox);
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
    var $fileBtn = $('<button>..</button>');
    var $btnBox = $('<div class="mod-btn"></div>');
    var $modBtn = $('<button>修改</button>');
    var $cancelBtn = $('<button>取消</button>');

    // 绑定事件
    $closeImg.bind('click', function () {closeDiv($fullBox)});
    $modHeader.bind('mousedown', function (event) {moveDiv(event, $modBox)});
    $passwordRadio.bind('click', function () {$selectBox.children().remove();$selectBox.append($passwordInput);});
    $privateRadio.bind('click', function () {$selectBox.children().remove();$selectBox.append($privateInput, $fileBtn, $passwordInput);});
    $fileBtn.bind('click', function () {
        var $fileInput = $('<input type="file" />');
        $fileInput.css( 'display', 'none');
        $fileInput.bind('change', function () {
            $privateInput.val($fileInput.val());
            $fileInput.remove();
        });
        $fileInput.trigger('click');
    });
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
        closeDiv($fullBox);
    });
    // 显示数据
    $linkNameInput.val($currentNodeInfo['nodeName']);
    $hostInput.val($currentNodeInfo['host']);
    $portInput.val($currentNodeInfo['port']);
    $userInput.val($currentNodeInfo['user']);
    $passwordInput.val($currentNodeInfo['password']);

    if ( $currentNodeInfo['loginType'] == 0 ) {
        $passwordRadio.attr('checked', 'true');
        $selectBox.append($passwordInput);
    }else {
        $privateRadio.attr('checked', 'true');
        $privateInput.val($currentNodeInfo['privateKey']);
        $selectBox.append($privateInput, $fileBtn, $passwordInput);
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
    var $buf = new Buffer(1024);
    var $tmpStr = '';
    var $item = null;
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
    var $node = new ListNode($hostInfo);
    $node.createNewNode(this.listParent);
    this.hostList[ $hostInfo['nodeName'] ] = $hostInfo;
    this.folderList[ $hostInfo['nodeName'] ] = $node;
    // 把配置全部写入文件
    fs.open(dataFile, 'w', 0666, function (status, fd) {
        if ( status ) {
            showErrorMessage( status );
            return;
        }
        for (var $item in $obj.hostList ) {
            var $writeStr = JSON.stringify( $obj.hostList[ $item ] );
            fs.write(fd, $writeStr+'\n', function () {});
        }
        fs.close(fd, function() {});
    });
}
// 修改节点
FolderList.prototype.modifyNode = function ( $modNode ) {
    var $currentNode = $('#currentNode');
    var $oldNodeName = $currentNode.html();
    var $obj = this;

    if ( $oldNodeName == $modNode['nodeName'] ) {
        // 当别名没有改变的情况
        this.hostList[$oldNodeName] = $modNode;
        this.folderList[$oldNodeName].hostInfo = $modNode;
    }else {
        // 当别名改变的情况
        // 判断是否有重名
        for ( var $item in this.hostList ) {
            if ( $item == $modNode['nodeName'] ) {
                showErrorMessage('该节点已经存在。');
                return false;
            }
        }
        delete this.hostList[$oldNodeName];
        this.hostList[$modNode['nodeName']] = $modNode;
        this.folderList[$oldNodeName] = $modNode;
        $currentNode.html( $modNode['nodeName'] );
    }
    // 把配置全部写入文件
    fs.open(dataFile, 'w', 0666, function (status, fd) {
        if ( status ) {
            showErrorMessage( status );
            return;
        }
        for (var $item in $obj.hostList ) {
            var $writeStr = JSON.stringify( $obj.hostList[ $item ] );
            fs.write(fd, $writeStr+'\n', function () {});
        }
        fs.close(fd, function() {});
    });
    
}
// 删除节点
FolderList.prototype.deleteNode = function () {
    var $currentNodeName = '';
    var $currentNode = $("#currentNode");
    var $obj = this;

    if ( !$currentNode.length ) {
        showErrorMessage("没有选择节点");
        return false;
    }
    $currentNodeName = $currentNode.html();
    delete this.hostList[$currentNodeName];
    delete this.folderList[$currentNodeName];
    $currentNode.remove();

    // 把配置全部写入文件
    fs.open(dataFile, 'w', 0666, function (status, fd) {
        if ( status ) {
            showErrorMessage( status );
            return;
        }
        for (var $item in $obj.hostList ) {
            var $writeStr = JSON.stringify( $obj.hostList[ $item ] );
            fs.write(fd, $writeStr+'\n', function () {});
        }
        fs.close(fd, function() {});
    });
}
// 读取用户保存的数据文件
FolderList.prototype.requestFolderList = function () {
    var $obj = this;
    fs.exists(dataDir, function (result) {
        // 判断目录是否存在
        if (!result) {
            // 不存在
            fs.mkdir(dataDir, 0755, function (err) {
                if (err) {
                    showErrorMessage("创建用户数据目录失败。");
                }
                fs.open(dataFile, 'w', 0666, function (err) {
                    if(err) {
                        showErrorMessage("创建用户数据文件失败。");
                    }
                });
            });
        } else {
            // 目录存在
            // 判断文件是否存在
            fs.exists(dataFile, function (result) {
                if (!result) {
                    // 文件不存在
                    fs.open(dataFile, 'w', 0666, function (err, fp) {
                        if(err) {
                            showErrorMessage("创建用户数据文件失败。");
                        }else {
                            fs.close(fp);
                        }
                    });
                }else {
                    // 文件存在
                    decryptedFile($obj);
                };
            })
        };
    })
}

/* FolderList class end */
/* ListNode class start */
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
/* ListNode class end */
/* Setting class start */
// 设置类
function Setting() {
    this.createSettingBox();
}
// 创建存储privateKey路径框
Setting.prototype.createSettingBox = function () {
    var $obj = this;
    var $fullBox = $('<div class="full-box"></div>');
    var $settingBox = $('<div class="setting-box"></div>');
    var $settingHeader = $('<div class="setting-header">设置</div>');
    var $closeImg = $('<img src="img/close.png"/>');
    var $settingContent = $('<div class="setting-content"></div>');
    var $privateKeyInput = $('<input type="text" name="privateKeyPath" placeholder="sshKey存储路径(./sshKey/)" disabled="true" />');
    var $selectBtn = $('<button>..</button>');
    var $downLoadInput = $('<input type="text" name="downloadPath" placeholder="下载路径(./downloadFile/)" disabled="true"/>');
    var $selectBtn1 = $('<button>..</button>');
    var $settingBtn = $('<div class="setting-btn"></div>');
    var $trueBtn = $('<button>确定</button>');
    var $falseBtn = $('<button>取消</button>');
    // 事件绑定
    $settingHeader.bind('mousedown', function (event) {moveDiv(event, $settingBox)});
    $closeImg.bind('click', function () {closeDiv($fullBox);});
    $selectBtn.bind('click', function() {
        var $selectFolder = $('<input type="file" nwdirectory />');
        $selectFolder.css('display', 'none');
        $selectFolder.bind('change', function() {
            $privateKeyInput.val($selectFolder.val());
            $selectFolder.remove();
        });
        $selectFolder.trigger('click');
    });
    $selectBtn1.bind('click', function() {
        var $selectFolder1 = $('<input type="file" nwdirectory />');
        $selectFolder1.css('display', 'none');
        $selectFolder1.bind('change', function() {
            $downLoadInput.val($selectFolder1.val());
            $selectFolder1.remove();
        });
        $selectFolder1.trigger('click');
    });
    $falseBtn.bind('click', function () {closeDiv($fullBox);});
    $trueBtn.bind('click', function () {
        var $privateKeyPath = $privateKeyInput.val();
        var $downloadPath = $downLoadInput.val();
        $obj.setSystemPath($privateKeyPath, $downloadPath);
        closeDiv($fullBox);
    });
    // 显示
    $selectBtn.css({
        'display': 'inline',
        'position': 'relative',
        'top': '-39px',
        'left': '395px',
        'border': '2px solid yellow',
        'background-color': '#444',
        'border-radius': '5px',
        'color': 'white'
    });
    $selectBtn1.css({
        'display': 'inline',
        'position': 'relative',
        'top': '-39px',
        'left': '395px',
        'border': '2px solid yellow',
        'background-color': '#444',
        'border-radius': '5px',
        'color': 'white'
    });
    $settingHeader.append($closeImg);
    $settingBtn.append($trueBtn, $falseBtn);
    $settingContent.append($privateKeyInput, $selectBtn, $downLoadInput, $selectBtn1, $settingBtn);
    $settingBox.append($settingHeader, $settingContent);
    $fullBox.append($settingBox);
    $('body').append($fullBox);
}
// 设置privateKey存储路径, 下载文件路径
Setting.prototype.setSystemPath = function ($privatePath, $downloadPath) {
    var $pathJson = {"privatePath": ($privatePath=="")?baseDir+"/sshKey":$privatePath, "downloadPath":($downloadPath=="")?baseDir+"/downloadFile":$downloadPath};
    var $pathStr = JSON.stringify( $pathJson );
    var $buf = new Buffer( $pathStr );
    fs.exists(dataDir, function (result) {
        // 判断目录是否存在
        if (!result) {
            // 不存在
            fs.mkdir(dataDir, 0755, function (err) {
                if (err) {
                    showErrorMessage("创建用户数据目录失败。");
                }
            });
        }
    });
    fs.open(confFile, 'w', 0644, function (err, fp) {
        if (err) {
            showErrorMessage(err);
        }else {
            fs.write(fp, $buf, function(err) {
                if (err) {
                    showErrorMessage(err);
                }
            });
            fs.close(fp);
        }
    });
}
/* Setting class end */
/* privateKey class start */
function PrivateKey() {
    this.conn = null;
    this.createPrivateKeyBox();
}
// 创建用户选择sshkey的界面
PrivateKey.prototype.createPrivateKeyBox = function() {
    var $obj = this;
    var $fullBox = $('<div class="full-box"></div>');
    var $privateBox = $('<div class="private-box"></div>');
    var $privateHeader = $('<div class="private-header">生成密钥</div>');
    var $closeImg = $('<img src="img/close.png"/>');
    var $privateContent = $('<div class="private-content"></div>');
    var $keyTypeBox = $('<div class="keyTypeBox">密钥类型: </div>');
    var $keyTypeInput = $('<select name="keyType"><option value="0">RSA</option><option value="1">DSA</option></select>');
    var $keyPasswordInput = $('<input type="password" name="keyPassword" placeholder="密钥密码" />');
    var $privateBtn = $('<div class="private-btn"></div>');
    var $trueBtn = $('<button>确定</button>');
    var $falseBtn = $('<button>取消</button>');
    // 事件绑定
    $privateHeader.bind('mousedown', function(event) {moveDiv(event, $privateBox);});
    $closeImg.bind('click', function(){closeDiv($fullBox)});
    $trueBtn.bind('click', function() {
        // 确定按钮按下
        var $keyType = $keyTypeInput.val();
        var $keyPass = $keyPasswordInput.val();
        var $dataJson = {"request":"genKey","keyType":$keyType,"password":$keyPass};
        var $dataStr = JSON.stringify( $dataJson );
        $obj.conn = new WebSocket(localUrl);
        $obj.conn.onopen = function() { this.send( $dataStr ); }
        $obj.conn.onerror = function() { showErrorMessage("连接webSocketServer失败。请启动webSocketServer，重启软件"); }
        $obj.conn.onmessage = function(event) { recvMessage(event, this); }
        closeDiv($fullBox);
    });
    $falseBtn.bind('click', function() {closeDiv($fullBox);});
    // 显示
    $privateHeader.append($closeImg);
    $privateBtn.append($trueBtn, $falseBtn);
    $keyTypeBox.append($keyTypeInput);
    $privateContent.append($keyTypeBox, $keyPasswordInput, $privateBtn);
    $privateBox.append($privateHeader, $privateContent);
    $fullBox.append( $privateBox );
    $('body').append($fullBox);
}
/* privateKey class end */
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
                    if ( $crt.commandStart == '' ) {
                        // 记录还没有输入命令时的命令行信息
                        $crt.commandStart = $.trim( $('.terminal-cursor').parent('div').text() );
                    }
                    if ( $data != '\r' ) {
                        var $sendStr = JSON.stringify({'request': 'data', 'data':$data});
                        $crt.conn.send($sendStr);
                    }else {
                        var $command = $.trim( $('.terminal-cursor').parent('div').text() );
                        $command = $.trim( $command.replace( $crt.commandStart, '') );
                        $command = $.trim( $command.replace(/\xa0/g, ' ') );
                        var $commandList = $command.split(' ');
                        // console.log( $commandList );
                        if ( $commandList[0] == 'rz' ) {
                            // rz 上传文件
                            var $fileInput = $('<input type="file" name="uploadFile" />');
                            $fileInput.css('display', 'none');
                            $fileInput.bind('change', function() {
                                // 发送上传文件命令
                                var $fileName = $fileInput.val().replace(/\\/g, '/');
                                // console.log( $fileName );
                                var $sendStr = JSON.stringify( {"request":"upload","data":$fileName} );
                                // console.log( $sendStr );
                                $crt.conn.send( $sendStr );
                                $fileInput.remove();
                            });
                            $fileInput.trigger('click');
                        }else if ( $commandList[0] == 'sz' && $commandList.length >= 2 ) {
                            // sz 下载文件
                            var $sendStr = JSON.stringify( {"request":"download","data":$commandList[1]} );
                            $crt.conn.send( $sendStr );
                        }else {
                            var $sendStr = JSON.stringify({'request': 'data', 'data':$data});
                            $crt.conn.send($sendStr);
                        }
                        $crt.commandStart = '';
                    }
                }else if ( $data == '\r' ) {
                    // 重新登录
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
        // close the quick connect box
        closeDiv($fullBox);
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
    var $minHeight = Math.floor( win.height / 3 );
    var $minWdith = Math.floor( win.width / 3 );
    var $maxHeight = Math.floor( win.height / 3 * 2 );
    var $maxWidth = Math.floor( win.width / 3 * 2 );
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
    $ulBox.children('li').bind('click', function () {$contextMenu.remove();$crt.term.focus();});
    if ( event.pageX > $maxWidth ) {
        $contextMenu.css('left', event.pageX-110+'px');
    }else {
        $contextMenu.css('left', event.pageX+10+'px');
    }
    if ( event.pageY > $maxHeight ) {
        $contextMenu.css('top', event.pageY-110+'px');
    }else {
        $contextMenu.css('top', event.pageY+10+'px');
    }
    $contextMenu.append($ulBox);
    $('body').append($contextMenu);
}

// 加密文件
function encryptionFile() {
    var $clearText = '';
    var $encrypStr = '';
    var $b = new Base64();

    // 先读取文本中的内容
    fs.readFile(dataFile, function(err, data) {
        if ( err ) {
            showErrorMessage( err );
            return;
        }
        $clearText = data.toString();
        $encrypStr = $b.encode( $clearText );
        fs.open(dataFile, 'w', 0666, function(err, fd) {
            if (err) {
                showErrorMessage( err );
                return;
            }
            fs.write(fd, $encrypStr, function(){});
            fs.close(fd, function() {});
        });
    });
}

// 解密文件
function decryptedFile( $folderObj ) {
    var $clearText = '';
    var $encrypStr = '';
    var $b = new Base64();

    // 先读取文本中的内容
    fs.readFile(dataFile, function(err, data) {
        if ( err ) {
            return '';
        }
        $encrypStr = data.toString();
        $clearText = $b.decode( $encrypStr );
        fs.open(dataFile, 'w', 0666, function(err, fd) {
            if (err) {
                showErrorMessage( err );
                return '';
            }
            fs.write(fd, $clearText, function(){});
            fs.close(fd, function() {});
            // console.log( $clearText );
            // 如果文件内容不为空
            var dataList = null;
            var dataJson = null;
            var data = $.trim( $clearText );
            dataList = data.split('\n');
            // console.log( dataList );
            for (var i=0; i<dataList.length; i++) {
                dataJson = JSON.parse( dataList[i] );
                $folderObj.hostList[ dataJson['nodeName'] ] = dataJson;
            }
        });
    });
}

// 初始化
$(document).ready(function () {
    var $folder = new FolderList();
    $folder.requestFolderList();
    // 事件绑定
    $('.show-btn').bind('click', showList);
    $('.conn').bind('click', createConnectBox);
    $('.folder').bind('click', function () { $folder.createFolderList(); });
    // $('.reload').bind('click', function () { win.reload(); });
    $('.setting').bind('click', function () {
        var $set = new Setting();
    });
    $('.key').bind('click', function() {
        var $key = new PrivateKey();
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
        // 加密数据文件
        // 窗口关闭事件
        // 关闭所有开启的终端
        encryptionFile();
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