#! /usr/bin/env python
#_*_ coding:utf-8 _*_

import os
import sys
import json
import time
import pickle
import struct
import base64
import select
import socket
import hashlib
import paramiko
import threading

import ssh
import logger
import config

class WebSocketClient(object):
    '''WebSocketClient用于与前端通讯'''
    __instance = None
    __run_state = True
    __read_list = list()
    __write_list = list()
    __exec_list = list()
    __clients = list()
    __fd = -1
    # GUID websocket统一标志
    GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

    def __new__(self, *args, **kwargs):
        if not self.__instance:
            self.__instance = object.__new__(self, *args, **kwargs)
        return self.__instance

    def __init__(self, fd):
        self.__fd = fd
        self.data = ''
        self.data_len = 0
        self.code_length = 0
        self.headers_length = 0
        self.__logger = logger.Logger()

    def __del__(self):
        self.__fd.close()

    def handshake(self):
        '''与前端握手, 实现websocket协议'''
        _recv_buffer = ''
        _headers = dict()
        _recv_buffer += bytes.decode( self.__fd.recv(1024) )
        if _recv_buffer.find('\r\n\r\n') != -1:
            _header, _data = _recv_buffer.split('\r\n\r\n', 1)
            for _line in _header.split('\r\n')[1:]:
                _k, _v = _line.split(': ', 1)
                _headers[_k] = _v
            _headers['Location'] = ("ws://%s%s" %(_headers["Host"], '/'))
            _key = _headers['Sec-WebSocket-Key']
            _token = base64.b64encode(hashlib.sha1(str.encode(str(_key + self.GUID))).digest())
            _handshake="HTTP/1.1 101 Switching Protocols\r\n"\
                "Upgrade: websocket\r\n"\
                "Connection: Upgrade\r\n"\
                "Sec-WebSocket-Accept: "+bytes.decode(_token)+"\r\n"\
                "WebSocket-Origin: "+str(_headers["Origin"])+"\r\n"\
                "WebSocket-Location: "+str(_headers["Location"])+"\r\n\r\n"
            self.__fd.send( str.encode( str( _handshake ) ) )
            # 握手成功之后, 添加到监听列表
            self.__read_list.append(self.__fd)
            return True
        else:
            return False

    def get_data_length(self, msg):
        # 获取接受数据的长度        
        self.code_length = ord(msg[1]) & 127
        if self.code_length == 126:
            self.code_length = struct.unpack('>H', str(msg[2:4]))[0]
            self.headers_length = 8
        elif self.code_length == 127:
            self.code_length = struct.unpack('>Q', str(msg[2:10]))[0]
            self.headers_length = 14
        else:
            self.headers_length = 6
        self.code_length = int(self.code_length)
        return self.code_length

    def parse_data(self, data):
        # 解析接受到的数据
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
        # 发送字符串
        message = msg.encode('utf-8')
        back_str = []
        back_str.append('\x81')
        data_length = len(message)

        if data_length <= 125:
            back_str.append(chr(data_length))
        elif data_length <= 65535 :
            back_str.append(struct.pack('b', 126))
            back_str.append(struct.pack('>h', data_length))
        elif data_length <= (2^64-1):
            back_str.append(struct.pack('b', 127))
            back_str.append(struct.pack('>q', data_length))
        else:
            pass
        
        data = ''
        for c in back_str:
            data += c

        back_str = str(data) + message

        if back_str != None and len(back_str) > 0:
            self.__fd.sendall(back_str)

    def recvMessage(self):
        '''接受前端传来的数据, 并且转换为json格式'''
        _buffer_length = 0
        _recv_buffer = ''
        _buffer_utf8 = ''
        _buffer_unicode = ''
        tmp_data = ''
        _buffer_json = dict(
            request='',
            data=''
        )
        tmp_data = self.__fd.recv(128)
        if len(tmp_data) <= 0:
            return None
        if self.code_length == 0:
            self.get_data_length(tmp_data)

        self.data_len += len(tmp_data)
        self.data += tmp_data
        if self.data_len - self.headers_length < self.code_length:
            return _buffer_json
        else:
            _buffer_utf8 = self.parse_data(self.data)
            _buffer_unicode = str(_buffer_utf8).decode('utf-8', 'ignore')
        if len(self.data) == 0:
            _buffer_json['request'] = 'quit'
            _buffer_json['data'] = ''
        else:
            _buffer_json = json.loads(_buffer_unicode)

        self.data = ''
        self.code_length = 0
        self.data_len = 0
        return _buffer_json

    def sendFolderList(self):
        ''' 发送用户保存的链接, 现在已经不使用, 已经由前端nodejs完成 '''
        response = dict(response='FolderList', data=None)
        if os.path.exists(config.data_file):
            with open(config.data_file, 'ab+') as fp:
                data = pickle.load(fp)
            response['data'] = data

        self.sendMessage( json.dumps(response) )

    def readConfig(self):
        ''' 读取配置文件, 现在已经不使用, 已经由前端nodejs完成 '''
        config_obj = dict(down_dir='', key_dir='')
        if os.path.exists(config.conf_file):
            with open(config.conf_file, 'rb') as fp:
                line = fp.readline()
                obj = line.split('=', 1)
                config_obj[ obj[0].strip() ] = obj[1].strip()

        if config_obj['down_dir'] != '':
            config.down_dir = config_obj['down_dir']

        if config_obj['key_dir'] != '':
            config.key_dir = config_obj['key_dir']

    def addClient(self, clt):
        # 添加一个ssh连接
        self.__read_list.append(clt.chan)
        self.__clients.append(clt)

    def delClient(self, clt):
        # 删除一个ssh连接
        self.__read_list.remove(clt.chan)
        self.__clients.remove(clt)
        clt.__del__()

    def findClientByChan(self, chan):
        # 通过chan来查询ssh实例, 失败返回None
        clt = None
        for clt in self.__clients:
            if chan == clt.chan:
                break
        if clt is not None and chan == clt.chan:
            return clt
        else:
            return None

    def findClientById(self, mid):
        # 通过id来查询ssh实例, 失败返回None
        clt = None
        for clt in self.__clients:
            if mid == clt.id:
                break
        if clt is not None and mid == clt.id:
            return clt
        else:
            return None

    def login(self, data):
        # 登录
        response = dict(response='login', data=None)
        sshclient = ssh.Ssh(**data)
        response['data'] = sshclient.login()
        if response['data']['status']:  # 如果登录成功, 就添加sshclient
            self.addClient(sshclient)

        self.__logger.write_log(0, '%s request login %s:%s. status: %s'%(
            data['user'],
            data['host'],
            data['port'],
            response['data']['data'])
        )
        self.sendMessage( json.dumps(response) )
        
    def session(self, data):
        # 会话
        response = dict(response='data', data=None)
        clt = self.findClientById(data['id'])
        if clt is None: return
        clt.session(data['data'])

    def resize(self, data):
        # 改变终端大小
        response = dict(response='data', data=None)
        clt = self.findClientById(data['id'])
        if clt is None: return
        clt.resize(data['cols'], data['rows'])

    def createKey(self, data):
        # 创建sshkey
        response = dict(response='key', data=None)
        response['data'] = ssh.Ssh.createKey(data['type'], data['passwd'], data['path'])
        return response

    def config(self, data):
        # 配置
        if data['downloadPath'] != '':
            config.down_dir = data['downloadPath']
        if data['sshKeyPath'] != '':
            config.key_dir = data['sshKeyPath']

    def upload(self, ssh_clt, data, remote_path):
        response = dict(response='upload', data=None)
        response['data'] = ssh_clt.upload(data, remote_path)
        self.sendMessage( json.dumps(response) )

    def download(self, ssh_clt, path, data, remote_path):
        response = dict(response='download', data=None)
        response['data'] = ssh_clt.download(path, data, remote_path)
        self.sendMessage( json.dumps(response) )

    def app_close(self, data):
        # 退出时的准备工作
        self.__logger.write_log(0, 'application goto down.')
        self.__run_state = False

    def message_read_handle(self):
        '''当前端传来信息时, 执行的函数'''
        msg_json = self.recvMessage()
        if msg_json is None:
            self.__run_state = False
        ret = None
        if msg_json['request'] == 'login':          # 请求登录
            ''' 由于登录是阻塞的, 所以利用线程, 避免阻塞进程 '''
            threading.Thread(target=self.login, args=(msg_json['data'], )).start()

        elif msg_json['request'] == 'data':         # 请求通信
            ret = self.session(msg_json['data'])

        elif msg_json['request'] == 'resize':       # 请求改变终端大小
            ret = self.resize(msg_json['data'])

        elif msg_json['request'] == 'createKey':    # 请求创建sshkey
            ret = self.createKey(msg_json['data'])

        elif msg_json['request'] == 'config':       # 请求配置 -- 现在已经不用
            ret = self.config(msg_json['data'])

        elif msg_json['request'] == 'upload':       # 请求上传文件
            clt = self.findClientById( msg_json['data']['id'] )
            if clt is None: return None
            self.__read_list.remove(clt.chan)

            remote_path = clt.getCurrentPath()
            self.session( dict(id=msg_json['data']['id'], data='\x15\r') )

            threading.Thread(target=self.upload, args=(clt, msg_json['data']['data'], remote_path)).start()
            self.__read_list.append(clt.chan)

        elif msg_json['request'] == 'download':     # 请求下载文件
            clt = self.findClientById( msg_json['data']['id'] )
            if clt is None: return None
            self.__read_list.remove(clt.chan)

            remote_path = clt.getCurrentPath()
            self.session( dict(id=msg_json['data']['id'], data='\x15\r') )

            threading.Thread(target=self.download, args=(clt, msg_json['data']['path'], msg_json['data']['data'], remote_path)).start()
            self.__read_list.append( clt.chan )

        elif msg_json['request'] == 'app_close':    # app 退出
            self.app_close(msg_json['data'])

        self.sendMessage( json.dumps(ret) )

    def message_write_handle(self, reads):
        '''当openssh传来信息时, 执行的函数'''
        msg = dict( response='data', data=dict())
        for r in reads:
            sshclient = self.findClientByChan(r)
            if sshclient is None: continue
            msg['data']['id'] = sshclient.id
            buf = sshclient.read()
            if buf is None:
                msg['data']['data'] = 'logout'
                self.delClient(sshclient)
            else:
                msg['data']['data'] = buf
            self.sendMessage( json.dumps(msg) )


    def run(self):
        while(self.__run_state):
            ''' 循环监听, 间隔时间为500ms '''
            r,w,x = select.select(self.__read_list, self.__write_list, self.__exec_list, 0.5)
            if self.__fd in r:
                self.message_read_handle()
            else:
                self.message_write_handle(r)
        # 服务停止, 删除所有的ssh连接
        for clt in self.__clients:
            self.delClient(clt)

