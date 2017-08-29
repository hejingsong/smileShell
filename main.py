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

pid = os.getpid()
err_fd = None
parent_path = os.path.abspath( '.' ).replace('\\', '/')
# print parent_path
log_path = parent_path+'/../logs'
data_path = parent_path+'/../data'
key_path = ''
download_path = ''
g_currentUser = getpass.getuser()
g_hostname = socket.gethostname()
g_userConfFile = data_path+'/'+g_hostname+'.conf'
g_userDataFile = data_path+'/'+g_hostname+'.dat'

def get_user_setting_path():
    global key_path
    global download_path
    try:
        fp = open( g_userConfFile, 'rb' )
        buf = fp.read()
        fp.close()
        dataJson = json.loads(buf)
        key_path = dataJson['privatePath']
        download_path = dataJson['downloadPath']
    except IOError, KeyError:
        key_path = parent_path+'/../sshKey'
        download_path = parent_path+'/../downloadFile'
get_user_setting_path()

def write_error( err_msg ):
    print >> err_fd, err_msg
    err_fd.flush()

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
        self.select_list = list()
        self.handler = re.compile(r'^.*pwd\r\n(.*)\r\n.*$')

    def __del__(self):
        self.destroy()

    def destroy(self):
        try:
            self.chan.close()
            self.clt.close()
        except:
            pass

    def getCurrentPath(self):
        self.select_list.remove(self.chan)
        try:
            self.chan.sendall('\x15pwd\r')
            recvData = self.chan.recv(1024)
            if len(recvData) == 0: return '~'
            currentPath = self.handler.findall(recvData)
            if len(currentPath) == 0: return '~'
            else: return currentPath[0]
        except:
            write_error(  "error: rz/sz pwd fail." )
            return '~'
        finally:
            self.select_list.append(self.chan)

    def uploadFile(self, fileName):
        remote_path = self.getCurrentPath()
        try:
            sftpClient = paramiko.SFTPClient.from_transport(self.clt.get_transport())
            file = fileName.split('/')[-1]
            sftpClient.put(fileName, remote_path+'/'+file)
        except paramiko.SSHException as e:
            write_error( "error: update file, " + str(e) )
        except IOError as e:
            write_error( "error: update file, " + str(e) )
        finally:
            sftpClient.close()

    def downloadFile(self, fileName):
        get_user_setting_path()
        remotePath = self.getCurrentPath()
        remoteFile = remotePath + '/' + fileName
        if not os.path.exists(download_path):
            os.mkdir(download_path, 0755)
        try:
            sftpClient = paramiko.SFTPClient.from_transport(self.clt.get_transport())
            sftpClient.get(remoteFile, download_path+'/'+fileName)
        except paramiko.SSHException as e:
            write_error( "error: download file, " + str(e) )
        except IOError as e:
            write_error( "error: download file, " + str(e) )
        finally:
            sftpClient.close()
    
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
                    password=self.hostInfo['password'],
                    key_filename=self.hostInfo['privateKey'].replace('\\', '/')
                )

            self.chan = self.clt.invoke_shell(term='xterm', width=self.size[0], height=self.size[1])
        except socket.error as e:
            ret['status'] = False
            ret['msg'] = u'连接ssh服务器失败。请检查主机和端口。'
        except paramiko.BadHostKeyException as e:
            ret['status'] = False
            ret['msg'] = u'错误的密钥文件。'
        except paramiko.AuthenticationException as e:
            ret['status'] = False
            ret['msg'] = u'用户名或密码错误。'
        except paramiko.SSHException as e:
            write_error( "error: link ssh server fail, " + str(e) )
            ret['status'] = False
            ret['msg'] = u'在连接ssh服务器的时候发生一个未知错误。'
        return ret

    def session(self, ws):
        data = ''
        commandList = list()
        command = ''
        self.select_list.append(self.chan)
        self.select_list.append(ws.webSock)
        while 1:
            r,w,e = select.select(self.select_list, [], [])
            if self.chan in r:
                try:
                    data += self.chan.recv(1024)
                    if len(data) == 0: break
                    _x = paramiko.py3compat.u(data)
                except UnicodeDecodeError:
                    continue
                except socket.timeout:
                    pass
                else:
                    data = ''
                    _resMes = json.dumps({'response': 'data', 'data': _x})
                    ws.sendMessage(_resMes)
            if ws.webSock in r:
                recvData = ws.recvMessage
                # print recvData
                if recvData['request'] == 'resize':
                    self.chan.resize_pty(width=recvData['cols'], height=recvData['rows'])
                elif recvData['request'] == 'upload' and recvData['data'] != '':
                    # 上传文件
                    ws.sendMessage(json.dumps({'response': 'data', 'data': '\r\n'}))
                    self.uploadFile(recvData['data'])
                    self.chan.sendall('\r')
                elif recvData['request'] == 'download' and recvData['data'] != '':
                    # 下载文件
                    ws.sendMessage(json.dumps({'response': 'data', 'data': '\r\n'}))
                    self.downloadFile(recvData['data'])
                    self.chan.sendall('\r')
                elif recvData['request'] == 'quit':
                    # 用户选择退出
                    break
                else:
                    _x = recvData['data']
                    self.chan.send(_x)

    @classmethod
    def genKeys(self, _key_json):
        # 生成密钥对
        ret = dict(
            status=True,
            msg=''
        )
        get_user_setting_path()
        if not os.path.exists(key_path):
            os.mkdir( key_path )
        primaryFile = '%s/Identity'%(key_path,)
        publicFile = '%s/Identity.pub'%(key_path,)
        privateFp = open(primaryFile, 'wb')
        publicFp = open(publicFile, 'wb')
        try:
            if _key_json['keyType'] == '0':
                key = paramiko.rsakey.RSAKey.generate(2048)
            else:
                key = paramiko.dsskey.DSSKey.generate(2048)
            if len(_key_json['password']) == 0:
                key.write_private_key(privateFp)
            else:
                key.write_private_key(privateFp, password=str.encode(_key_json['password'].encode()))
        except IOError as e:
            write_error( "error: gen key, " + str(e) )
            ret['status'] = False
            ret['mes'] = 'there was an error writing to the file'
        except paramiko.SSHException:
            write_error( "error: gen key, " + str(e) )
            ret['status'] = False
            ret['mes'] = 'the key is invalid'
        else:
            for data in [key.get_name(),
                         ' ',
                         key.get_base64(),
                         " %s@%s"%(g_currentUser, g_hostname)]:
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

    def destroy(self):
        try:
            self.webSock.shutdown(socket.SHUT_RDWR)
            self.webSock.close()
            self.ssh.destroy()
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
        if len(self.data) == 0:
            _buffer_json['request'] = 'quit'
            _buffer_json['data'] = ''
        else:
            _buffer_length += len( self.data )
            _recv_buffer += self.data
            _buffer_utf8 = self.parse_data( _recv_buffer )
            _buffer_unicode = str( _buffer_utf8 ).decode('utf8','ignore')
            try:
                _buffer_json = json.loads(_buffer_utf8)
            except:
                pass
            else:
                self.data = ''
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
            write_error( 'session end.' )
            # 会话结束
            _resMes = json.dumps({'response': 'logout'})
            self.sendMessage(_resMes)
            self.ssh.destroy()

    def genKey(self, _key_json):
        _resMes = ''
        ret = Ssh.genKeys(_key_json)
        if not ret['status']:
            _resMes = json.dumps({'response':'genKey','data':'false', 'info':ret['mes']})
        else:
            _resMes = json.dumps({'response':'genKey','data':'true'})
        return self.sendMessage(_resMes)

    def run(self):
        global pid
        while True:
            if not self.handshaken:
                self.handShake()
                # 不是webSocket
                if not self.handshaken: break
            else:
                _buffer_json = self.recvMessage
                if _buffer_json['request'] == 'init':
                    self.session(_buffer_json)
                elif _buffer_json['request'] == 'genKey':
                    self.genKey(_buffer_json)
                elif _buffer_json['request'] == 'quit':
                    break
                elif _buffer_json['request'] == 'systemExit':
                    os.kill(pid, signal.SIGTERM)
                elif _buffer_json['request'] == '':
                    continue
                else:
                    break
                self.data = ''
        self.destroy()

