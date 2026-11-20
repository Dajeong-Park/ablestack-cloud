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
import json,sys,os,urllib.request,http.cookiejar,concurrent.futures
out=Path('docs/validation/s2s-1723-20261120').resolve();sys.path.insert(0,str(out))
from api_client import Mold,items,save

def role_client(cluster,role,domain):
 m=Mold.__new__(Mold);m.cluster=cluster;m.base=f'http://10.10.{cluster}.10:8080/client/api';m.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 r=m.request({'command':'login','username':f'qa-s2s1723-{cluster}-{role}','password':os.environ['MOLD_PASSWORD'],'domain':domain,'response':'json'})['loginresponse'];m.key=r['sessionkey'];return m

def run(cluster):
 f=json.loads((out/f'{cluster}-fixtures.json').read_text());root=Mold(cluster);report={'cluster':cluster,'roles':[]}
 for role in ['user','domainadmin']:
  m=role_client(cluster,role,'/'+f['domain']['name']);vpc=next(x['vpc'] for x in f['resources'] if x['scope']==role)
  rows=items(root.call('listVpnGateways',{'vpcid':vpc['id'],'listall':'true','fordisplay':'true'}));assert len(rows)==1;g=rows[0]
  apis={x['name']:x for x in items(m.call('listApis'))};supported={c:[x['name'] for x in apis.get(c,{}).get('params',[])] for c in ['createVpnGateway','updateVpnGateway','listVpnGateways']}
  receipt=json.loads((out/f'{cluster}-{role}-direct-api-receipt.json').read_text()) if (out/f'{cluster}-{role}-direct-api-receipt.json').exists() else m.call('updateVpnGateway',{'id':g['id'],'fordisplay':'false'});save(f'{cluster}-{role}-direct-api-receipt.json',receipt)
  result=m.wait(receipt);save(f'{cluster}-{role}-direct-api-result.json',result)
  rb=next(iter(result.values()));rejected=bool(rb.get('errorcode')) or rb.get('jobstatus')==2
  final=items(root.call('listVpnGateways',{'id':g['id'],'fordisplay':'true','listall':'true'}));unchanged=len(final)==1 and final[0]['fordisplay'] is True
  report['roles'].append({'role':role,'gateway':g,'apiParams':supported,'forDisplayDirectRejected':rejected,'forDisplayIgnored':not rejected and unchanged,'result':result,'unchanged':unchanged});save(f'{cluster}-role-api-verification.json',report)
  assert unchanged and 'fordisplay' not in supported['updateVpnGateway'],role
 print(cluster,'role API policies preserved',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(run,[31,32]))
