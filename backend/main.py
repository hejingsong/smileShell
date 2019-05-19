#! /usr/bin/env python
# _*_ coding:utf-8 _*_

import os
import server
import ioloop
import logger
import config

if __name__ == '__main__':

    if not os.path.exists(config.data_dir):
        os.mkdir(config.data_dir, config.dir_mode)
    if not os.path.exists(config.down_dir):
        os.mkdir(config.down_dir, config.dir_mode)
    if not os.path.exists(config.log_dir):
        os.mkdir(config.log_dir, config.dir_mode)
    if not os.path.exists(config.key_dir):
        os.mkdir(config.key_dir, config.dir_mode)

    logger.Init()
    loop = ioloop.CIOLoop()
    serv = server.CWebSocketServer()

    serv.start(loop)

    loop.Run()