class WebSocketServer( object ):
    __instance = None
    __is_run = True

    def __init__(self):
        self.sock = None
        
    def __del__(self):
        self.sock.close()

    def __new__(self, *args, **kwargs):
        if not self.__instance:
            self.__instance = object.__new__(self, *args, **kwargs)
        return self.__instance

    def start(self):
        try:
            self.sock = socket.socket( socket.AF_INET, socket.SOCK_STREAM )
            self.sock.setsockopt( socket.SOL_SOCKET, socket.SO_REUSEADDR, 1 )
            self.sock.bind(( '', 12345 ))
            self.sock.listen(1)
        except socket.error:
            write_error( "fatal error: create socket fail." )
            sys.exit(1)
        while self.__is_run:
            conn, addr = self.sock.accept()
            webSocketClient = WebSocket( conn, addr[0] )
            webSocketClient.start()

    @classmethod
    def systemExit(self, signo, frame):
        # 终止信号 貌似在windows上不管用
        os.remove(parent_path+'/../~smileShell.exe')
        self.__is_run = False

def init_environment():
    global err_fd
    
    if not os.path.exists(log_path):
        os.mkdir( log_path )

    err_fd = open( "%s/err_%s.log"%(log_path, time.strftime("%Y-%m-%d")), 'wb' )

if __name__ == "__main__":
    init_environment()
    write_error( "pid: %d" %(pid, ) )
    signal.signal(signal.SIGTERM, WebSocketServer.systemExit)
    wss = WebSocketServer()
    wss.start()