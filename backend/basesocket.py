#! /usr/bin/env python
# _*_ coding:utf-8 _*_


class CBaseSocket(object):

    def __init__(self, oSocket):
        self.fd = oSocket

    def fileno(self):
        return self.fd.fileno()

    def on_read(self, oLoop):
        pass

    def on_write(self, oLoop):
        pass
