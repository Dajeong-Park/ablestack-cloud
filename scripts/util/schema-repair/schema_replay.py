# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See the NOTICE file distributed with this
# work for additional information regarding copyright ownership. The ASF
# licenses this file to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance with the License.
# You may obtain a copy at http://www.apache.org/licenses/LICENSE-2.0 .
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations.
"""Replay current version-ordered SQL, with an atomic per-statement DML journal."""
import argparse
import collections
import datetime
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile

from mysql_client import Mysql,SqlError,qi,qt,lit,quoted,services_stopped,backup
from schema_ddl import Schema,GuardError,DDL_PROCS,table_name
from schema_insert import guarded_insert,insert_parts
from sql_source import SourceError,Statement,parse,discover,call,canonical

JOURNAL='cloud.mold_schema_replay_statement'
INFLIGHT='cloud.mold_schema_replay_ddl_attempt'
HERE=Path(__file__).resolve().parent


def sql_directory(explicit):
    if explicit:return explicit.expanduser().resolve(strict=True)
    installed=HERE/'sql'
    if installed.is_dir():return installed
    for parent in HERE.parents:
        source=parent/'engine/schema/src/main/resources/META-INF/db'
        if source.is_dir():return source
    raise SourceError('SQL directory not found; use --sql-dir /path/to/current/sql')


def raw_kind(sql):
    if re.match(r'(?:CREATE|DROP)\s+PROCEDURE\b',sql,re.I):return 'ROUTINE'
    if re.match(r'(?:CREATE|DROP)\s+TEMPORARY\s+TABLE\b',sql,re.I):return 'TEMP'
    data=call(sql)
    if data:return 'DDL' if data[1] in DDL_PROCS else 'CALL'
    word=sql.split(None,1)[0].upper()
    if word in ('SET','PREPARE','DEALLOCATE','USE'):return 'SESSION'
    if word in ('UPDATE','DELETE','INSERT'):return word
    if word in ('CREATE','ALTER','DROP','RENAME'):return 'DDL'
    if word=='EXECUTE':return 'EXECUTE'
    if re.fullmatch(r'SELECT\s+1',sql,re.I):return 'SESSION'
    raise SourceError('Unsupported statement type (not executed): '+word)


def proc_name(sql):
    h=re.search(r'PROCEDURE\s+(?:IF EXISTS\s+)?(?:(`?\w+`?)\.)?`?(\w+)`?',sql,re.I)
    if not h:return None
    return (h[1] or 'cloud').strip('`')+'.'+h[2].upper()


def validate_data_helper(name,body):
    begin=re.search(r'\bBEGIN\b',body,re.I)
    if not begin:raise SourceError('Procedure body missing: '+name)
    tokens=canonical(body[begin.end():])
    # An implicit commit inside CALL would detach the DML from its journal write.
    if re.search(r'(?:^|\x1f)(?:ALTER|CREATE|DROP|TRUNCATE|COMMIT|ROLLBACK|RENAME|PREPARE|EXECUTE|CALL|GRANT|REVOKE|LOCK|UNLOCK|AUTOCOMMIT|START)(?:\x1f|$)',tokens,re.I):
        raise SourceError('Data helper contains DDL, transaction control or an indirect call: '+name)


def guarded_helper(name,body):
    """Keep the current helper body, strengthening known seed identity predicates."""
    if name.endswith('.IDEMPOTENT_UPDATE_API_PERMISSION'):
        body=re.sub(r'SELECT\s+MAX\((`?rp`?\.`?sort_order`?)\)\s+INTO',r'SELECT COALESCE(MAX(\1),0) INTO',body,flags=re.I)
    if name.endswith('.ADD_GUEST_OS_AND_HYPERVISOR_MAPPING'):
        # Category cleanup in a later version must not produce a second OS row
        # when an older file is replayed; mapping display strings are not identities.
        body=re.sub(r'category_id\s*=\s*guest_os_category_id\s+AND\s+','',body,flags=re.I)
        body=re.sub(r'\s+AND\s+hypervisor\.guest_os_name\s*=\s*guest_os_hypervisor_guest_os_name','',body,flags=re.I)
    return body


