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
"""Read SQL and mysql DELIMITER directives; never embed a schema snapshot."""
from dataclasses import dataclass
import hashlib
from pathlib import Path
import re


class SourceError(ValueError):
    pass


def canonical(sql):
    tokens=re.findall(r"'(?:\\.|''|[^'\\])*'|\"(?:\\.|\"\"|[^\"\\])*\"|`(?:``|[^`])*`|[A-Za-z_][\w$]*|\d+(?:\.\d+)?|<>|<=|>=|:=|!=|\S",sql,re.S)
    return '\x1f'.join(tokens)


@dataclass
class Statement:
    file: str
    line: int
    sql: str
    context: str = ''

    @property
    def digest(self):
        # The lexer strips comments. Preserve whitespace INSIDE literals.
        return hashlib.sha256(canonical(self.sql).encode('utf-8')).hexdigest()

    @property
    def identity(self):
        return hashlib.sha256(('mold-sql-replay-v1\0'+self.file+'\0'+self.digest+'\0'+self.context).encode()).hexdigest()


def routine_unfinished(sql):
    """Diplo also stores compound procedures without mysql DELIMITER directives.

    Count BEGIN/END blocks outside quoted tokens; CASE expressions have their
    own END. END IF/LOOP/WHILE/REPEAT do not close a BEGIN block.
    """
    if not re.match(r'CREATE\s+PROCEDURE\b',sql,re.I):return False
    tokens=canonical(sql).split('\x1f');blocks=[];seen=False;i=0
    while i<len(tokens):
        token=tokens[i].upper()
        if token=='BEGIN':blocks.append('BEGIN');seen=True
        elif seen and token=='CASE':blocks.append('CASE')
        elif seen and token=='END':
            following=tokens[i+1].upper() if i+1<len(tokens) else ''
            if following in ('IF','LOOP','WHILE','REPEAT'):i+=1
            else:
                if not blocks:raise SourceError('Unbalanced END in procedure')
                block=blocks.pop()
                if following=='CASE':
                    if block!='CASE':raise SourceError('Unbalanced END CASE in procedure')
                    i+=1
        i+=1
    return seen and bool(blocks)


def parse(text, filename='<sql>'):
    if text.startswith('\ufeff'):text=text[1:]
    result=[];buf=[];quote=None;delimiter=';';line=1;start=1;i=0;line_start=True
    while i<len(text):
        c=text[i]
        if quote:
            buf.append(c)
            if c=='\\' and i+1<len(text):
                i+=1;buf.append(text[i])
                if text[i]=='\n':line+=1
            elif c==quote:
                if i+1<len(text) and text[i+1]==quote:i+=1;buf.append(text[i])
                else:quote=None
            if c=='\n':line+=1
            i+=1;continue
        if line_start:
            match=re.match(r'[ \t]*DELIMITER[ \t]+(\S+)[ \t]*(?:\r?\n|$)',text[i:],re.I)
            if match:
                if ''.join(buf).strip():raise SourceError(f'{filename}:{line}: DELIMITER inside an unfinished statement')
                delimiter=match[1];line+=match[0].count('\n');i+=len(match[0]);continue
        if text.startswith('--',i) and (i+2==len(text) or text[i+2].isspace() or text[i+2] in '-;') or c=='#':
            end=text.find('\n',i)
            if end<0:i=len(text);break
            buf.append(' ');i=end;continue
        if text.startswith('/*',i):
            end=text.find('*/',i+2)
            if end<0:raise SourceError(f'{filename}:{line}: unterminated comment')
            if text.startswith('/*!',i):raise SourceError(f'{filename}:{line}: executable version comment requires explicit SQL')
            line+=text[i:end+2].count('\n');buf.append(' ');i=end+2;continue
        if text.startswith(delimiter,i):
            sql=''.join(buf).strip()
            if delimiter==';' and routine_unfinished(sql):
                buf.append(';');i+=1;line_start=False;continue
            if sql:result.append(Statement(filename,start,sql))
            buf=[];i+=len(delimiter);line_start=False;continue
        if c in "'\"`":quote=c
        if not ''.join(buf).strip() and not c.isspace():start=line
        buf.append(c)
        if c=='\n':line+=1;line_start=True
        elif not c.isspace():line_start=False
        i+=1
    if quote:raise SourceError(f'{filename}:{line}: unterminated quoted value')
    if ''.join(buf).strip():raise SourceError(f'{filename}:{start}: missing final DELIMITER')
    if delimiter!=';':raise SourceError(f'{filename}:{line}: DELIMITER was not reset')
    return result


def discover(directory, minimum=41810):
    candidates=[]
    for p in Path(directory).iterdir():
        hit=re.fullmatch(r'schema-(\d+)to(\d+)\.sql',p.name)
        if hit and int(hit[1])>=minimum:
            if int(hit[2])<=int(hit[1]):raise SourceError('Invalid version range: '+p.name)
            candidates.append((int(hit[1]),int(hit[2]),p))
    files=[x[2] for x in sorted(candidates)]
    if not files:raise SourceError('No schema-NtoN.sql files found in '+str(directory))
    return files


def split_items(text):
    result=[];start=0;depth=0;quote=None;i=0
    while i<len(text):
        c=text[i]
        if quote:
            if c=='\\':i+=1
            elif c==quote:
                if i+1<len(text) and text[i+1]==quote:i+=1
                else:quote=None
        elif c in "'\"`":quote=c
        elif c=='(':depth+=1
        elif c==')':depth-=1
        elif c==',' and depth==0:result.append(text[start:i].strip());start=i+1
        i+=1
    result.append(text[start:].strip());return result


def unquote(text):
    text=text.strip()
    if not text or text[0] not in "'\"":return text
    q=text[0];text=text[1:-1].replace(q+q,q)
    return re.sub(r'\\(.)',lambda m:{'n':'\n','r':'\r','t':'\t','0':'\0'}.get(m[1],m[1]),text)


def call(sql):
    h=re.fullmatch(r'CALL\s+(?:(`?\w+`?)\.)?`?(\w+)`?\s*\((.*)\)',sql,re.I|re.S)
    if h:return ((h[1] or 'cloud').strip('`'),h[2].upper(),[unquote(x) for x in split_items(h[3])])
    return None


def select_parts(sql):
    """Return SELECT projection and suffix starting at top-level FROM (if any)."""
    h=re.match(r'SELECT\s+(DISTINCT\s+)?',sql,re.I)
    if not h:raise SourceError('Only explicit SELECT projections are supported')
    quote=None;depth=0;i=h.end()
    while i<len(sql):
        c=sql[i]
        if quote:
            if c=='\\':i+=1
            elif c==quote:
                if i+1<len(sql) and sql[i+1]==quote:i+=1
                else:quote=None
        elif c in "'\"`":quote=c
        elif c=='(':depth+=1
        elif c==')':depth-=1
        elif depth==0 and re.match(r'FROM\b',sql[i:],re.I) and i>0 and sql[i-1].isspace():
            return bool(h[1]),split_items(sql[h.end():i]),sql[i:]
        i+=1
    return bool(h[1]),split_items(sql[h.end():]),''
