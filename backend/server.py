#! /usr/bin/env python
# _*_ coding:utf-8 _*_


import os
import sys
import struct
import base64
import socket
import hashlib

import config
import proxy
import logger
import basesocket


class CWebSocketServer(basesocket.CBaseSocket):
    '''负责监听websocket连接, 成功握手之后退出'''
    instance_ = None
    GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

    def __new__(cls, *args, **kwargs):
        if not cls.instance_:
            cls.instance_ = basesocket.CBaseSocket.__new__(cls)
        return cls.instance_

    def __init__(self):
        super(CWebSocketServer, self).__init__(None)

    def destroy(self):
        logger.write_log(logger.LOG, 'WebSocketServer is stop.')
        self.fd.close()

    def valid(self, sock):
        '''判断是否是websocket协议'''
        headers = dict()
        recv_buffer = ''
        recv_buffer += bytes.decode(sock.recv(1024))
        if recv_buffer.find('\r\n\r\n') == -1:
            return False

        header, _ = recv_buffer.split('\r\n\r\n', 1)
        for line in header.split('\r\n')[1:]:
            k, v = line.split(': ', 1)
            headers[k] = v
        headers['Location'] = ("ws://%s%s" % (headers["Host"], '/'))
        key = headers['Sec-WebSocket-Key']
        token = base64.b64encode(hashlib.sha1(
            str.encode(str(key + self.GUID))).digest())
        handshake = "HTTP/1.1 101 Switching Protocols\r\n"\
            "Upgrade: websocket\r\n"\
            "Connection: Upgrade\r\n"\
            "Sec-WebSocket-Accept: "+bytes.decode(token)+"\r\n"\
            "WebSocket-Origin: "+str(headers["Origin"])+"\r\n"\
            "WebSocket-Location: "+str(headers["Location"])+"\r\n\r\n"
        sock.send(str.encode(str(handshake)))
        return True

    def on_read(self, oLoop):
        clt, clt_info = self.fd.accept()
        if not self.valid(clt):
            return
        logger.write_log(logger.LOG, "client is link. info %s:%s" % clt_info)
        oProxy = proxy.CProxy(clt)
        oLoop.add(oProxy, oLoop.EVENT_READ)
        # oLoop.add(oProxy, oLoop.EVENT_WRITE)
        oLoop.remove(self, oLoop.EVENT_READ)

    def start(self, oLoop):
        try:
            self.fd = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.fd.bind((config.sock_addr, config.sock_port))
            self.fd.listen(1)
            oLoop.add(self, oLoop.EVENT_READ)
        except socket.error as err:
            logger.write_log(logger.ERROR, str(err))
            sys.exit(-1)
