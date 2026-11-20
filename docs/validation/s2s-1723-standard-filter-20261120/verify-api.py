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
import json,sys,urllib.request,http.cookiejar,os,concurrent.futures
out=Path('docs/validation/s2s-1723-standard-filter-20261120').resolve();sys.path.insert(0,str(out));from api_client import Mold,items,save

def client(c,role,domain):
 m=Mold.__new__(Mold);m.cluster=c;m.base=f'http://10.10.{c}.10:8080/client/api';m.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()));r=m.request({'command':'login','username':f'qa-s2s1723-standard-{c}-{role}','password':os.environ['MOLD_PASSWORD'],'domain':domain,'response':'json'})['loginresponse'];m.key=r['sessionkey'];return m

def verify(c):
 f=json.loads((out/f'{c}-fixtures.json').read_text());m=Mold(c);report={'cluster':c,'checks':[]};known={r['scope']:r for r in f['resources']};domain=f['domain']['id']
 def query(command,params,who=m):
  r=who.call(command,params);report['checks'].append({'command':command,'params':params,'response':r});save(f'{c}-all-api-verification.json',report);return r
 def rows(params,who=m):
  r=query('listVpnGateways',{'listall':'true','page':1,'pagesize':500,**params},who);body=next(iter(r.values()));assert not body.get('errorcode');result=items(r);assert int(body.get('count',0))==len(result);return result
 for row in f['resources']:
  owner={'projectid':f['project']['id']} if row['scope']=='project' else {'account':row['vpc']['account'],'domainid':domain}
  got=rows({'vpcid':row['vpc']['id'],'displayall':'true',**owner});assert len(got)==1;row['gateway']=got[0]
 save(f'{c}-fixtures.json',f)
 globalids={known[x]['gateway']['id'] for x in ['global','user','domainadmin']};visible={known[x]['gateway']['id'] for x in ['global','domainadmin']};hidden={known['user']['gateway']['id']}
 assert {r['id'] for r in rows({'displayall':'true'})}==globalids
 assert {r['id'] for r in rows({'fordisplay':'true'})}==visible
 assert {r['id'] for r in rows({'fordisplay':'false'})}==hidden
 assert {r['id'] for r in rows({})}==visible
 pages=[]
 for page in [1,2,3]:
  result=query('listVpnGateways',{'listall':'true','displayall':'true','page':page,'pagesize':1});body=next(iter(result.values()));assert body['count']==3 and len(items(result))==1;pages.append(items(result)[0]['id'])
 assert len(set(pages))==3 and set(pages)==globalids
 for value in ['true','false']:
  r=query('listVpnGateways',{'listall':'true','displayall':'true','fordisplay':value});assert next(iter(r.values())).get('errorcode')
 assert {r['id'] for r in rows({'displayall':'true','account':f['accountUser']['name'],'domainid':domain})}=={known[x]['gateway']['id'] for x in ['global','user']}
 assert {r['id'] for r in rows({'displayall':'true','account':f['domainadmin']['name'],'domainid':domain})}=={known['domainadmin']['gateway']['id']}
 assert {r['id'] for r in rows({'displayall':'true','projectid':f['project']['id']})}=={known['project']['gateway']['id']}
 assert not rows({'fordisplay':'true','projectid':f['project']['id']})
 assert {r['id'] for r in rows({'fordisplay':'false','projectid':f['project']['id']})}=={known['project']['gateway']['id']}
 assert not rows({'displayall':'true','projectid':f['project']['id'],'vpcid':known['global']['vpc']['id']})
 report['roles']=[]
 for role in ['user','domainadmin']:
  u=client(c,role,'/'+f['domain']['name']);contract=next(x for x in items(u.call('listApis')) if x['name']=='listVpnGateways');names=[p['name'] for p in contract['params']];assert 'displayall' not in names and 'fordisplay' not in names
  permitted=rows({},u);got=query('listVpnGateways',{'listall':'true','displayall':'true'},u);body=next(iter(got.values()));guarded=bool(body.get('errorcode')) or {r['id'] for r in items(got)}=={r['id'] for r in permitted};assert guarded and not hidden.intersection(r['id'] for r in permitted)
  conceal=query('listVpnGateways',{'id':known['user']['gateway']['id'],'displayall':'true','listall':'true'},u);assert next(iter(conceal.values())).get('errorcode') or not items(conceal)
  report['roles'].append({'role':role,'adminArgsAbsent':True,'forgedAllGuarded':guarded,'hiddenTargetConcealed':True})
 report['passed']=True;report['pagedAllCount']=3;save(f'{c}-all-api-verification.json',report);print(c,'All/visible/hidden counts 3/2/1, server pagination, owner/project ACL and restricted roles PASS',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(verify,[31,32]))
