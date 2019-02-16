#! /usr/bin/env python
#_*_ coding:utf-8 _*_

import re
import json
import socket
import paramiko

import config
import logger
import basesocket

HANDLER = re.compile(r'^.*pwd\r\n(.*)\r\n.*$')

class CSsh(basesocket.CBaseSocket):

    def __init__(self, oSocket, wrProxy, **kwargs):
        super(CSsh, self).__init__(oSocket)
        self.term_id = kwargs['term_id']
        self.host = kwargs['host']
        self.port = kwargs['port']
        self.user = kwargs['user']
        self.passwd = kwargs['passwd']
        self.row = kwargs['row']
        self.col = kwargs['col']
        self.loginType = kwargs['login_type']
        self.proxy = wrProxy
        self.write_buffer = []
        self.clt = None
        self.chan = None

    def destroy(self):
        try:
            self.chan.close()
            self.clt.close()
        except:
            pass

    def on_read(self, oLoop):
        oProxy = self.proxy()
        if not oProxy:return

        data = self.read()
        if not data:
            oLoop.remove(self)
            oProxy.add_ssh_logout(self.term_id)
        else:
            oProxy.add_ssh_message(self.term_id, data)
    
    def on_write(self, oLoop):
        if not self.write_buffer:
            return
        try:
            for buffer in self.write_buffer:
                self.chan.send(buffer)
        except socket.error:
            pass
        self.write_buffer = []

    def login(self):
        ret = dict(term_id=self.term_id, status=1, data=u'')
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
            self.chan = self.clt.invoke_shell(term='xterm', width=self.col, height=self.row)
            self.fd = self.chan
        except socket.error as _:
            ret['status'] = 0
            ret['data'] = u'Connection ssh server failed. Please check the host and port.'
        except paramiko.BadHostKeyException as _:
            ret['status'] = 0
            ret['data'] = u'Wrong key file.'
        except paramiko.AuthenticationException as _:
            ret['status'] = 0
            ret['data'] = u'username or password error'
        except paramiko.SSHException as _:
            ret['status'] = 0
            ret['data'] = u'An unknown error occurred while connecting to ssh server.'
        return ret

    def read(self):
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
        self.write_buffer.append(msg)
    
    def force_exit(self, oLoop):
        self.write_buffer = []
        self.chan.close()
        self.clt.close()
        oLoop.remove(self)

    def resize(self, rows, cols):
        self.chan.resize_pty(width=cols, height=rows)

    @staticmethod
    def create_key(key_type, passwd, path):
        ret = dict(
            status=True,
            msg='success'
        )
        primaryFile = '%s/Identity'%(path,)
        publicFile = '%s/Identity.pub'%(path,)
        try:
            privateFp = open(primaryFile, 'wb')
            publicFp = open(publicFile, 'wb')
            if key_type == 0:
                key = paramiko.rsakey.RSAKey.generate(2048)
            else:
                key = paramiko.dsskey.DSSKey.generate(2048)
            if len(passwd) == 0:
                key.write_private_key(privateFp)
            else:
                key.write_private_key(privateFp, password=str.encode(passwd.encode()))
            for data in [key.get_name(),
                        ' ',
                        key.get_base64(),
                        " %s@%s"%(config.current_user, config.hostname)]:
                publicFp.write(data)
            privateFp.close()
            publicFp.close()
        except IOError as e:
            logger.write_log(logger.ERROR, "error: gen key, " + str(e) )
            ret['status'] = False
            ret['msg'] = 'No such file or directory, or Permission denied'
        except paramiko.SSHException:
            logger.write_log(logger.ERROR, "error: gen key, " + str(e))
            ret['status'] = False
            ret['msg'] = 'the key is invalid'
        return ret

    def getCurrentPath(self):
        data = ''
        recvData = ''
        try:
            self.chan.setblocking(1)
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
            logger.write_log(logger.ERROR, 'can\'t found current path.')
            return '~'
        finally:
            self.chan.setblocking(0)

    def upload(self, fileName, remote_path):
        file = fileName.split('/')[-1]
        data = u'%s 上传成功'%(file, )
        sftpClient = None
        try:
            sftpClient = paramiko.SFTPClient.from_transport(self.clt.get_transport())
            sftpClient.put(fileName, remote_path+'/'+file)
        except paramiko.SSHException as e:
            data = str(e)
            logger.write_log(logger.ERROR, data)
        except IOError as e:
            data = str(e)
            logger.write_log(logger.ERROR, data)
        finally:
            if sftpClient:
                sftpClient.close()
        return data

    def download(self, path, fileName, remote_path):
        data = ''
        remoteFile = ''
        sftpClient = None
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
            logger.write_log(logger.ERROR, data)
        except IOError as e:
            data = str(e)
            logger.write_log(logger.ERROR, data)
        finally:
            if sftpClient:
                sftpClient.close()
        return data