def read_sources(directory,minimum):
    files=discover(directory,minimum);sources={};all_statements=[];helpers={};definitions={};bodies={};variables={};prepared={};temps={}
    procdir=directory/'procedures'
    if procdir.is_dir():
        for p in sorted(procdir.glob('*.sql')):
            for s in parse(p.read_bytes().decode('utf-8'),p.name):
                if re.match(r'CREATE\s+PROCEDURE\b',s.sql,re.I):helpers[proc_name(s.sql)]=s.sql
    for p in files:
        text=p.read_bytes().decode('utf-8');sources[p.name]=text
        for s in parse(text,p.name):
            kind=raw_kind(s.sql);context=[]
            if kind=='ROUTINE' and re.match(r'CREATE',s.sql,re.I):
                definitions[proc_name(s.sql)]=s.digest;bodies[proc_name(s.sql)]=s.sql
            if kind=='SESSION':
                if re.match(r'SET\s+@',s.sql,re.I):
                    h=re.match(r'SET\s+(@\w+)\s*(?::=|=)',s.sql,re.I)
                    if not h:raise SourceError('Unsupported session assignment: '+s.sql[:100])
                    dependencies=sorted({variables[v.lower()] for v in re.findall(r'@\w+',s.sql[h.end():]) if v.lower() in variables})
                    variables[h[1].lower()]=hashlib.sha256((s.digest+'|'+','.join(dependencies)).encode()).hexdigest() if dependencies else s.digest
                elif re.match(r'PREPARE',s.sql,re.I):
                    h=re.fullmatch(r'PREPARE\s+(\w+)\s+FROM\s+(@\w+)',s.sql,re.I)
                    if not h:raise SourceError('PREPARE requires a session variable')
                    prepared[h[1].lower()]=(h[2],variables.get(h[2].lower(),''))
                elif not re.match(r'(?:DEALLOCATE PREPARE|USE|SELECT 1)\b',s.sql,re.I):raise SourceError('Only local @variable assignments are supported; no global/session overrides')
                if re.match(r'USE\b',s.sql,re.I) and not re.fullmatch(r'USE\s+`?cloud`?',s.sql,re.I):raise SourceError('Default schema must stay cloud; qualify cloud_usage table names explicitly')
            if kind=='EXECUTE':
                h=re.fullmatch(r'EXECUTE\s+(\w+)',s.sql,re.I)
                if not h or h[1].lower() not in prepared:raise SourceError('EXECUTE has no corresponding PREPARE')
                variable,fingerprint=prepared[h[1].lower()];context.append('prepared:'+variable+':'+fingerprint)
                s.prepared_variable=variable
            data=call(s.sql)
            if data and kind=='CALL':
                key=data[0]+'.'+data[1]
                if key not in definitions and key not in helpers:
                    raise SourceError('Missing procedure definition: '+key)
                body=helpers.get(key,'')
                validate_data_helper(key,bodies.get(key,body))
                context.append('procedure:'+key+':'+definitions.get(key,hashlib.sha256(canonical(body).encode()).hexdigest()))
            for variable in re.findall(r'@\w+',s.sql):
                if variable.lower() in variables:context.append('variable:'+variable.lower()+':'+variables[variable.lower()])
            temp=re.match(r'CREATE TEMPORARY TABLE(?: IF NOT EXISTS)?\s+([^\s(]+)',s.sql,re.I)
            if temp:temps[table_name(temp[1])]=[s.digest]
            dependencies=[]
            for tempname,hashes in temps.items():
                if re.search(r'\b'+re.escape(tempname.split('.')[1])+r'\b',s.sql,re.I):
                    context.append('temporary:'+tempname+':'+','.join(hashes));dependencies.append(tempname)
            target=re.match(r'INSERT\s+(?:IGNORE\s+)?INTO\s+([^\s(]+)',s.sql,re.I)
            s.temporary_insert=bool(target and table_name(target[1]) in temps)
            if s.temporary_insert:temps[table_name(target[1])].append(s.digest)
            s.context='|'.join(sorted(set(context)));s.kind=kind;all_statements.append(s)
            drop=re.match(r'DROP TEMPORARY TABLE(?: IF EXISTS)?\s+([^\s]+)',s.sql,re.I)
            if drop:temps.pop(table_name(drop[1]),None)
    return sources,all_statements,helpers


