#! /usr/bin/env python
#_*_ coding:utf-8 _*_

import struct
import weakref
import threading

import ssh
import basesocket

"""
接受协议
login: 主协议(1字节) + 终端编号(1字节) + 远程主机长度(1字节) + 远程主机 + 端口(2字节) + 登陆类型(1字节) + 用户名长度(1字节) + 用户名 + 密码/密钥长度(4字节) + 密码/密钥 + row(两个字节) + col(两个字节)
session: 主协议(1字节) + 终端编号(1字节) + 信息长度(4字节) + 信息
force_exit: 主协议(1字节) + 终端编号(1字节)
"""

"""
发送协议
login: 主协议(1字节) + 终端编号(1字节) + 标志(1字节) + 错误信息长度(4字节) + 错误信息
session: 主协议(1字节) + 终端编号(1字节) + 信息长度(4字节) + 信息
logout: 主协议(1字节) + 终端编号(1字节)
"""

# 协议定义
P_EXIT          = 0x01          # 应用退出协议
P_LOGIN         = 0x02          # 登陆协议
P_SESSION       = 0x03          # 会话协议
P_LOGOUT        = 0x04          # 登出协议
P_FORCE_EXIT    = 0x05          # 强制退出协议


class CPacket(object):

    def __init__(self, data=None):
        self.offset = 0
        self.buffer = data
    
    def get_buffer(self):
        return self.buffer
    
    def packet_uint8(self, data):
        self.buffer += chr(data)
    
    def packet_uint16(self, data):
        h = (data >> 8) & 0x00ff
        l = data & 0x00ff
        self.buffer += chr(h) + chr(l)
    
    def packet_uint32(self, data):
        d = (data >> 24) & 0x000000ff
        self.buffer += chr(d)
        d = (data >> 16) & 0x000000ff
        self.buffer += chr(d)
        d = (data >> 8) & 0x000000ff
        self.buffer += chr(d)
        d = data & 0x000000ff
        self.buffer += chr(d)
    
    def packet_string(self, data, len):
        self.buffer += data
    
    def unpacket_uint8(self):
        self.offset += 1
        return self.buffer[self.offset-1]
    
    def unpacket_uint16(self):
        self.offset += 2
        return self.buffer[self.offset - 2] << 8 | self.buffer[self.offset - 1]
    
    def unpacket_uint32(self):
        ret = 0
        d = self.buffer[self.offset]
        ret |= d << 24
        d = self.buffer[self.offset+1]
        ret |= d << 16
        d = self.buffer[self.offset+2]
        ret |= d << 8
        d = self.buffer[self.offset+3]
        self.offset += 4
        ret |= d
        return ret
    
    def unpacket_string(self, length):
        data = ''
        for i in xrange(length):
            data += chr(self.buffer[self.offset + i])
        self.offset += length
        return data.decode('utf8')


