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
"""Idempotency checks around DDL read from the current SQL source files."""
import hashlib
import re
from mysql_client import qi,qt,lit
from sql_source import call,split_items


class GuardError(RuntimeError):
    pass


def table_name(value,default='cloud'):
    parts=value.strip().replace('`','').split('.')
    if len(parts)==1:parts.insert(0,default)
    if len(parts)!=2 or parts[0] not in ('cloud','cloud_usage'):raise GuardError('Only cloud / cloud_usage tables are supported: '+value)
    for p in parts:qi(p)
    return '.'.join(parts)


def type_signature(definition):
    hit=re.match(r'(\w+(?:\([^)]*\))?)(\s+unsigned)?',definition,re.I)
    if not hit:raise GuardError('Unrecognized column type: '+definition)
    value=re.sub(r'\bbool(?:ean)?\b','tinyint',hit[0].lower())
    value=re.sub(r'\binteger\b','int',value)
    return re.sub(r'\b(tinyint|smallint|mediumint|int|bigint)\(\d+\)',r'\1',value)


def index_spec(definition):
    parts=split_items(definition[definition.index('(')+1:definition.rindex(')')]);columns=[]
    for part in parts:
        hit=re.fullmatch(r'`?(\w+)`?(?:\s*\(\s*(\d+)\s*\))?(?:\s+(ASC|DESC))?',part,re.I)
        if not hit:raise GuardError('Unsupported index expression: '+part)
        columns.append((hit[1].lower(),int(hit[2]) if hit[2] else None,'D' if (hit[3] or '').upper()=='DESC' else 'A'))
    return bool(re.match(r'(UNIQUE|PRIMARY)',definition,re.I)),columns


DDL_PROCS={
 'IDEMPOTENT_ADD_COLUMN','IDEMPOTENT_CHANGE_COLUMN','IDEMPOTENT_MODIFY_COLUMN_CHAR_SET',
 'IDEMPOTENT_ADD_KEY','IDEMPOTENT_ADD_UNIQUE_KEY','IDEMPOTENT_ADD_UNIQUE_INDEX',
 'IDEMPOTENT_DROP_COLUMN','IDEMPOTENT_DROP_INDEX','IDEMPOTENT_DROP_UNIQUE_KEY',
 'IDEMPOTENT_ADD_FOREIGN_KEY','IDEMPOTENT_DROP_FOREIGN_KEY',
}