class WebSocketServer(object):
    '''负责监听websocket连接, 成功握手之后退出'''
    __instance = None   

    def __new__(self, *args, **kwargs):
        if not self.__instance:
            self.__instance = object.__new__(self, *args, **kwargs)
        return self.__instance

    def __init__(self):
        self.__listenfd = None
        # 在前端已经实现
        # if not os.path.exists(config.data_dir):
        #     os.mkdir(config.data_dir, config.dir_mode)
        if not os.path.exists(config.conf_dir):
            os.mkdir(config.conf_dir, config.dir_mode)
        if not os.path.exists(config.down_dir):
            os.mkdir(config.down_dir, config.dir_mode)
        if not os.path.exists(config.log_dir):
            os.mkdir(config.log_dir, config.dir_mode)
        if not os.path.exists(config.key_dir):
            os.mkdir(config.key_dir, config.dir_mode)
        self.__logger = logger.Logger()

    def __del__(self):
        self.__logger.write_log(0, 'WebSocketServer is stop.')
        self.__listenfd.close()

    def start(self):
        try:
            self.__listenfd = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.__listenfd.bind((config.sock_addr, config.sock_port))
            self.__listenfd.listen(1)
        except socket.error as err:
            self.__logger.write_log(2, str(err))
            sys.exit(-1)

        # 持续监听, 直到websocket连接才退出
        wsc = None
        while(1):
            clt, clt_info = self.__listenfd.accept()
            wsc = WebSocketClient(clt)
            if wsc.handshake():
                self.__logger.write_log(0, "client is running. server goto destroy.")
                break
            else:
                self.__logger.write_log(0, "%s:%s is connect, but not websocket protocols." %clt_info)
                clt.close()

        return wsc