def rewrite_tables(sql,schema):
    # Preserve string literals; resolve only identifier tokens for historical table names.
    parts=re.split(r"('(?:\\.|''|[^'\\])*'|\"(?:\\.|\"\"|[^\"\\])*\")",sql)
    for old,new in schema.aliases.items():
        if schema.resolve(old)==old:continue
        old_schema,old_name=old.split('.');new_schema,new_name=new.split('.')
        for i in range(0,len(parts),2):
            parts[i]=re.sub(r'(?<![\w])`?'+re.escape(old_schema)+r'`?\s*\.\s*`?'+re.escape(old_name)+r'`?(?![\w])',qt(new),parts[i],flags=re.I)
            parts[i]=re.sub(r'(?<![\w])`?'+re.escape(old_name)+r'`?(?![\w])',qi(new_name),parts[i],flags=re.I)
    return ''.join(parts)


class RoutineDefiners:
    """Preserve application ownership when an administrator executes migration SQL."""
    def __init__(self,db,override=None):
        self.db=db;self.actor=db.scalar('SELECT CURRENT_USER()');self.override=override;self.resolved={}
        self.existing={r['ROUTINE_SCHEMA']+'.'+r['ROUTINE_NAME'].upper():r['DEFINER'] for r in db.objects(
            'information_schema.ROUTINES',['ROUTINE_SCHEMA','ROUTINE_NAME','DEFINER'],
            "ROUTINE_SCHEMA IN ('cloud','cloud_usage') AND ROUTINE_TYPE='PROCEDURE'")}
        grants=' '.join(db.query('SHOW GRANTS')).upper()
        self.can_set_other=bool(re.search(r'\bSET_USER_ID\b|\bSUPER\b|ALL PRIVILEGES ON \*\.\*',grants))
        try:
            rows=db.objects('mysql.global_grants',['USER','HOST'],"PRIV='SYSTEM_USER'")
            self.system_accounts={r['USER']+'@'+r['HOST'] for r in rows}
        except SqlError:
            # A normal app user can safely retain its own owner. Do not infer the
            # privilege category of a different user without administrative metadata.
            self.system_accounts=None
        self.actor_safe=('SYSTEM_USER' not in grants and db.scalar('SELECT CURRENT_ROLE()')=='NONE') if self.system_accounts is None else self.actor not in self.system_accounts
        self.defaults={}
        for schema in ('cloud','cloud_usage'):
            candidates={owner for key,owner in self.existing.items() if key.startswith(schema+'.') and self.safe(owner)}
            self.defaults[schema]=override or (next(iter(candidates)) if len(candidates)==1 else self.actor if self.actor_safe else None)

    def safe(self,owner):
        return owner not in self.system_accounts if self.system_accounts is not None else owner==self.actor and self.actor_safe

    def owner(self,name):
        if name in self.resolved:return self.resolved[name]
        previous=self.existing.get(name)
        if previous and not self.safe(previous) and not self.override:
            raise GuardError('Protected or unverifiable routine DEFINER '+previous+' on '+name+'; restore the application owner before replay or specify --routine-definer explicitly')
        owner=previous if previous and self.safe(previous) else self.defaults.get(name.split('.')[0])
        if not owner or '@' not in owner:raise GuardError('Cannot infer application routine owner for '+name+'; use --routine-definer user@host')
        if not self.safe(owner):raise GuardError('Routine owner must be a verified non-SYSTEM_USER application account: '+owner)
        if owner!=self.actor:
            if not self.can_set_other:raise GuardError('Current DB account cannot preserve DEFINER '+owner+'; use a DB administrator')
            user,host=owner.rsplit('@',1)
            if self.db.scalar('SELECT EXISTS(SELECT 1 FROM mysql.user WHERE User='+lit(user)+' AND Host='+lit(host)+')')!='1':raise GuardError('Routine owner account does not exist: '+owner)
        self.resolved[name]=owner;return owner

    def create(self,name,body):
        user,host=self.owner(name).rsplit('@',1)
        sql,count=re.subn(r'^CREATE\s+PROCEDURE\b','CREATE DEFINER='+quoted(user)+'@'+quoted(host)+' PROCEDURE',body,count=1,flags=re.I)
        if count!=1:raise GuardError('Unsupported procedure CREATE header: '+name)
        return sql


