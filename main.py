#! /usr/bin/env python
#_*_ coding:utf-8 _*_

import os
import re
import sys
import time
import json
import pickle
import random
import struct
import base64
import select
import socket
import signal
import hashlib
import getpass
import paramiko
import traceback
import threading

programPid = None
parent_path = os.path.dirname( os.path.abspath( 'main.py' ) ).replace('\\', '/')
log_path = parent_path+'/../logs'
data_path = parent_path+'/../data'
conf_path = parent_path+'/../conf'
key_path = parent_path+'/../sshKey'
download_path = parent_path + '/../downloadFiles'

g_currentUser = getpass.getuser()
g_userConfFile = conf_path+'/'+g_currentUser+'.conf'
g_userDataFile = data_path+'/'+g_currentUser+'.dat'

def setPrivateSshPath(path):
    if not os.path.exists(conf_path):
        os.mkdir(conf_path)
    if path == '':
        path = key_path
    path = path.replace('\\', '/');
    try:
        fp = open(g_userConfFile, 'wb')
        fp.write(path)
        fp.close()
    except IOError:
        return False
    else:
        return True

def getUserFolder():
    # 获取当前登录用户的配置文件 这个配置文件是用python pickle生成的文件
    try:
        fp = open( g_userDataFile, 'rb' )
    except IOError:
        return False
    else:
        data = pickle.load(fp)
        fp.close()
        return data

def setUserFolder( data ):
    # 设置用户的配置文件
    if not os.path.exists(data_path):
        os.mkdir(data_path, 0755)
    try:
        fp = open(g_userDataFile, 'wb')
    except IOError:
        return False
    else:
        pickle.dump(data, fp)
        fp.close()
        return True

def write_log(status, msg):
    current_date = time.strftime( "%Y-%m-%d" )
    current_time = time.strftime( "%H:%M:%S" )
    file_name = log_path + '/%s.log' % (current_date,)
    content = "[%s]\t[%s]\t%s\r\n" % ( status, current_time, msg )

    if not os.path.exists( log_path ):
        os.mkdir( log_path )

    with open( file_name, 'ab+' ) as fp:
        fp.write(content)

class SshException( Exception ):
    pass

class WebSocketException( Exception ):
    pass 

