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
 mold=Mold(cluster);fixture=json.loads((OUT/f'{cluster}-fixtures.json').read_text());report={}
 for command in ['createVpnGateway','listVpnGateways','listVPCs','listVPCOfferings','listPublicIpAddresses']:
  report[command]=mold.call('listApis',{'name':command})
  assert len(items(report[command]))==1,redact(report[command])
 params={p['name']:p for p in items(report['createVpnGateway'])[0]['params']}
 assert 'VPC' in params['vpcid']['description'] and 'Public IP' not in params['vpcid']['description']
 assert 'ipaddressid' in params
 hidden=next(r for r in fixture['resources'] if r['scope']=='hidden')
 rootTrue=mold.call('listVpnGateways',{'vpcid':hidden['vpc']['id'],'fordisplay':'true','listall':'true'})
 rootFalse=mold.call('listVpnGateways',{'vpcid':hidden['vpc']['id'],'fordisplay':'false','listall':'true'})
 assert not items(rootTrue) and len(items(rootFalse))==1 and items(rootFalse)[0]['id']==hidden['gateway']['id']
 report['rootHiddenBranches']={'visible':rootTrue,'hidden':rootFalse}
 user=Mold(cluster);login=user.request({'command':'login','username':fixture['prefix']+'-user','password':os.environ['MOLD_PASSWORD'],'response':'json'})['loginresponse'];user.key=login['sessionkey']
 userVpc=user.call('listVPCs',{'listall':'true'});assert len(items(userVpc))==3
 report['userVpcs']=userVpc
 report['userHiddenOmitted']=user.call('listVpnGateways',{'vpcid':hidden['vpc']['id'],'listall':'true'});assert not items(report['userHiddenOmitted'])
 offering=fixture['offering'];assert not any(s['name']=='Vpn' for s in offering['service'])
 report['noVpnOffering']=offering
 for resource in fixture['resources']:
  owner={'projectid':fixture['project']['id']} if resource['scope']=='project' else {'account':fixture['account']['name'],'domainid':fixture['account']['domainid']}
  ips=items(mold.call('listPublicIpAddresses',{'vpcid':resource['vpc']['id'],'listall':'true',**owner}));sources=[ip for ip in ips if ip.get('issourcenat')]
  assert len(sources)==1 and sources[0]['id']==resource['sourceIp']['id']
 report['status']='PASS';save(f'{cluster}-api-contracts.json',report);print(cluster,'runtime VPC description / hidden branches / restricted owner / IP contracts PASS',flush=True)

if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(check,[31,32]))
