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
"""Guard original INSERT projections by a declared or stable unique business key."""
import re
from mysql_client import qi,qt
from schema_ddl import table_name,GuardError
from sql_source import split_items,select_parts


def insert_parts(sql):
    hit=re.match(r'INSERT\s+(IGNORE\s+)?INTO\s+([^\s(]+)\s*\((.*?)\)\s*(.*)',sql,re.I|re.S)
    if not hit:raise GuardError('INSERT requires an explicit target column list')
    columns=[x.strip().strip('`') for x in split_items(hit[3])]
    for col in columns:qi(col)
    remainder=hit[4]
    if re.search(r'\bON\s+DUPLICATE\s+KEY\s+UPDATE\b',remainder,re.I):raise GuardError('ON DUPLICATE KEY UPDATE requires an explicit reviewed guard')
    if re.match(r'VALUES\b',remainder,re.I):
        tuples=split_items(re.sub(r'^VALUES\s*','',remainder,flags=re.I));selects=[]
        for tup in tuples:
            if not tup.startswith('(') or not tup.endswith(')'):raise GuardError('Unsupported VALUES tuple')
            values=split_items(tup[1:-1])
            if len(values)!=len(columns):raise GuardError('INSERT column / value count mismatch')
            selects.append('SELECT '+','.join(v+' AS '+qi(c) for c,v in zip(columns,values)))
        projection=' UNION ALL '.join(selects);expressions=values
    else:
        distinct,expressions,suffix=select_parts(remainder)
        if len(expressions)!=len(columns):raise GuardError('INSERT SELECT requires an explicit matching projection')
        # Existing aliases on source expressions must not be duplicated.
        strip_alias=lambda x:re.sub(r'\s+AS\s+`?\w+`?\s*$','',x,flags=re.I)
        expressions=[strip_alias(x) for x in expressions]
        projection='SELECT '+('DISTINCT ' if distinct else '')+','.join(v+' AS '+qi(c) for c,v in zip(columns,expressions))+' '+suffix
    return bool(hit[1]),table_name(hit[2]),columns,expressions,projection


def guarded_insert(sql,schema,policies):
    ignore,target,columns,expressions,projection=insert_parts(sql)
    target=schema.resolve(target);by_name={c.lower():v for c,v in zip(columns,expressions)}
    declared=policies.get(target)
    if declared:
        key=[x.lower() for x in declared]
        if any(x not in by_name for x in key):raise GuardError('Declared INSERT key is not in projection: '+target+' '+str(key))
    else:
        candidates=[]
        for rows in schema.indexes(target).values():
            if rows[0]['NON_UNIQUE'] or any(r['SUB_PART'] is not None or r['COLUMN_NAME'] is None for r in rows):continue
            cols=[r['COLUMN_NAME'].lower() for r in rows]
            if all(c in by_name and not re.search(r'\b(UUID|UUID_SHORT|NOW|RAND|RANDOM_BYTES|CURRENT_TIMESTAMP|SYSDATE)\b',by_name[c],re.I) for c in cols):candidates.append(cols)
        if not candidates:raise GuardError('Cannot infer a stable INSERT identity for '+target+'; declare its business key in insert-keys.json')
        key=min(candidates,key=len)
    # Window de-duplication also handles duplicate source rows when no physical unique
    # constraint exists on the logical key. NULL identity components compare with <=>.
    partition=','.join('src.'+qi(c) for c in key)
    ranked='SELECT src.*,ROW_NUMBER() OVER (PARTITION BY '+partition+' ORDER BY '+partition+') AS __mold_replay_rank FROM ('+projection+') src'
    match=' AND '.join('existing.'+qi(c)+' <=> candidate.'+qi(c) for c in key)
    return 'INSERT '+('IGNORE ' if ignore else '')+'INTO '+qt(target)+' ('+','.join(qi(c) for c in columns)+') SELECT '+','.join('candidate.'+qi(c) for c in columns)+' FROM ('+ranked+') candidate WHERE candidate.__mold_replay_rank=1 AND NOT EXISTS (SELECT 1 FROM '+qt(target)+' existing WHERE '+match+')'
