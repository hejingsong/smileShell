#! /usr/bin/env python
#_*_ coding:utf-8 _*_

import time
from config import log_dir

g_Logger = None

LOG = 0
DEBUG = 1
ERROR = 2

def Init():
    global g_Logger
    g_Logger = CLogger()

def write_log(level, msg):
    global g_Logger
    g_Logger.write_log(level, msg)

class CLogger(object):
    '''记录日志类'''
    instance_ = None
    __log_level = ['Log', 'Debug', 'Error']

    def __new__(cls):
        if not cls.instance_:
            cls.instance_ = object.__new__(cls)
        return cls.instance_

    def __init__(self):
        self.fileName = '%s/%s.log' %(log_dir, time.strftime('%Y-%m-%d'))
        self.fd = open(self.fileName, 'ab+', buffering=0)

    def destroy(self):
        self.fd.close()

    def write_log(self, level, msg):
        current_time = time.strftime('%H:%M:%S')
        write_msg = "[%s]\t[%s]\t%s\r\n" % (self.__log_level[level], current_time, msg)
        self.fd.write(write_msg)