class CProxy(basesocket.CBaseSocket):

    """
    代理类，用于连接前端websocket, 后端的ssh channel
    """

    instance_ = None

    def __new__(cls, *args, **kwargs):
        if not cls.instance_:
            cls.instance_ = basesocket.CBaseSocket.__new__(cls)
        return cls.instance_
    
    def __init__(self, oSocket):
        self.sshs = {}
        self.write_buffer = []
        self.data = ''
        self.data_len = 0
        self.code_length = 0
        self.protocol_map = {
            P_EXIT          : 'exit',
            P_LOGIN         : 'login',
            P_SESSION       : 'session',
            P_FORCE_EXIT    : 'force_exit'
        }
        super(CProxy, self).__init__(oSocket)

    def on_read(self, oLoop):
        packet = self.recv_message()
        if packet == 0:
            oLoop.stop()
            return
        if packet == -1:
            return
        protocol = packet.unpacket_uint8()
        sFunc = self.protocol_map.get(protocol)
        if not sFunc: return
        oFunc = getattr(self, sFunc)
        if not oFunc: return
        oFunc(packet, oLoop)
    
    def on_write(self, oLoop):
        if not self.write_buffer:
            return
        for oPacket in self.write_buffer:
            self.write_(oPacket.get_buffer())
        
        self.write_buffer = []
    
    def close(self):
        self.fd.close()
    
    def exit(self, data, oLoop):
        # 应用退出
        oLoop.stop()
    
    def login(self, packet, oLoop):
        term_id = packet.unpacket_uint8()
        host_len = packet.unpacket_uint8()
        host = packet.unpacket_string(host_len)
        port = packet.unpacket_uint16()
        login_type = packet.unpacket_uint8()
        user_len = packet.unpacket_uint8()
        user = packet.unpacket_string(user_len)
        pass_len = packet.unpacket_uint32()
        passwd = packet.unpacket_string(pass_len)
        row = packet.unpacket_uint16()
        col = packet.unpacket_uint16()
        oSsh = ssh.CSsh(None, weakref.ref(self), term_id=term_id, host=host, port=port, user=user, passwd=passwd, row=row, col=col, login_type=login_type)
        threading.Thread(target=self.do_login, args=(term_id, oSsh,  weakref.ref(oLoop))).start()

    def do_login(self, term_id, oSsh, wrLoop):
        oLoop = wrLoop()
        if not oLoop: return
        ret = oSsh.login()
        if ret['status']:
            oLoop.add(oSsh, oLoop.EVENT_READ)
            oLoop.add(oSsh, oLoop.EVENT_WRITE)
            self.sshs[term_id] = oSsh
        data = ret['data'].encode('utf8')
        msg_len = len(data)
        total_len = 1 + 1 + 1 + 4 + msg_len
        oPacket = CPacket('')
        oPacket.packet_uint8(P_LOGIN)
        oPacket.packet_uint8(ret['term_id'])
        oPacket.packet_uint8(ret['status'])
        oPacket.packet_uint32(msg_len)
        oPacket.packet_string(data, msg_len)
        self.write_buffer.append(oPacket)

    def session(self, packet, oLoop):
        term_id = packet.unpacket_uint8()
        msg_len = packet.unpacket_uint32()
        msg = packet.unpacket_string(msg_len)
        oSsh = self.sshs.get(term_id)
        if not oSsh: return
        oSsh.session(msg)
    
    def force_exit(self, packet, oLoop):
        term_id = packet.unpacket_uint8()
        oSsh = self.sshs.get(term_id)
        if not oSsh: return
        oSsh.force_exit(oLoop)

    def add_ssh_message(self, term_id, data):
        data = data.encode('utf8')
        msg_len = len(data)
        oPacket = CPacket('')
        oPacket.packet_uint8(P_SESSION)
        oPacket.packet_uint8(term_id)
        oPacket.packet_uint32(msg_len)
        oPacket.packet_string(data, msg_len)
        self.write_buffer.append(oPacket)
    
    def add_ssh_logout(self, term_id):
        oPacket = CPacket('')
        oPacket.packet_uint8(P_LOGOUT)
        oPacket.packet_uint8(term_id)
        self.write_buffer.append(oPacket)
    
    def write_(self, sMsg):
        # 发送字符串
        message = sMsg
        back_str = []
        back_str.append('\x82')
        data_length = len(message)

        if data_length <= 125:
            back_str.append(chr(data_length))
        elif data_length <= 65535:
            back_str.append(struct.pack('b', 126))
            back_str.append(struct.pack('>h', data_length))
        elif data_length <= (2 ^ 64-1):
            back_str.append(struct.pack('b', 127))
            back_str.append(struct.pack('>q', data_length))

        data = ''
        for c in back_str:
            data += c

        back_str = str(data) + message

        if back_str != None and len(back_str) > 0:
            self.fd.sendall(back_str)

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

        datas = []
        for i, d in enumerate(data):
            datas.append(ord(d) ^ ord(masks[i % 4]))
        return datas

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

    def recv_message(self):
        '''接受前端传来的数据'''
        _buffer_length = 0
        _recv_buffer = ''
        _buffer_utf8 = ''
        _buffer_unicode = ''
        tmp_data = ''
        tmp_data = self.fd.recv(128)
        if not tmp_data:
            return 0
        if self.code_length == 0:
            self.get_data_length(tmp_data)

        self.data_len += len(tmp_data)
        self.data += tmp_data
        if self.data_len - self.headers_length < self.code_length:
            return -1
        data = self.parse_data(self.data)

        if len(self.data) == 0 or len(data) == 0:
            return -1

        self.data = ''
        self.code_length = 0
        self.data_len = 0

        return CPacket(data)
