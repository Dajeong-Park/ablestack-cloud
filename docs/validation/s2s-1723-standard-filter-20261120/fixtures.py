# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.

from pathlib import Path
import ipaddress
import json
import os
import runpy
import sys
import concurrent.futures

out=Path('docs/validation/s2s-1723-standard-filter-20261120').resolve()
sys.path.insert(0,str(out))
from api_client import Mold,items,save,redact

def checked(mold,command,params=None):
 data=mold.call(command,params);body=next(iter(data.values()))
 if body.get('errorcode'):raise RuntimeError(command+' failed code='+str(body['errorcode']))
 return data

def inventory(cluster,suffix):
 mold=Mold(cluster)
 commands=['listZones','listClusters','listStoragePools','listHosts','listAccounts','listDomains','listProjects','listVPCOfferings','listVPCs','listPublicIpAddresses','listVpnConnections','listVpnCustomerGateways']
 result={command:checked(mold,command,{'listall':'true','page':1,'pagesize':500,**({'type':'Routing'} if command=='listHosts' else {})}) for command in commands}
 for command,data in result.items():
  body=next(iter(data.values()));assert int(body.get('count',0))<=500,command
 # Credentials are not part of preservation evidence. Drop account details and
 # embedded users before redaction, rather than merely replacing known keys.
 for account in items(result['listAccounts']):
  account.pop('accountdetails',None);account.pop('user',None)
 result['visibleGateways']=checked(mold,'listVpnGateways',{'listall':'true','fordisplay':'true','page':1,'pagesize':500})
 result['hiddenGateways']=checked(mold,'listVpnGateways',{'listall':'true','fordisplay':'false','page':1,'pagesize':500})
 result['projects']={}
 for project in items(result['listProjects']):
  result['projects'][project['id']]={}
  for command in ['listVPCs','listPublicIpAddresses','listVpnConnections']:
   result['projects'][project['id']][command]=checked(mold,command,{'projectid':project['id'],'listall':'true','page':1,'pagesize':500})
  for value in ['true','false']:
   result['projects'][project['id']]['gateways-'+value]=checked(mold,'listVpnGateways',{'projectid':project['id'],'listall':'true','page':1,'pagesize':500,'fordisplay':value})
 old=json.loads(Path('docs/validation/s2s-1722-20261120/'+str(cluster)+'-fixtures.json').read_text())['vmReference']
 rows=items(checked(mold,'listVirtualMachines',{'id':old['id'],'listall':'true'}));assert len(rows)==1
 result['vmReference']={key:rows[0][key] for key in old if key in rows[0]}
 save(str(cluster)+'-inventory-'+suffix+'.json',result)
 print(cluster,'inventory',suffix,'accounts',len(items(result['listAccounts'])),'projects',len(result['projects']),'routing hosts',len(items(result['listHosts'])),flush=True)
 return result

def create(cluster):
 mold=Mold(cluster)
 prefix='qa-s2s1723-standard-'+str(cluster);journal=out/(str(cluster)+'-fixtures.json')
 if journal.exists():
  f=json.loads(journal.read_text());before=json.loads((out/(str(cluster)+'-inventory-before.json')).read_text())
  assert f['prefix']==prefix
 else:
  before=inventory(cluster,'before')
  assert not any(a['name'].startswith(prefix) for a in items(before['listAccounts']))
  f={'prefix':prefix,'resources':[],'pending':{},'vmReference':before['vmReference']}
 def checkpoint():save(journal.name,f)
 if 'domain' in f and 'accountUser' not in f:
  users=items(checked(mold,'listAccounts',{'name':prefix+'-user','domainid':f['domain']['id'],'listall':'true'}))
  assert len(users)==1
  f['accountUser']=users[0];f.pop('user',None);checkpoint()
 if len(f['resources'])==4 and all(row.get('vpc') and row.get('sourceIp') for row in f['resources']):
  print(cluster,'existing journal already complete; no repeat creation',flush=True);return
 def tracked(key,command,params,field):
  if key not in f['pending']:
   f['pending'][key]=checked(mold,command,params);checkpoint()
  response=mold.wait(f['pending'][key]);body=next(iter(response.values()))
  assert not body.get('errorcode') and body.get('jobstatus',1)==1,redact(response)
  row=body.get('jobresult',body).get(field);assert row,redact(response)
  return row
 if 'domain' not in f:f['domain']=tracked('domain','createDomain',{'name':prefix+'-domain'},'domain');checkpoint()
 for name,kind in [('user',0),('domainadmin',2)]:
  key='accountUser' if name=='user' else name
  if key not in f:f[key]=tracked('account-'+name,'createAccount',{'username':prefix+'-'+name,'account':prefix+'-'+name,'password':os.environ['MOLD_PASSWORD'],'firstname':'S2S','lastname':'QA1723','email':prefix+'-'+name+'@example.invalid','accounttype':kind,'domainid':f['domain']['id']},'account');checkpoint()
 if 'project' not in f:f['project']=tracked('project','createProject',{'name':prefix+'-project','displaytext':'Disposable S2S1723 display-policy validation'},'project');checkpoint()
 zone=items(before['listZones'])[0]['id'];offering=next(x['id'] for x in items(before['listVPCOfferings']) if x['name']=='Default VPC offering')
 cidrs=[x['cidr'] for x in items(before['listVPCs'])]
 for project in before['projects'].values():cidrs.extend(x['cidr'] for x in items(project['listVPCs']))
 choices=[f'10.{n}.{cluster}.0/24' for n in range(221,241) if not any(ipaddress.ip_network(f'10.{n}.{cluster}.0/24').overlaps(ipaddress.ip_network(c,strict=False)) for c in cidrs)]
 assert len(choices)>=4
 for index,scope in enumerate(['global','user','domainadmin','project']):
  if len(f['resources'])<=index:f['resources'].append({'scope':scope});checkpoint()
  row=f['resources'][index];assert row['scope']==scope
  owner={'projectid':f['project']['id']} if scope=='project' else {'account':f['domainadmin' if scope=='domainadmin' else 'accountUser']['name'],'domainid':f['domain']['id']}
  if 'vpc' not in row:row['vpc']=tracked('vpc-'+scope,'createVPC',{'name':prefix+'-'+scope,'displaytext':'Disposable 1723 UI display fixture','cidr':choices[index],'zoneid':zone,'vpcofferingid':offering,**owner},'vpc');checkpoint()
  ips=items(checked(mold,'listPublicIpAddresses',{'vpcid':row['vpc']['id'],'listall':'true',**owner}))
  sources=[x for x in ips if x.get('issourcenat') is True];assert len(sources)==1
  row['sourceIp']=sources[0];checkpoint()
  print(cluster,scope,row['vpc']['id'],sources[0]['ipaddress'],flush=True)
 print(cluster,'fixture creation complete',flush=True)

if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(create,[31,32]))
