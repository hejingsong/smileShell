#! /usr/bin/env python
#_*_ coding:utf-8 _*_

import time
from config import log_dir

class Logger( object ):
    '''记录日志类'''
    __instance = None
    __log_level = ['Log', 'Debug', 'Error']

    def __init__(self):
        self.__fileName = '%s/%s.log' %(log_dir, time.strftime('%Y-%m-%d'))
        self.__fd = open(self.__fileName, 'ab+', buffering=0)

    def __new__(self, *args, **kwargs):
        if not self.__instance:
            self.__instance = object.__new__(self, *args, **kwargs)
        return self.__instance

    def __del__(self):
        self.__fd.close()

    def write_log(self, level, msg):
        current_time = time.strftime('%H:%M:%S')
        write_msg = "[%s]\t[%s]\t%s\r\n" % (self.__log_level[level], current_time, msg)
        self.__fd.write(write_msg)
