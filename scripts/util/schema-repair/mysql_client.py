# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

import gzip,hashlib,os,queue,re,shutil,subprocess,threading,time,uuid
import json

def qi(s):
    if not re.fullmatch(r'[A-Za-z0-9_$]+',s):raise ValueError('Invalid identifier: '+s)
    return '`'+s+'`'

def qt(t):return '.'.join(qi(x) for x in t.split('.'))

def lit(s):
    if s is None:return 'NULL'
    return "_utf8mb4 0x"+str(s).encode().hex() if str(s) else "''"

def quoted(s):return "'"+str(s).replace('\\','\\\\').replace("'","''").replace('\x00','\\0')+"'"

def split_items(s):
    result=[];start=0;depth=0;quote=None;i=0
    while i<len(s):
        c=s[i]
        if quote:
            if c=='\\':i+=1
            elif c==quote:
                if i+1<len(s) and s[i+1]==quote:i+=1
                else:quote=None
        elif c in "'\"`":quote=c
        elif c=='(':depth+=1
        elif c==')':depth-=1
        elif c==',' and depth==0:result.append(s[start:i].strip());start=i+1
        i+=1
    result.append(s[start:].strip());return result


class SqlError(RuntimeError):
    pass


class Mysql:
    """One non-reconnecting connection holds the replay lock and transaction."""
    def __init__(self,args,work):
        self.args=args;self.rows=queue.Queue();self.err=open(work/'mysql.stderr.log','a')
        self.p=subprocess.Popen([args.mysql,'--defaults-file='+str(args.config),'--batch','--raw',
            '--skip-column-names','--unbuffered','--force','--skip-reconnect','--binary-mode',
            '--default-character-set=utf8mb4'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,
            stderr=self.err,text=True,encoding='utf-8',bufsize=1)
        def reader():
            try:
                for line in self.p.stdout:self.rows.put(line.rstrip('\n'))
            finally:self.rows.put(None)
        threading.Thread(target=reader,daemon=True).start()
        self.query("SET SESSION sql_mode='STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'")
        self.query('SET SESSION lock_wait_timeout=15');self.query('SET SESSION innodb_lock_wait_timeout=15')
        self.query('USE cloud')
        self.version=self.scalar('SELECT VERSION()')
        if not re.match(r'^8\.0\.',self.version):raise RuntimeError('Validated target is MySQL 8.0; server='+self.version)

    def query(self,sql,allow_duplicate=False):
        if self.p.poll() is not None:raise RuntimeError('MySQL connection closed; refusing automatic reconnect')
        marker='MOLD_END_'+uuid.uuid4().hex;delimiter='M'+uuid.uuid4().hex[:12]
        self.p.stdin.write('DELIMITER '+delimiter+'\n'+sql.rstrip().rstrip(';')+'\n'+delimiter+'\nSHOW WARNINGS'+delimiter+'\nSELECT '+lit(marker)+delimiter+'\nDELIMITER ;\n')
        self.p.stdin.flush();rows=[];diagnostics=[];deadline=time.monotonic()+self.args.timeout
        while True:
            try:line=self.rows.get(timeout=max(.01,deadline-time.monotonic()))
            except queue.Empty:
                self.p.kill();raise RuntimeError('Query timed out; check results and DB before retry')
            if line is None:raise RuntimeError('MySQL connection lost; no reconnect/replay attempted')
            if line==marker:break
            h=re.match(r'(Error|Warning|Note)\t(\d+)\t(.*)',line)
            if h:diagnostics.append((h[1],int(h[2]),h[3]))
            else:rows.append(line)
        # Deprecation notes do not imply discarded/truncated data. All data warnings,
        # including INSERT IGNORE coercions, are errors except explicit duplicate keys.
        harmless={1287,1329,1681,3719,3778}
        failures=[d for d in diagnostics if d[0]=='Error' or d[0]=='Warning' and not (allow_duplicate and d[1]==1062) and d[1] not in harmless]
        if failures:raise SqlError('; '.join(str(code)+': '+message for _,code,message in failures))
        return rows

    def scalar(self,sql):
        rows=self.query(sql);return rows[0] if rows else None

    def objects(self,table,fields,where='1'):
        expr=','.join(lit(f)+','+qi(f) for f in fields)
        return [json.loads(x) for x in self.query('SELECT JSON_OBJECT('+expr+') FROM '+table+' WHERE '+where)]

    def close(self):
        try:
            if self.p.poll() is None:
                self.p.stdin.close();self.p.wait(timeout=5)
        except Exception:
            self.p.kill();self.p.wait()
        self.err.close()

def services_stopped():
    if not shutil.which('systemctl'):return
    active=[]
    for service in ('mold','mold-usage','cloudstack-management','cloudstack-usage'):
        if subprocess.run(['systemctl','is-active','--quiet',service],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:active.append(service)
    if active:raise RuntimeError('Stop local services before --apply: '+', '.join(active)+' (also stop other management/usage nodes)')

def backup(args,work):
    dump=shutil.which(args.mysqldump)
    if not dump:raise RuntimeError('mysqldump not found; backup is mandatory')
    path=work/'backup.sql.gz'
    with open(work/'backup.stderr.log','wb') as err,open(path,'wb') as raw:
        process=subprocess.Popen([dump,'--defaults-file='+str(args.config),'--single-transaction',
            '--routines','--events','--triggers','--hex-blob','--set-gtid-purged=OFF','--no-tablespaces',
            '--databases','cloud','cloud_usage'],stdout=subprocess.PIPE,stderr=err)
        try:
            with gzip.GzipFile(fileobj=raw,mode='wb') as zipped:shutil.copyfileobj(process.stdout,zipped)
            code=process.wait()
        except BaseException:
            process.kill();process.wait();raise
    if code:
        path.rename(work/'backup.incomplete.sql.gz');raise RuntimeError('Backup failed; no changes applied. See backup.stderr.log')
    checksum=hashlib.sha256()
    with open(path,'rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):checksum.update(block)
    (work/'backup.sha256').write_text(checksum.hexdigest()+'  backup.sql.gz\n')
    print('Backup completed:',path,flush=True)
