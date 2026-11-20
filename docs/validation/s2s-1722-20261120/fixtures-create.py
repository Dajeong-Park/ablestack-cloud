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

from api_client import *
import uuid

def result(data,key):
 body=next(iter(data.values()));assert not body.get('errorcode') and body.get('jobstatus',1)==1,redact(data)
 value=body.get('jobresult',body).get(key);assert value,redact(data);return value

def create(cluster):
 mold=Mold(cluster);before=json.loads((OUT/f'{cluster}-inventory-before.json').read_text())
 journal=OUT/f'{cluster}-fixtures.json';f=json.loads(journal.read_text()) if journal.exists() else {'prefix':f'qa-s2s1722-{cluster}','resources':[],'pending':{}}
 def checkpoint():save(journal.name,f)
 def tracked(key,command,params,field):
  if key not in f['pending']:
   f['pending'][key]=mold.call(command,params);checkpoint()
  return result(mold.wait(f['pending'][key]),field)
 prefix=f['prefix'];domain=next(a['domainid'] for a in items(before['listAccounts']) if a['name']=='admin')
 if 'account' not in f:
  assert not any(a['name'].startswith(prefix) for a in items(before['listAccounts']))
  f['account']=tracked('account','createAccount',{'username':prefix+'-user','account':prefix+'-user','password':os.environ['MOLD_PASSWORD'],'firstname':'S2S','lastname':'QA1722','email':prefix+'@example.invalid','accounttype':0,'domainid':domain},'account');checkpoint()
 if 'project' not in f:
  f['project']=tracked('project','createProject',{'name':prefix+'-project','displaytext':'Disposable 1722 candidate policy fixture'},'project');checkpoint()
 services=['Dhcp','Dns','UserData','NetworkACL','SourceNat','StaticNat','PortForwarding']
 if 'offering' not in f:
  params={'name':prefix+'-no-vpn','displaytext':'Disposable 1722 no-VPN offering','supportedservices':','.join(services)}
  for index,service in enumerate(services):params.update({f'serviceproviderlist[{index}].service':service,f'serviceproviderlist[{index}].provider':'VpcVirtualRouter'})
  f['offering']=tracked('offering','createVPCOffering',params,'vpcoffering');checkpoint()
 if f['offering']['state']!='Enabled':
  f['offering']=tracked('offering-enable','updateVPCOffering',{'id':f['offering']['id'],'state':'Enabled'},'vpcoffering');checkpoint()
 zone=items(before['listZones'])[0]['id'];standard=next(v['id'] for v in items(before['listVPCOfferings']) if v['name']=='Default VPC offering')
 for idx,scope in enumerate(['hidden','source','novpn','project']):
  if len(f['resources'])<=idx:f['resources'].append({'scope':scope});checkpoint()
  row=f['resources'][idx]
  owner={'projectid':f['project']['id']} if scope=='project' else {'account':f['account']['name'],'domainid':domain}
  if 'vpc' not in row:
   params={'name':prefix+'-'+scope,'displaytext':'Disposable 1722 VPN candidate fixture','cidr':f'10.{231+idx}.{cluster}.0/24','zoneid':zone,'vpcofferingid':f['offering']['id'] if scope=='novpn' else standard,**owner}
   row['vpc']=tracked('vpc-'+scope,'createVPC',params,'vpc');checkpoint()
  ips=items(mold.call('listPublicIpAddresses',{'vpcid':row['vpc']['id'],'listall':'true',**owner}))
  source=[ip for ip in ips if ip.get('issourcenat') is True]
  assert len(source)==1,redact(ips);row['sourceIp']=source[0];checkpoint()
  if scope=='hidden' and 'gateway' not in row:
   row['gateway']=tracked('hidden-gateway','createVpnGateway',{'vpcid':row['vpc']['id'],'ipaddressid':source[0]['id'],'fordisplay':'false','customjobid':str(uuid.uuid4())},'vpngateway');checkpoint()
   assert len(items(mold.call('listVpnGateways',{'id':row['gateway']['id'],'fordisplay':'false','listall':'true'})))==1
  print(cluster,scope,'fixture',row['vpc']['id'],'IP',source[0]['ipaddress'],flush=True)
 old=json.loads(Path('docs/validation/s2s-1721-20261119/'+str(cluster)+'-fixtures.json').read_text())['vmReference']
 actual=items(mold.call('listVirtualMachines',{'id':old['id'],'listall':'true'}));assert len(actual)==1
 f['vmReference']={key:actual[0][key] for key in old if key in actual[0]};checkpoint()
 print(cluster,'all fixtures ready',flush=True)

if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(create,[31,32]))
