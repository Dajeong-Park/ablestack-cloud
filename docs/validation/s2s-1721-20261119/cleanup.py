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

def cleanup(cluster):
 mold=Mold(cluster);f=json.loads((OUT/f'{cluster}-fixtures.json').read_text());results=[]
 def remove(command,params):
  data=mold.wait(mold.call(command,params));body=next(iter(data.values()))
  assert 'errorcode' not in body and body.get('jobstatus',1)==1,redact(data)
  results.append({'command':command,'params':params,'response':data});save(f'{cluster}-cleanup.json',results)
 for r in f['resources']:
  assert r['vpc']['name'].startswith(f['prefix'])
  if r.get('connection'):remove('deleteVpnConnection',{'id':r['connection']['id']})
  if r.get('customer'):
   assert r['customer']['name'].startswith(f['prefix'])
   remove('deleteVpnCustomerGateway',{'id':r['customer']['id']})
  params={'vpcid':r['vpc']['id'],'listall':'true'}
  if r['scope']=='project':params['projectid']=f['project']['id']
  actual=items(mold.call('listVpnGateways',params))
  if r['scope']=='account':assert not actual, 'Account gateway must first be deleted through the UI'
  else:
   assert len(actual)==1 and actual[0]['id']==r['gateway']['id']
   remove('deleteVpnGateway',{'id':r['gateway']['id']})
  remove('deleteVPC',{'id':r['vpc']['id']})
 assert f['project']['name'].startswith(f['prefix']) and f['account']['name'].startswith(f['prefix'])
 remove('deleteProject',{'id':f['project']['id']});remove('deleteAccount',{'id':f['account']['id']})
 print(cluster,'dedicated fixtures removed',flush=True)

if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(cleanup,[31,32]))
