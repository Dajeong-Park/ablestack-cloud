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

def check(cluster):
 mold=Mold(cluster);fixture=json.loads((OUT/f'{cluster}-fixtures.json').read_text());report=[]
 for scope,filename in [('source','root-create-network'),('project','project-create-network'),('hidden','user-create-network')]:
  row=next(r for r in fixture['resources'] if r['scope']==scope)
  trace=json.loads((OUT/f'{cluster}-{filename}.json').read_text())['requests']
  posts=[r for r in trace if r['method']=='POST' and r['command']=='createVpnGateway'];assert len(posts)==1
  params=posts[0]['params'];assert params['vpcid']==row['vpc']['id'] and params['ipaddressid']==row['sourceIp']['id'] and 'fordisplay' not in params
  job=mold.call('queryAsyncJobResult',{'jobid':params['customjobid']})['queryasyncjobresultresponse'];assert job['jobstatus']==1
  gateway=job['jobresult']['vpngateway'];assert gateway['vpcid']==row['vpc']['id'] and gateway['publicip']==row['sourceIp']['ipaddress']
  if scope=='project':assert gateway['projectid']==fixture['project']['id']
  else:assert gateway['account']==fixture['account']['name'] and gateway['domainid']==fixture['account']['domainid'] and not gateway.get('projectid')
  owner={'projectid':fixture['project']['id']} if scope=='project' else {'account':fixture['account']['name'],'domainid':fixture['account']['domainid']}
  current=items(mold.call('listVpnGateways',{'id':gateway['id'],'fordisplay':'true','listall':'true',**owner}));assert len(current)==1 and current[0]['publicip']==gateway['publicip']
  row['uiGateway']=gateway;save(f'{cluster}-fixtures.json',fixture)
  report.append({'scope':scope,'request':params,'final':job,'requery':current})
 userTrace=json.loads((OUT/f'{cluster}-user-create-network.json').read_text())['requests']
 assert all('fordisplay' not in r['params'] for r in userTrace)
 user=Mold(cluster);login=user.request({'command':'login','username':fixture['prefix']+'-user','password':os.environ['MOLD_PASSWORD'],'response':'json'})['loginresponse'];user.key=login['sessionkey']
 userRows=items(user.call('listVpnGateways',{'listall':'true','ignoreproject':'true'}));assert len(userRows)==2 and all(r['account']==fixture['account']['name'] and not r.get('projectid') for r in userRows)
 for name in ['concurrent-preflight-network','final-concurrent-preflight-network']:
  data=json.loads((OUT/f'{cluster}-{name}.json').read_text())['requests'];assert not any(r['method']=='POST' and r['command']=='createVpnGateway' for r in data)
 save(f'{cluster}-api-results.json',{'status':'PASS','created':report,'userScope':userRows,'userNoRootArguments':True,'raceUiCreatePosts':0});print(cluster,'Root/User/project exact IP-ID request / job / persisted gateway checks PASS',flush=True)

if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(check,[31,32]))