class Replay:
    def __init__(self,args,work,db,statements,helpers,policies):
        self.a=args;self.work=work;self.db=db;self.statements=statements;self.helpers=helpers;self.policies=policies
        self.schema=Schema(db,statements);self.count=collections.Counter();self.loaded=set();self.temporary=set();self.run_seen=set()
        self.definers=None
        self.log=open(work/'actions.jsonl','w',encoding='utf-8');self.sql_log=open(work/'executed.sql','w',encoding='utf-8')
        self.done=set(db.query('SELECT statement_id FROM '+JOURNAL)) if self.schema.exists(JOURNAL) else set()
        self.pending=[s for s in statements if self.persistent(s) and s.identity not in self.done]

    def persistent(self,s):return s.kind not in ('SESSION','ROUTINE','TEMP') and not s.temporary_insert

    def event(self,status,s,detail=''):
        self.count[status]+=1
        self.log.write(json.dumps(dict(status=status,file=s.file,line=s.line,kind=s.kind,statement_id=s.identity,sql_sha256=s.digest,detail=detail),ensure_ascii=False)+'\n');self.log.flush()
        if status in ('FAILED','PENDING'):print('['+status+'] '+s.file+':'+str(s.line)+' '+s.kind+' '+detail,flush=True)

    def mark(self,s,status):
        self.db.query('INSERT INTO '+JOURNAL+' (statement_id,source_file,source_line,statement_sha256,statement_kind,result,sql_text) VALUES ('+','.join([lit(s.identity),lit(s.file),str(s.line),lit(s.digest),lit(s.kind),lit(status),lit(s.sql)])+')')

    def create_journal(self):
        self.db.query('CREATE TABLE IF NOT EXISTS '+JOURNAL+''' (
          statement_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
          source_file VARCHAR(255) NOT NULL,source_line INT NOT NULL,statement_sha256 CHAR(64) NOT NULL,
          statement_kind VARCHAR(24) NOT NULL,result VARCHAR(32) NOT NULL,sql_text MEDIUMTEXT NOT NULL,
          applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')
        self.db.query('CREATE TABLE IF NOT EXISTS '+INFLIGHT+''' (
          statement_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
          source_file VARCHAR(255) NOT NULL,source_line INT NOT NULL,sql_text MEDIUMTEXT NOT NULL,
          started_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')

    def ensure_helper(self,name):
        if name in self.loaded:return
        if name not in self.helpers:raise GuardError('No helper definition available: '+name)
        body=self.helpers[name]
        validate_data_helper(name,body)
        self.db.query('DROP PROCEDURE IF EXISTS '+qt(name))
        self.db.query(self.definers.create(name,guarded_helper(name,body)));self.loaded.add(name)

    def data_statement(self,s,sql):
        data=call(sql)
        if data:
            name=data[0]+'.'+data[1]
            if name not in self.loaded:self.ensure_helper(name)
        self.db.query('START TRANSACTION')
        try:
            if data and data[1]=='IDEMPOTENT_UPDATE_API_PERMISSION' and self.db.scalar('SELECT EXISTS(SELECT 1 FROM cloud.roles WHERE name='+lit(data[2][0])+' AND is_default=1)')!='1':pass
            elif re.match(r'INSERT\b',sql,re.I):
                rewritten=guarded_insert(sql,self.schema,self.policies)
                self.db.query(rewritten,allow_duplicate=bool(re.match(r'INSERT\s+IGNORE\b',sql,re.I)))
            else:self.db.query(sql)
            self.mark(s,'APPLIED');self.db.query('COMMIT')
        except BaseException:
            # Connection loss closes/rolls back an uncommitted InnoDB transaction.
            if self.db.p.poll() is None:
                try:self.db.query('ROLLBACK')
                except Exception:pass
            raise

    def execute(self):
        if not self.a.apply:
            self.db.query('SET SESSION TRANSACTION READ ONLY')
            for s in self.statements:
                if not self.persistent(s):continue
                if s.identity in self.done or s.identity in self.run_seen:self.event('SKIPPED_HISTORY',s)
                else:self.event('PENDING',s,' '.join(s.sql.split())[:140]);self.run_seen.add(s.identity)
            return
        if not self.pending:
            for s in self.statements:
                if self.persistent(s):self.event('SKIPPED_HISTORY',s)
            return
        nontransactional=self.db.query("SELECT CONCAT(TABLE_SCHEMA,'.',TABLE_NAME,':',ENGINE) FROM information_schema.TABLES WHERE TABLE_SCHEMA IN ('cloud','cloud_usage') AND TABLE_TYPE='BASE TABLE' AND ENGINE <> 'InnoDB'")
        if nontransactional:raise GuardError('DML journaling requires InnoDB; found '+', '.join(nontransactional))
        self.definers=RoutineDefiners(self.db,self.a.routine_definer)
        for s in self.statements:
            if s.kind=='ROUTINE' and re.match('CREATE',s.sql,re.I):self.definers.owner(proc_name(s.sql))
            if s.kind=='CALL' and s.identity not in self.done:
                data=call(s.sql);self.definers.owner(data[0]+'.'+data[1])
        backup(self.a,self.work);self.create_journal()
        previous=None
        for s in self.statements:
            if s.file!=previous:print('\nReading '+s.file,flush=True);previous=s.file
            if self.persistent(s) and (s.identity in self.done or s.identity in self.run_seen):self.event('SKIPPED_HISTORY',s);continue
            try:
                sql=rewrite_tables(s.sql,self.schema) if s.kind in ('INSERT','UPDATE','DELETE') else s.sql
                if s.kind=='ROUTINE':
                    name=proc_name(sql)
                    self.db.query(self.definers.create(name,guarded_helper(name,sql)) if re.match('CREATE',sql,re.I) else sql)
                    if re.match('CREATE',sql,re.I):self.loaded.add(name)
                    else:self.loaded.discard(name)
                    self.event('SESSION',s);continue
                if s.kind=='SESSION':
                    if re.match(r'PREPARE|DEALLOCATE',sql,re.I):pass # EXECUTE is guarded using the variable's actual SQL.
                    else:self.db.query(sql)
                    self.event('SESSION',s);continue
                if s.kind=='TEMP':
                    self.db.query(sql);self.event('SESSION',s);continue
                if s.temporary_insert:
                    self.db.query(sql);self.event('SESSION',s);continue
                effective=sql
                if s.kind=='EXECUTE':
                    effective=self.db.scalar('SELECT '+s.prepared_variable)
                    if not effective:raise GuardError('Prepared SQL variable is empty')
                effective_kind=raw_kind(effective)
                self.sql_log.write('-- '+s.file+':'+str(s.line)+' '+s.identity+'\n'+effective.rstrip(';')+';\n\n');self.sql_log.flush()
                if effective_kind=='DDL' or effective_kind=='SESSION' and re.fullmatch(r'SELECT\s+1',effective,re.I):
                    self.db.query('INSERT INTO '+INFLIGHT+' (statement_id,source_file,source_line,sql_text) VALUES ('+','.join([lit(s.identity),lit(s.file),str(s.line),lit(effective)])+') ON DUPLICATE KEY UPDATE sql_text=VALUES(sql_text)')
                    changed=self.schema.execute(effective)
                    self.db.query('START TRANSACTION')
                    try:
                        self.mark(s,'APPLIED' if changed else 'ALREADY_PRESENT')
                        self.db.query('DELETE FROM '+INFLIGHT+' WHERE statement_id='+lit(s.identity));self.db.query('COMMIT')
                    except BaseException:
                        self.db.query('ROLLBACK');raise
                    self.event('APPLIED' if changed else 'ALREADY_PRESENT',s)
                elif effective_kind in ('INSERT','UPDATE','DELETE','CALL'):
                    self.data_statement(s,effective);self.event('APPLIED',s)
                else:raise GuardError('Unsupported prepared statement type: '+effective_kind)
                self.done.add(s.identity);self.run_seen.add(s.identity)
            except BaseException as exc:
                self.event('FAILED',s,str(exc));raise

    def finish(self,error=None):
        summary=dict(mode='APPLY' if self.a.apply else 'PLAN',sql_directory=str(self.a.sql_dir),
            counts=dict(self.count),error=error,mysql_version=self.db.version,
            backup=str(self.work/'backup.sql.gz') if (self.work/'backup.sql.gz').exists() else None,
            journal=JOURNAL,routine_definers=self.definers.resolved if self.definers else {},finished_at=datetime.datetime.now().astimezone().isoformat())
        (self.work/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
        self.log.close();self.sql_log.close()
        print('\nResults:',self.work,'\nCounts:',dict(self.count),flush=True)
        return 1 if error else 2 if self.count['PENDING'] else 0


def main():
    parser=argparse.ArgumentParser(prog='mold-schema-repair.sh',description='Read current SQL files in version/file order; journal UPDATE/DELETE/INSERT atomically; default is read-only plan.')
    mode=parser.add_mutually_exclusive_group();mode.add_argument('--apply',action='store_true');mode.add_argument('--plan',action='store_true');mode.add_argument('--list',action='store_true')
    parser.add_argument('--sql-dir',type=Path);parser.add_argument('--minimum-version',type=int,default=41810)
    parser.add_argument('--insert-keys',type=Path,default=HERE/'insert-keys.json')
    parser.add_argument('--routine-definer',help='Application MySQL user@host for new/protected routine ownership; existing normal owners are preserved')
    parser.add_argument('--defaults-extra-file',dest='config',type=Path)
    parser.add_argument('--host',default='localhost');parser.add_argument('--port',type=int,default=3306);parser.add_argument('--user',default='root');parser.add_argument('--socket')
    parser.add_argument('--mysql',default='mysql');parser.add_argument('--mysqldump',default='mysqldump');parser.add_argument('--timeout',type=int,default=600)
    parser.add_argument('--work-dir',type=Path)
    args=parser.parse_args();os.umask(0o077);args.sql_dir=sql_directory(args.sql_dir)
    sources,statements,helpers=read_sources(args.sql_dir,args.minimum_version)
    if args.list:
        for name,text in sources.items():print(name,hashlib.sha256(text.encode()).hexdigest(),sum(s.file==name for s in statements))
        print('Files:',len(sources),'Statements:',len(statements));return 0
    if not shutil.which(args.mysql):raise RuntimeError('mysql CLI not found')
    policies=json.loads(args.insert_keys.read_text(encoding='utf-8'))
    if args.apply:services_stopped()
    if args.work_dir:
        work=args.work_dir.expanduser().absolute();work.mkdir(mode=0o700,parents=True,exist_ok=False)
    else:work=Path(tempfile.mkdtemp(prefix='mold-schema-replay-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'-',dir='/root' if os.geteuid()==0 and Path('/root').is_dir() else os.getcwd()))
    print('Current SQL directory:',args.sql_dir,'\nResults:',work,flush=True)
    (work/'sources').mkdir()
    for name,text in sources.items():(work/'sources'/name).write_text(text,encoding='utf-8')
    (work/'sources/procedures').mkdir()
    for name,body in helpers.items():(work/'sources/procedures'/(name+'.sql')).write_text('DELIMITER $$\n'+body+'$$\nDELIMITER ;\n',encoding='utf-8')
    (work/'source-manifest.json').write_text(json.dumps(dict(sql_directory=str(args.sql_dir),sources_sha256={n:hashlib.sha256(t.encode()).hexdigest() for n,t in sources.items()},helper_definitions_sha256={n:hashlib.sha256(t.encode()).hexdigest() for n,t in helpers.items()}),indent=2)+'\n')
    shutil.copy2(args.insert_keys,work/'insert-keys.json')
    db=None;replay=None
    with tempfile.TemporaryDirectory(prefix='mold-replay-auth-') as auth:
        if args.config:args.config=args.config.expanduser().resolve(strict=True)
        else:
            password=getpass.getpass('MySQL '+args.user+' password: ')
            escaped=lambda value:'"'+str(value).replace('\\','\\\\').replace('"','\\"').replace('\n','\\n').replace('\r','\\r')+'"'
            config=Path(auth)/'client.cnf';config.write_text('[client]\nuser='+escaped(args.user)+'\npassword='+escaped(password)+'\nhost='+escaped(args.host)+'\nport='+str(args.port)+'\n'+('socket='+escaped(args.socket)+'\n' if args.socket else ''));config.chmod(0o600);args.config=config;del password
        try:
            db=Mysql(args,work)
            if db.scalar("SELECT GET_LOCK('mold_schema_replay_v1',0)")!='1':raise RuntimeError('Another replay is running')
            if db.scalar("SELECT GET_LOCK('mold_missing_schema_repair_v1',0)")!='1':raise RuntimeError('The older schema repair tool is running')
            if db.scalar("SELECT EXISTS(SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='cloud_usage')")!='1':raise RuntimeError('Existing cloud and cloud_usage databases are required')
            replay=Replay(args,work,db,statements,helpers,policies)
            if not replay.done:print('FIRST RUN: original UPDATE and DELETE statements will be applied. Existing migration history cannot be inferred automatically.',flush=True)
            try:replay.execute()
            except BaseException as exc:
                replay.finish(str(exc));raise
            return replay.finish()
        finally:
            if db:db.close()


if __name__=='__main__':
    try:sys.exit(main())
    except KeyboardInterrupt:print('Interrupted. Review the journal and results before retry.',file=sys.stderr);sys.exit(130)
    except Exception as exc:print('ERROR: '+str(exc),file=sys.stderr);sys.exit(1)
