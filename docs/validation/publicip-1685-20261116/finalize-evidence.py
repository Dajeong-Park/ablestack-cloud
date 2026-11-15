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
import json,re
OUT=Path(__file__).parent
SOURCE='133e1bbe8a8a10bfc3368a321a57595078cc68a0'
def read(name):return json.loads((OUT/name).read_text(encoding='utf-8'))
def save(name,data):(OUT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8',newline='\n')
history=read('ui-request-history.json')
# The first 27 records are the first deployment, including two flows repeated after enabling Network capture.
assert history[27]['case']=='31-ko-account-reserve' and len(history)==45
initial=[dict(x,source='ca35e918542ffc500fa0c2addd488830b6737a8f',synthetic='synthetic' in x['case']) for x in history[:27]]
final=[dict(x,source=SOURCE,synthetic=False) for x in history[27:43]]
retry=[dict(x,case=x['case'].replace('31-ko-account','31-final-explicit-retry'),source=SOURCE,synthetic=False) for x in history[43:]]
errors=[dict(x,source=SOURCE,synthetic=True) for x in read('ui-error-requests-final.json') if x['case']!='31-final-keyboard-first-submit']
save('ui-requests-initial.json',initial)
save('ui-requests.json',final+retry+errors)
checks=[]
for c in (31,32):
 for lang in ('ko','en'):
  for kind in ('account','project'):
   label=f'{c}-{lang}-{kind}'
   case=next(x for x in final if x['case']==label+'-reserve')
   posts=[r for r in case['requests'] if r['method']=='POST'];assert len(posts)==1
   r=posts[0];q=r['params'];ip=r['response']['reserveipaddressresponse']['ipaddress'];expected={'command','response','id','account','domainid'} if kind=='account' else {'command','response','id','projectid'}
   assert set(q)==expected and all(str(v).strip() and str(v) not in ('undefined','null') for v in q.values())
   assert r['status']==200 and ip['id']==q['id'] and ip['state']=='Reserved'
   assert (ip['account']==q['account'] and ip['domainid']==q['domainid'] and not ip.get('projectid')) if kind=='account' else ip['projectid']==q['projectid']
   assert len([r for r in case['requests'] if r['method']=='GET' and 'Reserved' in r['params'].get('state','') and r['status']==200])==2
   released=next(x for x in final if x['case']==label+'-release');writes=[r for r in released['requests'] if r['method']=='POST'];assert len(writes)==1 and writes[0]['status']==200 and writes[0]['response']['releaseipaddressresponse']['success']
   checks.append({'case':label,'pass':True,'reservePOST':1,'releasePOST':1,'expectedOwner':q.get('account') or q.get('projectid'),'actualOwner':ip.get('projectid') or ip.get('account')})
assert len(checks)==8
assert read('ui-keyboard-busy.json')=={'synthetic':True,'repeated':True,'cancelEnabled':False,'reserveEnabled':False}
unknown=next(x for x in errors if x['case']=='31-final-ctrl-enter-unknown-503')
assert len([r for r in unknown['requests'] if r['command']=='reserveIpAddress'])==1
assert (OUT/'31-final-unknown-390.txt').read_text(encoding='utf-8').count('    - alert:')==1
save('wire-contract-checks.json',checks)
checks=[]
for c in (31,32):
 b=read(f'{c}-inventory-before.json');a=read(f'{c}-inventory-after.json');target=read(f'{c}-target-final.json')['listpublicipaddressesresponse']['publicipaddress'][0]
 count=lambda d,k:d[k]['listpublicipaddressesresponse'].get('count',0)
 assert count(b,'Free')==count(a,'Free') and count(a,'ReservedAll')==count(b,'ReservedAll')==0 and target['state']=='Free'
 checks.append({'cluster':c,'freeBefore':count(b,'Free'),'freeAfter':count(a,'Free'),'reservedAllBefore':0,'reservedAllAfter':0,'testAddress':target['ipaddress'],'finalState':'Free'})
assert all(x['equal'] for x in read('preservation-check.json'))
fields={'allprojects': ['state', 'account', 'projectid', 'domainid', 'associatednetworkid', 'vpcid', 'issourcenat', 'isstaticnat', 'issystem', 'fordisplay', 'hasrules', 'virtualmachineid'], 'Free': ['state', 'account', 'projectid', 'domainid', 'associatednetworkid', 'vpcid', 'issourcenat', 'isstaticnat', 'issystem', 'fordisplay'], 'Reserved': ['state', 'account', 'projectid'], 'ReservedAll': ['state', 'account', 'projectid', 'domainid'], 'listNetworks': ['name', 'state', 'networkofferingid', 'cidr', 'account', 'projectid', 'vpcid'], 'listVPCs': ['name', 'state', 'vpcofferingid', 'cidr', 'account', 'projectid'], 'listVirtualMachines': ['name', 'displayname', 'state', 'hostid', 'account', 'projectid'], 'listProjects': ['name', 'state', 'domainid'], 'listAccounts': ['name', 'state', 'domainid'], 'listStoragePools': ['name', 'type', 'state', 'path']}
for c in (31,32):
 b=read(f'{c}-inventory-before.json');a=read(f'{c}-inventory-after.json')
 for scope,names in fields.items():
  def norm(d):
   body=next(iter(d[scope].values()));rows=next((v for v in body.values() if isinstance(v,list)),[])
   assert body.get('count',0)==len(rows)
   return {row['id']:{k:row.get(k) for k in names} for row in rows}
  assert norm(b)==norm(a),(c,scope)

save('cleanup-summary.json',checks)
# Reject credential values, without printing their contents.
issues=[]
def walk(x,path):
 if isinstance(x,dict):
  for k,v in x.items():
   if re.search('(password|secretkey|sessionkey|apikey|privatekey|ipsecpsk|accesskey|token)$',k,re.I) and v not in (None,'','[redacted]'):issues.append(path+'/'+k)
   walk(v,path+'/'+k)
 elif isinstance(x,list):
  for i,v in enumerate(x):walk(v,path+'/'+str(i))
for p in OUT.glob('*.json'):walk(json.loads(p.read_text(encoding='utf-8')),p.name)
assert not issues,issues
print('8 owner wire contracts PASS; 18 preservation scopes PASS; both test IPs Free; project-inclusive Reserved=0; credential scan PASS')