class Schema:
    def __init__(self,db,statements):
        self.db=db;self.aliases={};self.column_aliases={};self.final_indexes={};self.final_fks={};self.final_column_types={};column_definitions=[]
        for statement in statements:
            sql=statement.sql
            for old,new in re.findall(r'RENAME TABLE\s+([^\s]+)\s+TO\s+([^\s\'\"]+)',sql,re.I):
                self.aliases[table_name(old)]=table_name(new)
            data=call(sql)
            direct=re.fullmatch(r'ALTER TABLE\s+([^\s]+)\s+MODIFY\s+(?:COLUMN\s+)?`?(\w+)`?\s+(.*)',sql,re.I|re.S)
            if direct:column_definitions.append((table_name(direct[1]),direct[2],direct[3]))
            if not data:continue
            schema,name,args=data
            if name=='IDEMPOTENT_CHANGE_COLUMN' and args[1]!=args[2]:self.column_aliases[(table_name(args[0],schema),args[1])]=args[2]
            if name=='IDEMPOTENT_CHANGE_COLUMN':column_definitions.append((table_name(args[0],schema),args[2],args[3]))
            if name=='IDEMPOTENT_MODIFY_COLUMN_CHAR_SET':column_definitions.append((table_name(args[0],schema),args[1],args[2]))
            if name=='IDEMPOTENT_ADD_KEY':
                key,t,cols=args;self.final_indexes[(table_name(t,schema),key)]='KEY '+qi(key)+' '+cols
            if name in ('IDEMPOTENT_ADD_UNIQUE_KEY','IDEMPOTENT_ADD_UNIQUE_INDEX'):
                t,key,cols=args;self.final_indexes[(table_name(t,schema),key)]='UNIQUE KEY '+qi(key)+' '+cols
            if name=='IDEMPOTENT_ADD_FOREIGN_KEY':
                t,key,cols,ref=args;self.final_fks[(table_name(t,schema),key)]='CONSTRAINT '+qi(key)+' FOREIGN KEY '+cols+' REFERENCES '+ref+' ON DELETE CASCADE'
        for t,col,definition in column_definitions:
            col=self.column_aliases.get((t,col),col);t=self.aliases.get(t,t)
            self.final_column_types[(t,col.lower())]=type_signature(definition)

    def exists(self,t):
        schema,name=t.split('.')
        return self.db.scalar('SELECT EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA='+lit(schema)+' AND TABLE_NAME='+lit(name)+')')=='1'

    def resolve(self,t):
        return self.aliases[t] if t in self.aliases and not self.exists(t) and self.exists(self.aliases[t]) else t

    def columns(self,t):
        s,n=t.split('.')
        rows=self.db.objects('information_schema.COLUMNS',['COLUMN_NAME','COLUMN_TYPE','IS_NULLABLE','COLUMN_DEFAULT','EXTRA','CHARACTER_SET_NAME','COLLATION_NAME'], 'TABLE_SCHEMA='+lit(s)+' AND TABLE_NAME='+lit(n))
        return {r['COLUMN_NAME'].lower():r for r in rows}

    def indexes(self,t):
        s,n=t.split('.')
        rows=self.db.objects('information_schema.STATISTICS',['INDEX_NAME','NON_UNIQUE','SEQ_IN_INDEX','COLUMN_NAME','SUB_PART','COLLATION'], 'TABLE_SCHEMA='+lit(s)+' AND TABLE_NAME='+lit(n))
        result={}
        for r in sorted(rows,key=lambda x:x['SEQ_IN_INDEX']):result.setdefault(r['INDEX_NAME'],[]).append(r)
        return result

    def fk(self,t,name):
        s,n=t.split('.')
        rows=self.db.query("SELECT JSON_OBJECT('column',k.COLUMN_NAME,'ref_schema',k.REFERENCED_TABLE_SCHEMA,'ref_table',k.REFERENCED_TABLE_NAME,'ref_column',k.REFERENCED_COLUMN_NAME,'pos',k.ORDINAL_POSITION,'delete',r.DELETE_RULE,'update',r.UPDATE_RULE) FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA="+lit(s)+' AND k.TABLE_NAME='+lit(n)+' AND k.CONSTRAINT_NAME='+lit(name)+' ORDER BY k.ORDINAL_POSITION')
        import json
        return [json.loads(x) for x in rows]

    @staticmethod
    def actual_index(rows):
        return (not bool(rows[0]['NON_UNIQUE']),[(r['COLUMN_NAME'].lower(),r['SUB_PART'],r['COLLATION']) for r in rows])

    def add_index(self,t,name,definition):
        current=self.indexes(t).get(name);wanted=index_spec(definition)
        if current and self.actual_index(current)==wanted:return False
        # A single ALTER retains the old index if the replacement cannot be created.
        prefix=('DROP PRIMARY KEY' if name=='PRIMARY' else 'DROP INDEX '+qi(name))+', ' if current else ''
        self.db.query('ALTER TABLE '+qt(t)+' '+prefix+'ADD '+definition);return True

    def add_fk(self,t,name,definition):
        hit=re.search(r'FOREIGN KEY(?:\s+`\w+`)?\s*\(([^)]+)\)\s+REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)',definition,re.I)
        if not hit:raise GuardError('Unsupported FK definition: '+definition)
        cols=[x.strip().strip('`').lower() for x in hit[1].split(',')]
        ref=table_name(hit[2],t.split('.')[0]);rcols=[x.strip().strip('`').lower() for x in hit[3].split(',')]
        def rule(word):
            h=re.search(r'ON '+word+r'\s+(CASCADE|RESTRICT|NO ACTION|SET NULL)',definition,re.I)
            value=h[1].upper() if h else 'RESTRICT';return 'RESTRICT' if value=='NO ACTION' else value
        wanted=(cols,ref,rcols,rule('DELETE'),rule('UPDATE'))
        def spec(rows):
            norm=lambda r:'RESTRICT' if r=='NO ACTION' else r
            return ([r['column'].lower() for r in rows],rows[0]['ref_schema']+'.'+rows[0]['ref_table'],[r['ref_column'].lower() for r in rows],norm(rows[0]['delete']),norm(rows[0]['update']))
        stage='mold_replay_fk_'+hashlib.sha256((t+name+definition).encode()).hexdigest()[:24]
        current=self.fk(t,name);staged=self.fk(t,stage)
        if staged and spec(staged)!=wanted:raise GuardError('Staging FK name has different definition: '+stage)
        if current and spec(current)==wanted:
            if staged:self.db.query('ALTER TABLE '+qt(t)+' DROP FOREIGN KEY '+qi(stage));return True
            return False
        if current:
            if not staged:
                replacement=re.sub(r'^CONSTRAINT\s+`?\w+`?', 'CONSTRAINT '+qi(stage),definition,flags=re.I)
                self.db.query('ALTER TABLE '+qt(t)+' ADD '+replacement)
            self.db.query('ALTER TABLE '+qt(t)+' DROP FOREIGN KEY '+qi(name))
            staged=True
        self.db.query('ALTER TABLE '+qt(t)+' ADD '+definition)
        if staged:self.db.query('ALTER TABLE '+qt(t)+' DROP FOREIGN KEY '+qi(stage))
        return True

    def change_column(self,t,old,new,definition):
        columns=self.columns(t)
        if old.lower() not in columns:
            if new.lower() in columns:return self.change_column(t,new,new,definition)
            raise GuardError('Both source and destination column are missing: '+t+'.'+old+' -> '+new)
        if old!=new and new.lower() in columns:raise GuardError('Both old/new columns exist: '+t+'.'+old)
        actual=columns[old.lower()];wanted=type_signature(definition);present=type_signature(actual['COLUMN_TYPE'])
        target_charset=re.search(r'CHARACTER SET\s+(\w+)',definition,re.I)
        same_charset=not target_charset or actual['CHARACTER_SET_NAME']==target_charset[1]
        # Do not undo a later width increase while replaying an older file.
        old_width=re.fullmatch(r'(varchar|char)\((\d+)\)',present)
        new_width=re.fullmatch(r'(varchar|char)\((\d+)\)',wanted)
        final_type=self.final_column_types.get((t,new.lower()),wanted)
        final_width=re.fullmatch(r'(varchar|char)\((\d+)\)',final_type)
        already_later=old_width and new_width and final_width and old_width[1]==new_width[1]==final_width[1] and wanted!=final_type and int(old_width[2])>=int(final_width[2])
        if old==new and (wanted==present or already_later) and same_charset:return False
        definition=re.sub(r'\s+(?:AFTER\s+`?\w+`?|FIRST)\s*$','',definition,flags=re.I)
        if old==new:self.db.query('ALTER TABLE '+qt(t)+' MODIFY COLUMN '+qi(old)+' '+definition)
        else:self.db.query('ALTER TABLE '+qt(t)+' CHANGE COLUMN '+qi(old)+' '+qi(new)+' '+definition)
        return True

    def procedure(self,data):
        schema,name,a=data;t=self.resolve(table_name(a[0],schema)) if a else None
        if name=='IDEMPOTENT_ADD_COLUMN':
            col,definition=a[1:];columns=self.columns(t)
            if col.lower() in columns:return False
            alias=self.column_aliases.get((t,col))
            if alias and alias.lower() in columns:return False
            definition=re.sub(r'\s+(?:AFTER\s+`?\w+`?|FIRST)\s*$','',definition,flags=re.I)
            self.db.query('ALTER TABLE '+qt(t)+' ADD COLUMN '+qi(col)+' '+definition);return True
        if name=='IDEMPOTENT_DROP_COLUMN':
            if a[1].lower() not in self.columns(t):return False
            self.db.query('ALTER TABLE '+qt(t)+' DROP COLUMN '+qi(a[1]));return True
        if name=='IDEMPOTENT_CHANGE_COLUMN':return self.change_column(t,*a[1:])
        if name=='IDEMPOTENT_MODIFY_COLUMN_CHAR_SET':return self.change_column(t,a[1],a[1],a[2]+' CHARACTER SET utf8mb4 '+a[3])
        if name=='IDEMPOTENT_ADD_KEY':
            key,raw,cols=a;t=self.resolve(table_name(raw,schema));return self.add_index(t,key,'KEY '+qi(key)+' '+cols)
        if name in ('IDEMPOTENT_ADD_UNIQUE_KEY','IDEMPOTENT_ADD_UNIQUE_INDEX'):
            return self.add_index(t,a[1],'UNIQUE KEY '+qi(a[1])+' '+a[2])
        if name in ('IDEMPOTENT_DROP_INDEX','IDEMPOTENT_DROP_UNIQUE_KEY'):
            if name=='IDEMPOTENT_DROP_INDEX':key,raw=a;t=self.resolve(table_name(raw,schema))
            else:key=a[1]
            if key not in self.indexes(t):return False
            future=self.final_indexes.get((t,key))
            # If a newer DB already has the final replacement, retain it. Otherwise
            # honor the original DROP position; an intervening DML/ADD COLUMN may
            # be a prerequisite for the subsequent ADD INDEX.
            if future and self.actual_index(self.indexes(t)[key])==index_spec(future):return False
            self.db.query('ALTER TABLE '+qt(t)+' DROP INDEX '+qi(key));return True
        if name=='IDEMPOTENT_ADD_FOREIGN_KEY':
            return self.add_fk(t,a[1],'CONSTRAINT '+qi(a[1])+' FOREIGN KEY '+a[2]+' REFERENCES '+a[3]+' ON DELETE CASCADE')
        if name=='IDEMPOTENT_DROP_FOREIGN_KEY':
            if not self.fk(t,a[1]):return False
            self.db.query('ALTER TABLE '+qt(t)+' DROP FOREIGN KEY '+qi(a[1]));return True
        raise GuardError('Unknown DDL helper: '+name)

    def execute(self,sql):
        data=call(sql)
        if data and data[1] in DDL_PROCS:return self.procedure(data)
        hit=re.match(r'CREATE TABLE(?: IF NOT EXISTS)?\s+([^\s(]+)',sql,re.I)
        if hit:
            if self.exists(table_name(hit[1])):return False
            engine=re.search(r'\bENGINE\s*=\s*(\w+)',sql,re.I)
            storage=engine[1] if engine else self.db.scalar('SELECT @@default_storage_engine')
            if str(storage).lower()!='innodb':raise GuardError('New persistent tables must use InnoDB for atomic DML journaling')
            self.db.query(sql);return True
        hit=re.fullmatch(r'DROP TABLE(?: IF EXISTS)?\s+([^\s]+)',sql,re.I)
        if hit:
            if not self.exists(table_name(hit[1])):return False
            self.db.query(sql);return True
        hit=re.fullmatch(r'RENAME TABLE\s+([^\s]+)\s+TO\s+([^\s]+)',sql,re.I)
        if hit:
            old,new=table_name(hit[1]),table_name(hit[2])
            if not self.exists(old) and self.exists(new):return False
            if self.exists(old) and self.exists(new):raise GuardError('Both old/new tables exist: '+old+' / '+new)
            self.db.query(sql);return True
        hit=re.fullmatch(r'ALTER TABLE\s+([^\s]+)\s+(.*)',sql,re.I|re.S)
        if hit:
            t=self.resolve(table_name(hit[1]));action=hit[2]
            if m:=re.fullmatch(r'ADD\s+(?:COLUMN\s+)?`?(\w+)`?\s+(.*)',action,re.I|re.S):
                if m[1].upper() not in ('INDEX','KEY','CONSTRAINT','UNIQUE','PRIMARY'):
                    return self.procedure((t.split('.')[0],'IDEMPOTENT_ADD_COLUMN',[t,m[1],m[2]]))
            if m:=re.match(r'ADD\s+((?:UNIQUE\s+)?(?:INDEX|KEY)\s+`?(\w+)`?\s*\(.*)',action,re.I|re.S):return self.add_index(t,m[2],m[1])
            if m:=re.match(r'ADD\s+(CONSTRAINT\s+`?(\w+)`?\s+FOREIGN KEY.*)',action,re.I|re.S):return self.add_fk(t,m[2],m[1])
            if m:=re.fullmatch(r'DROP\s+(?:FOREIGN KEY|CONSTRAINT)\s+`?(\w+)`?',action,re.I):
                return self.procedure(('cloud','IDEMPOTENT_DROP_FOREIGN_KEY',[t,m[1]]))
            if m:=re.fullmatch(r'DROP INDEX\s+`?(\w+)`?',action,re.I):return self.procedure(('cloud','IDEMPOTENT_DROP_INDEX',[m[1],t]))
            if m:=re.fullmatch(r'DROP\s+(?:COLUMN\s+)?`?(\w+)`?',action,re.I):return self.procedure(('cloud','IDEMPOTENT_DROP_COLUMN',[t,m[1]]))
            if m:=re.fullmatch(r'MODIFY\s+(?:COLUMN\s+)?`?(\w+)`?\s+(.*)',action,re.I|re.S):return self.change_column(t,m[1],m[1],m[2])
            if m:=re.fullmatch(r'CHANGE\s+(?:COLUMN\s+)?`?(\w+)`?\s+`?(\w+)`?\s+(.*)',action,re.I|re.S):return self.change_column(t,*m.groups())
            if m:=re.fullmatch(r'CONVERT TO CHARACTER SET\s+(\w+)',action,re.I):
                s,n=t.split('.');collation=self.db.scalar('SELECT TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA='+lit(s)+' AND TABLE_NAME='+lit(n))
                if str(collation).startswith(m[1]+'_') and all(not c['CHARACTER_SET_NAME'] or c['CHARACTER_SET_NAME']==m[1] for c in self.columns(t).values()):return False
                self.db.query('ALTER TABLE '+qt(t)+' '+action);return True
            if t=='cloud.console_session' and re.match(r'DROP\s+`acquired`,\s*ADD\s+`acquired`',action,re.I):
                if self.columns(t).get('acquired',{}).get('COLUMN_TYPE')=='datetime':return False
                self.db.query(sql);return True
        if re.fullmatch(r'SELECT\s+1',sql,re.I):return False
        raise GuardError('Unsupported DDL; no statement executed: '+sql[:150])
