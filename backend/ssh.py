#! /usr/bin/env python
#_*_ coding:utf-8 _*_

import re
import json
import socket
import paramiko

import config
import logger

class Ssh(object):
    def __init__(self, **kwargs):
        self.id = kwargs['id']
        self.host = kwargs['host']
        self.port = kwargs['port']
        self.user = kwargs['user']
        self.passwd = kwargs['pass']
        self.key = kwargs['key']
        self.rows = kwargs['rows']
        self.cols = kwargs['cols']
        self.loginType = kwargs['loginType']
        self.__logger = logger.Logger()
        self.handler = re.compile(r'^.*pwd\r\n(.*)\r\n.*$')
        self.clt = None
        self.chan = None

    def __del__(self):
        try:
            self.chan.close()
            self.clt.close()
        except:
            pass

    def login(self):
        ret = dict(id=self.id, status=True, data=u'success')
        try:
            self.clt = paramiko.client.SSHClient()
            self.clt.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            if int(self.loginType) == 0:
                # 密码登录
                self.clt.connect(
                    hostname=self.host,
                    port=int(self.port),
                    username=self.user,
                    password=self.passwd
                    # timeout=1.5         # 这里不能链接太长时间, 不然会阻塞整个进程
                )
            else:
                # 秘钥登录
                self.clt.connect(
                    hostname=self.host,
                    port=int(self.port),
                    username=self.user,
                    password=self.passwd,
                    key_filename=self.key.replace('\\', '/'),
                    timeout=1.5         # 这里不能链接太长时间, 不然会阻塞整个进程
                )
            self.chan = self.clt.invoke_shell(term='xterm', width=self.cols, height=self.rows)
        except socket.error as e:
            ret['status'] = False
            ret['data'] = u'Connection ssh server failed. Please check the host and port.'
        except paramiko.BadHostKeyException as e:
            ret['status'] = False
            ret['data'] = u'Wrong key file.'
        except paramiko.AuthenticationException as e:
            ret['status'] = False
            ret['data'] = u'username or password error'
        except paramiko.SSHException as e:
            ret['status'] = False
            ret['data'] = u'An unknown error occurred while connecting to ssh server.'
        return ret

    def read(self):
        ret = dict()
        data = ''
        try:
            data = self.chan.recv(1024)
            if len(data) == 0:
                return None
            data = str(data).decode('utf-8', 'ignore')
        except socket.timeout:
            return None
        else:
            return data

    def session(self, msg):
        try:
            self.chan.send(msg)
        except socket.error:
            pass

    def resize(self, cols, rows):
        self.chan.resize_pty(width=cols, height=rows)

    @staticmethod
    def createKey(key_type, passwd, path):
        ret = dict(
            status=True,
            msg=''
        )
        primaryFile = '%s/Identity'%(path,)
        publicFile = '%s/Identity.pub'%(path,)
        privateFp = open(primaryFile, 'wb')
        publicFp = open(publicFile, 'wb')
        try:
            if key_type == '0':
                key = paramiko.rsakey.RSAKey.generate(2048)
            else:
                key = paramiko.dsskey.DSSKey.generate(2048)
            if len(passwd) == 0:
                key.write_private_key(privateFp)
            else:
                key.write_private_key(privateFp, password=str.encode(passwd.encode()))
        except IOError as e:
            write_error( "error: gen key, " + str(e) )
            ret['status'] = False
            ret['msg'] = 'there was an error writing to the file'
        except paramiko.SSHException:
            write_error( "error: gen key, " + str(e) )
            ret['status'] = False
            ret['msg'] = 'the key is invalid'
        else:
            for data in [key.get_name(),
                         ' ',
                         key.get_base64(),
                         " %s@%s"%(config.current_user, config.hostname)]:
                publicFp.write(data)
        finally:
            privateFp.close()
            publicFp.close()
            ret['msg'] = 'success'
        return ret

    def getCurrentPath(self):
        data = ''
        recvData = ''
        try:
            self.chan.sendall('\x15pwd\r')
            while 1:
                data = self.chan.recv(1)
                recvData += data
                if data == '$' or data == '#':
                    break
            if len(recvData) == 0:
                return '~'
            currentPath = self.handler.findall(recvData)
            if len(currentPath) == 0:
                return'~'
            else: 
                return currentPath[0]
        except:
            self.__logger.write_log(2, 'can\'t found current path.')
            return '~'

    def upload(self, fileName, remote_path):
        file = fileName.split('/')[-1]
        data = u'%s 上传成功'%(file, )
        try:
            sftpClient = paramiko.SFTPClient.from_transport(self.clt.get_transport())
            sftpClient.put(fileName, remote_path+'/'+file)
        except paramiko.SSHException as e:
            data = str(e)
            self.__logger.write_log(2, data)
        except IOError as e:
            data = str(e)
            self.__logger.write_log(2, data)
        finally:
            sftpClient.close()
        return data

    def download(self, path, fileName, remote_path):
        data = ''
        remoteFile = ''
        if fileName[0] == '/':
            remoteFile = fileName
        else:
            remoteFile = remote_path + '/' + fileName.strip()
        fileName = fileName.split('/')[-1]
        data = u'%s 下载成功' %(fileName,)

        try:
            sftpClient = paramiko.SFTPClient.from_transport(self.clt.get_transport())
            sftpClient.get(remoteFile, path+'/'+fileName)
        except paramiko.SSHException as e:
            data = str(e)
            self.__logger.write_log(2, data)
        except IOError as e:
            data = str(e)
            self.__logger.write_log(2, data)
        finally:
            sftpClient.close()
        return data
