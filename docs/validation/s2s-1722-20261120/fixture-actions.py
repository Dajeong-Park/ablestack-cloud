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

def action(cluster,phase):
 mold=Mold(cluster);f=json.loads((OUT/f'{cluster}-fixtures.json').read_text())
 scope='source' if phase.startswith('race') else 'hidden'
 row=next(r for r in f['resources'] if r['scope']==scope)
 assert row['vpc']['name']==f['prefix']+'-'+scope
 log=f.setdefault('actions',{})
 if phase not in log:
  if phase.startswith('race-create'):
   params={'vpcid':row['vpc']['id'],'ipaddressid':row['sourceIp']['id'],'customjobid':str(uuid.uuid4())};command='createVpnGateway'
  else:
   gateway=log['race-create'+phase[len('race-delete'):]]['final']['queryasyncjobresultresponse']['jobresult']['vpngateway'] if phase.startswith('race-delete') else row['gateway']
   assert gateway['vpcid']==row['vpc']['id']
   shown=items(mold.call('listVpnGateways',{'id':gateway['id'],'fordisplay':str(phase!='hidden-delete').lower(),'listall':'true'}))
   assert len(shown)==1 and shown[0]['vpcid']==row['vpc']['id']
   params={'id':gateway['id'],'customjobid':str(uuid.uuid4())};command='deleteVpnGateway'
  log[phase]={'command':command,'params':params,'accepted':mold.call(command,params)};save(f'{cluster}-fixtures.json',f)
 if 'final' not in log[phase]:
  data=mold.wait(log[phase]['accepted']);body=next(iter(data.values()));assert body.get('jobstatus')==1,redact(data)
  log[phase]['final']=data;save(f'{cluster}-fixtures.json',f)
 save(f'{cluster}-{phase}.json',log[phase]);print(cluster,phase,'PASS',flush=True)

if __name__=='__main__':
 phase=sys.argv[1]
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(lambda c:action(c,phase),[31,32]))
