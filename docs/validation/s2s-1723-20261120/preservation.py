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

from pathlib import Path
import json,sys
out=Path('docs/validation/s2s-1723-20261120').resolve();sys.path.insert(0,str(out));from api_client import items,save
fields=['id','name','displaytext','state','resourcestate','allocationstate','account','domainid','projectid','vpcid','publicip','ipaddress','issourcenat','isstaticnat','fordisplay','cidr','networkdomain','vpcofferingid','zoneid','type','scope','hostid','virtualsize','isdefault','isredundant','redundantstate','removed','accounttype','roleid','roletype','isregular','forvpc','supportedservices']
report={'clusters':[],'comparisons':0,'failures':[]}
def compare(key,a,b):
 aa={x['id']:{k:x[k] for k in fields if k in x} for x in items(a)};bb={x['id']:{k:x[k] for k in fields if k in x} for x in items(b)}
 report['comparisons']+=len(aa)
 if aa!=bb:report['failures'].append(key)
 return {'inventory':key,'before':len(aa),'after':len(bb),'equal':aa==bb}
for c in [31,32]:
 before=json.loads((out/f'{c}-inventory-before.json').read_text());after=json.loads((out/f'{c}-inventory-after.json').read_text());rows=[]
 for key in before:
  if key in ['projects','vmReference']:continue
  rows.append(compare(str(c)+'/'+key,before[key],after[key]))
 assert set(before['projects'])==set(after['projects'])
 for project,commands in before['projects'].items():
  for command in commands:rows.append(compare(str(c)+'/'+project+'/'+command,commands[command],after['projects'][project][command]))
 assert before['vmReference']==after['vmReference'];report['comparisons']+=1
 report['clusters'].append({'cluster':c,'inventories':rows,'vmReferenceEqual':True,'testPrefixAbsent':not any('qa-s2s1723' in x.get('name','') for key in ['listAccounts','listDomains','listProjects','listVPCs'] for x in items(after[key]))})
 print(c,[(p['name'],p['id'],items(before['projects'][p['id']]['gateways-true'])) for p in items(before['listProjects']) if items(before['projects'][p['id']]['gateways-true'])],flush=True)
save('preservation-check.json',report);print('preserved entities',report['comparisons'],'failures',report['failures']);assert not report['failures'] and all(x['testPrefixAbsent'] for x in report['clusters'])