class Ssh( object ):
    ''' ssh类:
        1. 负责将websocket接受的数据发送到openssh-server中
    '''
    def __init__(self, hostInfo, cols, rows):
        self.hostInfo = hostInfo
        self.size = (cols, rows)
        self.clt = None
        self.chan = None
        self.handler = re.compile(r'^.*pwd\r\n(.*)\r\n.*$')

    def __del__(self):
        try:
            self.chan.close()
            self.clt.close()
        except:
            pass

    def getCurrentPath(self):
        try:
            self.chan.sendall('\x15pwd\r')
            recvData = self.chan.recv(1024)
            if len(recvData) == 0: return '~'
            currentPath = self.handler.findall(recvData)
            if len(currentPath) == 0: return '~'
            else: return currentPath[0]
        except:
            return '~'

    def uploadFile(self, fileName):
        retMes = dict(status=False,msg='')
        fileList = fileName.split(';')
        remote_path = self.getCurrentPath()
        try:
            sftpClient = paramiko.SFTPClient.from_transport(self.clt.get_transport())
            for item in fileList:
                item = item.replace('\\', '/')
                file = item.split('/')[-1]
                sftpClient.put(item, remote_path+'/'+file)
        except paramiko.SSHException:
            retMes['mes'] = '发送失败。'
        else:
            retMes['status'] = True
            retMes['mes'] = '发送成功'
        finally:
            sftpClient.close()
        return retMes

    def downloadFile(self, fileName):
        retMes = dict(status=False,msg='')
        
        remotePath = self.getCurrentPath()
        remoteFile = remotePath + '/' + fileName
        if not os.path.exists(download_path):
            os.mkdir(download_path, 0755)
        try:
            sftpClient = paramiko.SFTPClient.from_transport(self.clt.get_transport())
            sftpClient.get(remoteFile, download_path+'/'+fileName)
        except paramiko.SSHException:
            retMes['mes'] = '下载失败。'
        except IOError:
            retMes['mes'] = '没有该文件。'
        else:
            retMes['status'] = True
            retMes['mes'] = '下载成功。'
        finally:
            sftpClient.close()
        return retMes
    
    def login(self):
        ret = dict(
            status=True,
            msg=''
        )
        try:
            self.clt = paramiko.client.SSHClient()
            self.clt.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            if int(self.hostInfo['loginType']) == 0:
                # 密码登录
                self.clt.connect(
                    hostname=self.hostInfo['host'],
                    port=int(self.hostInfo['port']),
                    username=self.hostInfo['user'],
                    password=self.hostInfo['password'],
                )
            else:
                # 秘钥登录
                self.clt.connect(
                    hostname=self.hostInfo['host'],
                    port=int(self.hostInfo['port']),
                    username=self.hostInfo['user'],
                    key_filename=self.hostInfo['privateKey'].replace('\\', '/')
                )

            self.chan = self.clt.invoke_shell(term='linux', width=self.size[0], height=self.size[1])
        except socket.error:
            ret['status'] = False
            ret['msg'] = u'连接ssh服务器失败。请检查主机和端口。'
        except paramiko.BadHostKeyException:
            ret['status'] = False
            ret['msg'] = u'错误的密钥文件。'
        except paramiko.AuthenticationException:
            ret['status'] = False
            ret['msg'] = u'用户名或密码错误。'
        except paramiko.SSHException:
            ret['status'] = False
            ret['msg'] = u'在连接ssh服务器的时候发生一个未知错误。'
        return ret

    def session(self, ws):
        data = ''
        commandList = list()
        command = ''
        while 1:
            r,w,e = select.select([self.chan, ws.webSock], [], [])
            if self.chan in r:
                try:
                    try:
                        data += self.chan.recv(1024)
                        _x = paramiko.py3compat.u(data)
                    except UnicodeDecodeError:
                        continue
                    else:
                        data = ''
                        if len( _x ) == 0: break
                        _resMes = json.dumps({'response': 'data', 'data': _x})
                        ws.sendMessage(_resMes)
                except socket.timeout: pass
            if ws.webSock in r:
                recvData = ws.recvMessage
                if recvData['request'] == 'resize':
                    self.chan.resize_pty(width=recvData['cols'], height=recvData['rows'])
                elif recvData['request'] == 'upload':
                    if recvData['data'] != '':
                        ws.sendMessage(json.dumps({'response': 'data', 'data': '\r\n'}))
                        self.uploadFile(recvData['data'])
                        self.chan.sendall('\r')
                else:
                    _x = recvData['data']
                    if len(_x) == 0: break
                    if _x != '\r':
                        command += _x
                    elif command != '':
                        commandList = command.split()
                        command = ''
                        if commandList[0] == 'rz':
                            # 向webSocketClient发送上传文件事件
                            sendStr = json.dumps({'response':'upload'})
                            ws.sendMessage(sendStr)
                            _x = '\x15'
                        elif commandList[0] == 'sz' and len(commandList) > 1:
                            # 向webSocketClient发送下载文件事件
                            ws.sendMessage(json.dumps({'response': 'data', 'data': '\r\n'}))
                            self.downloadFile(commandList[1])
                            _x = '\r'
                    self.chan.send(_x)
            ws.data = ''

    @classmethod
    def genKeys(self):
        # 生成密钥对
        ret = dict(
            status=True,
            msg=''
        )
        user = getpass.getuser()
        userConfigFile = conf_path+'/'+user+'.conf'
        keyPath = ''
        if not os.path.isfile(userConfigFile):
            keyPath = key_path
        else:
            with open(userConfigFile, 'rb') as fp:
                keyPath = fp.read()
        if not os.path.exists(keyPath):
            os.mkdir(keyPath)
        primaryFile = '%s/Identity'%(keyPath,)
        publicFile = '%s/Identity.pub'%(keyPath,)
        privateFp = open(primaryFile, 'wb')
        publicFp = open(publicFile, 'wb')
        try:  
            key = paramiko.rsakey.RSAKey.generate(2048)  
            key.write_private_key(privateFp)
        except IOError:
            write_log('error', 'genKeys: there was an error writing to the file')
            ret['status'] = False
            ret['mes'] = 'there was an error writing to the file'
        except paramiko.SSHException:
            write_log('error', 'genKeys: there was an error writing to the file')
            ret['status'] = False
            ret['mes'] = 'the key is invalid'
        else:
            for data in [key.get_name(),
                         ' ',
                         key.get_base64(),
                         " %s@%s"%(user, socket.gethostname())]:
                publicFp.write(data)
        finally:
            privateFp.close()
            publicFp.close()
            ret['mes'] = 'success'
        return ret

