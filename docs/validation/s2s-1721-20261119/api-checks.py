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
 mold=Mold(cluster);f=json.loads((OUT/f'{cluster}-fixtures.json').read_text());report={'status':'PASS','scope':[]}
 for r in f['resources']:
  params={'id':r['gateway']['id'],'listall':'true'}
  if r['scope']=='project':params['projectid']=f['project']['id']
  gateways=items(mold.call('listVpnGateways',params));assert len(gateways)==(0 if r['scope']=='account' else 1)
  g=gateways[0] if gateways else r['gateway'];assert all(g.get(k)==r['gateway'].get(k) for k in ['id','vpcid','publicip','account','domainid','projectid'])
  params={'vpcid':r['vpc']['id'],'listall':'true','ignoreproject':'true'}
  if r['scope']=='project':params['projectid']=f['project']['id']
  connections=items(mold.call('listVpnConnections',params))
  assert len(connections)==(1 if r['scope']=='project' else 0)
  assert all(c['s2svpngatewayid']==g['id'] and c.get('projectid')==g.get('projectid') for c in connections)
  report['scope'].append({'scope':r['scope'],'gateway':g,'connections':connections,'liveGatewayCount':len(gateways),'phase':'after UI deletion' if r['scope']=='account' else 'live project fixture'})
 # Independent user API session must expose only the user's own gateway.
 user=Mold(cluster)
 login=user.request({'command':'login','username':f['prefix']+'-user','password':os.environ['MOLD_PASSWORD'],'response':'json'})['loginresponse'];user.key=login['sessionkey']
 own=items(user.call('listVpnGateways',{'listall':'true','ignoreproject':'true'}));expected=next(r['gateway']['id'] for r in f['resources'] if r['scope']=='account')
 assert not own, 'User gateway was deleted through the UI'
 report['regularUserOwnScope']=own
 jobs=[]
 raw=json.loads((OUT/f'{cluster}-create-network.json').read_text())
 for row in (raw if isinstance(raw,list) else raw['requests']):
  if row['command']=='createVpnGateway':
   jobid=row['params'].get('customjobid');assert jobid
   job=mold.call('queryAsyncJobResult',{'jobid':jobid})['queryasyncjobresultresponse'];assert job['jobstatus']==1
   assert job['jobresult']['vpngateway']['id']==expected
   jobs.append(job)
 assert len(jobs)==1
 report['createdUiJobFinal']=jobs
 deleted=[]
 for row in json.loads((OUT/f'{cluster}-delete-network.json').read_text())['requests']:
  if row['command']=='deleteVpnGateway':
   assert row['params']['id']==expected
   job=mold.call('queryAsyncJobResult',{'jobid':row['params']['customjobid']})['queryasyncjobresultresponse']
   assert job['jobstatus']==1 and job['jobresult']['success'] is True
   deleted.append(job)
 assert len(deleted)==1
 report['deletedUiJobFinal']=deleted
 save(f'{cluster}-api-checks.json',report);print(cluster,'API detail/connection owner/user/create-job checks PASS',flush=True)

if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(check,[31,32]))
