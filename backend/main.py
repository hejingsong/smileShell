#! /usr/bin/env python
#_*_ coding:utf-8 _*_

import server

if __name__ == '__main__':
    wss = server.WebSocketServer()
    wsc = wss.start()