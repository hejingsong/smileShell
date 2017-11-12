#! /usr/bin/env python
#_*_ coding:utf-8 _*_

import os
import json
import getpass
import socket

dir_mode = 0755

base_dir = os.path.abspath('.').replace('\\', '/')
base_dir = os.path.dirname(base_dir)
log_dir  = base_dir + '/log'
data_dir = base_dir + '/data'
conf_dir = base_dir + '/conf'
down_dir = base_dir + '/download'
key_dir  = base_dir + '/sshkey'

sock_addr = 'localhost'
sock_port = 12345

current_user = getpass.getuser()
hostname = socket.gethostname()

data_file = "%s/%s.dat" % (data_dir, current_user)
conf_file = '%s/%s.conf' % (conf_dir, current_user)
        