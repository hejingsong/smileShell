#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Date    : 2018-10-03 21:03:18
# @Author  : Hejs (240197153@qq.com)
# @Link    : http://www.nisonge.com


import select

import config
import logger


class CIOLoop(object):

    """IO监听类，进行IO事件分发"""

    EVENT_READ = 1<<0
    EVENT_WRITE = 1<<1
    DELAY = 0.05

    def __init__(self):
        self.run = True
        self.lstRead = []
        self.lstWrite = []
        self.dFd2Obj = {}

    def add(self, executor, event_type):
        if (event_type & self.EVENT_READ):
            self.lstRead.append(executor.fd)
        else:
            self.lstWrite.append(executor.fd)
        self.dFd2Obj[executor.fileno()] = executor
    
    def remove(self, executor):
        if executor.fd in self.lstRead:
            self.lstRead.remove(executor.fd)
        elif executor.fd in self.lstWrite:
            self.lstWrite.remove(executor.fd)
        if executor.fileno() in self.dFd2Obj:
            self.dFd2Obj.pop(executor.fileno())

    def Run(self):
        while self.run:
            r, w, _ = select.select(self.lstRead, self.lstWrite, [], self.DELAY)
            if r:
                self.handle_read(r)
            if w:
                self.handle_write(w)

    def stop(self):
        self.run = False

    def handle_read(self, lstRead):
        for fd in lstRead:
            obj = self._getObj(fd)
            if not obj: continue
            obj.on_read(self)

    def handle_write(self, lstWrite):
        for fd in lstWrite:
            obj = self._getObj(fd)
            if not obj:
                continue
            obj.on_write(self)

    def _getObj(self, fd):
        return self.dFd2Obj.get(fd.fileno(), None)