class WebSocket( threading.Thread ):
    ''' WebSocket类
        1. 负责连接nw.js发起的连接， 并且将数据转发到Ssh类中
    '''
    # GUID websocket统一标志
    GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

    def __init__(self, conn, clientIp, path='/'):
        self.webSock = conn
        self.clientIp = clientIp
        self.path = path
        self.ssh = None
        self.data = ''
        self.code_length = 0
        self.headers_length = 0
        self.handshaken = False
        threading.Thread.__init__(self)

    def __del__(self):
        try:
            self.webSock.close()
            del self.ssh
            write_log('success', 'Thread %s is closed. '%(self.clientIp,))
        except:
            pass

    def get_data_length(self, data):
        ''' 获取接受数据的长度 '''
        self.code_length = ord(data[1]) & 127
        received_length = 0
        if self.code_length == 126:
            self.code_length = struct.unpack('>H', str(data[2:4]))[0]
            self.headers_length = 8
        elif self.code_length == 127:
            self.code_length = struct.unpack('>Q', str(data[2:10]))[0]
            self.headers_length = 14
        else:
            self.headers_length = 6
        self.code_length = int(self.code_length)
        return self.code_length

    def parse_data(self, data):
        self.code_length = ord(data[1]) & 127
        if self.code_length == 126:
            self.code_length = struct.unpack('>H', str(data[2:4]))[0]
            masks = data[4:8]
            data = data[8:]
        elif self.code_length == 127:
            self.code_length = struct.unpack('>Q', str(data[2:10]))[0]
            masks = data[10:14]
            data = data[14:]
        else:
            masks = data[2:6]
            data = data[6:]
        i = 0  
        raw_str = ''  

        for d in data:  
            raw_str += chr(ord(d) ^ ord(masks[i%4]))  
            i += 1  
        return raw_str

    def sendMessage(self, msg):
        _msg_utf8 = msg.encode('utf8')
        _msg_length = len( _msg_utf8 )
        _back_str = ''
        _back_str += '\x81'

        if _msg_length <= 125:  
            _back_str += chr(_msg_length)
        elif _msg_length <= 65535 :  
            _back_str += struct.pack('b', 126) 
            _back_str += struct.pack('>h', _msg_length)
        elif _msg_length <= (2**64-1):
            _back_str += struct.pack('b', 127)
            _back_str += struct.pack('>q', _msg_length)
        else :  
            pass
        _back_str += _msg_utf8
        if _back_str != None and len(_back_str) > 0:
            self.webSock.send(_back_str)

    def handShake(self):
        _recv_buffer = ''
        _headers = dict()
        _recv_buffer += bytes.decode( self.webSock.recv(1024) )
        if _recv_buffer.find('\r\n\r\n') != -1:
            _header, _data = _recv_buffer.split('\r\n\r\n', 1)
            for _line in _header.split('\r\n')[1:]:
                _k, _v = _line.split(': ', 1)
                _headers[_k] = _v
            _headers['Location'] = ("ws://%s%s" %(_headers["Host"], self.path))
            _key = _headers['Sec-WebSocket-Key']
            _token = base64.b64encode(hashlib.sha1(str.encode(str(_key + self.GUID))).digest())
            _handshake="HTTP/1.1 101 Switching Protocols\r\n"\
                "Upgrade: websocket\r\n"\
                "Connection: Upgrade\r\n"\
                "Sec-WebSocket-Accept: "+bytes.decode(_token)+"\r\n"\
                "WebSocket-Origin: "+str(_headers["Origin"])+"\r\n"\
                "WebSocket-Location: "+str(_headers["Location"])+"\r\n\r\n"
            self.webSock.send( str.encode( str( _handshake ) ) )
            self.handshaken = True
            write_log('success', '%s is linked.' %(_headers['Host'],))

    @property
    def recvMessage(self):
        _buffer_length = 0
        _recv_buffer = ''
        _buffer_utf8 = ''
        _buffer_unicode = ''
        _buffer_json = dict(
            request='',
            data=''
        )
        self.data += self.webSock.recv(128)
        if len(self.data) <= 0:
            _buffer_json['request'] = 'quit'
            _buffer_json['data'] = ''
        else:
            _buffer_length += len( self.data )
            _recv_buffer += self.data
            _buffer_utf8 = self.parse_data( _recv_buffer )
            _buffer_unicode = str( _buffer_utf8 ).decode('utf8','ignore')
            try:
                _buffer_json = json.loads(_buffer_utf8)
            except ValueError:
                pass
        return _buffer_json

    def session(self, recvMes):
        # 当请求是初始化的时候就连接ssh服务器
        self.ssh = Ssh( recvMes['data'], recvMes['cols'], recvMes['rows'] )
        ret = self.ssh.login()
        _resMes = ''
        if not ret['status']:
            # 用户名或密码错误情况
            _resMes = json.dumps({'response': 'init', 'data':'false', 'errMes':ret['msg']})
            self.sendMessage(_resMes)
        else:
            _resMes = json.dumps({'response': 'init', 'data':'true'})
            self.sendMessage(_resMes)
            # 登录成功 进行会话
            self.ssh.session(self)
            # 会话结束
            _resMes = json.dumps({'response': 'logout'})
            self.sendMessage(_resMes)
            self.ssh = None

    def dealFolder(self, recvMes):
        # 获取 设置 用户保存的连接列表
        _resMes = ''
        if recvMes['data'] == 'get':
            ret = getUserFolder()
            if not ret:
                _resMes = json.dumps({'response': 'folder', 'data': {}})
            else:
                _resMes = json.dumps({'response': 'folder', 'data': ret})
        else:
            ret = setUserFolder(recvMes['info'])
            if not ret:
                _resMes = json.dumps({'response': 'folder'})
            else:
                _resMes = json.dumps({'response': 'folder', 'info': recvMes['data']})
        return self.sendMessage(_resMes)

    def setting(self, recvMes):
        _resMes = ''
        if recvMes['data'] == 'privateKeyPath':
            ret = setPrivateSshPath(recvMes['info'])
            if not ret:
                _resMes = json.dumps({'response':'setting', 'data': 'false'})
            else:
                _resMes = json.dumps({'response':'setting', 'data': 'true'})

        return self.sendMessage(_resMes)

    def getKey(self):
        _resMes = ''
        ret = Ssh.genKeys()
        if not ret['status']:
            _resMes = json.dumps({'response':'genKey','data':'false', 'info':ret['mes']})
        else:
            _resMes = json.dumps({'response':'genKey','data':'true'})
        return self.sendMessage(_resMes)

    def run(self):
        write_log('success', 'Thread %s is start.'%(self.clientIp,))
        while True:
            if not self.handshaken:
                self.handShake()
            else:
                _buffer_json = self.recvMessage
                if _buffer_json['request'] == 'init':
                    self.session(_buffer_json)
                elif _buffer_json['request'] == 'folder':
                    self.dealFolder(_buffer_json)
                elif _buffer_json['request'] == 'setting':
                    self.setting(_buffer_json)
                elif _buffer_json['request'] == 'getKey':
                    self.getKey()
                elif _buffer_json['request'] == 'quit':
                    write_log('success', 'Thread %s is stop.'%(self.clientIp,))
                    break
                elif _buffer_json['request'] == 'systemExit':
                    os.kill(programPid, signal.SIGILL)
                elif _buffer_json['request'] == '':
                    continue
                else:
                    break
                self.data = ''

class WebSocketServer( object ):
    def __init__(self):
        self.sock = None

    def start(self):
        try:
            self.sock = socket.socket( socket.AF_INET, socket.SOCK_STREAM )
            self.sock.setsockopt( socket.SOL_SOCKET,socket.SO_REUSEADDR,1 )
            self.sock.bind(( '', 12345 ))
            self.sock.listen(1)
        except socket.error:
            write_log('error', 'open WebSocketServer error.')
            sys.exit(1)
        while True:
            conn, addr = self.sock.accept()
            clientIp = addr[0]
            webSocketClient = WebSocket( conn, clientIp )
            webSocketClient.start()

def systemExit(a, b):
    # webSocketClient 发送终止信号
    sys.exit(0)

if __name__ == "__main__":
    programPid = os.getpid()
    signal.signal(signal.SIGILL, systemExit)
    wss = WebSocketServer()
    wss.start()