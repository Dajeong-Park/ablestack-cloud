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

import json,os,time,sys,urllib.parse,urllib.request
from api import Mold,OUT,redact

def body(data):return next(iter(data.values()))
def ok(data):
 value=body(data)
 assert not value.get('errorcode'),redact(data)
 return value

def run(cluster):
 m=Mold(cluster);inv=json.loads((OUT/f'{cluster}-inventory-before.json').read_text());zone=inv['zones'][0]['id'];checks=[];created=[]
 def check(name,condition,data=None):
  checks.append({'name':name,'pass':bool(condition),'response':redact(data)});(OUT/f'{cluster}-api-validation.json').write_text(json.dumps({'checks':checks},ensure_ascii=False,indent=2));assert condition,(name,redact(data))
 def query(cmd,**params):return m.call(cmd,params)
 before=query('listASNRanges',zoneid=zone);check('empty-range-count-explicit',body(before).get('count')==0,before)
 for start in [64520,4200000100]:
  data=query('createASNRange',zoneid=zone,startasn=start,endasn=start+2);r=ok(data)['asnumberrange'];created.append(r)
  total=query('listASNumbers',zoneid=zone,asnrangeid=r['id'],page=1,pagesize=1)
  allocated=query('listASNumbers',zoneid=zone,asnrangeid=r['id'],isallocated='true',page=1,pagesize=1)
  check('target-and-total-'+str(start),body(total).get('count')==3 and body(total)['asnumber'][0]['asnrangeid']==r['id'] and body(total)['asnumber'][0]['zoneid']==zone,total)
  check('allocated-zero-explicit-'+str(start),body(allocated).get('count')==0 and not body(allocated).get('asnumber'),allocated)
  # Only disposable ranges created by this script are passed to the delete API.
  result=query('deleteASNRange',id=r['id']);check('free-delete-'+str(start),body(result).get('success') is True,result)
  ranged=query('listASNRanges',zoneid=zone);members=query('listASNumbers',zoneid=zone)
  check('whole-removal-'+str(start),body(ranged).get('count')==0 and body(members).get('count')==0,{'ranges':ranged,'members':members})
  again=query('deleteASNRange',id=r['id']);check('duplicate-delete-reject-'+str(start),body(again).get('errorcode')==431,again)
 xmlargs={'command':'listASNumbers','zoneid':zone,'isallocated':'true','response':'xml','sessionkey':m.key}
 with m.s.open(urllib.request.Request(m.base,data=urllib.parse.urlencode(xmlargs).encode()),timeout=60) as response:xml=response.read().decode()
 check('xml-explicit-zero','<count>0</count>' in xml,{'xml':xml})
 name=f'asn1711-ro-{cluster}';assert not ok(query('listAccounts',name=name,listall='true')).get('account')
 role=ok(query('createRole',name=name,type='Admin',ispublic='false',description='Disposable ASN deletion read-only UI validation'))['role']
 fixture={'cluster':cluster,'zoneid':zone,'roleid':role['id'],'username':name,'ranges':[]}
 (OUT/f'{cluster}-ui-fixtures.json').write_text(json.dumps(fixture,indent=2))
 for rule in ['list*','get*','query*','*']:
  ok(query('createRolePermission',roleid=role['id'],rule=rule,permission='deny' if rule=='*' else 'allow'))
 admin=ok(query('listAccounts',name='admin',listall='true'))['account'][0]
 account=ok(query('createAccount',account=name,username=name,password=os.environ['MOLD_PASSWORD'],firstname='ASN',lastname='Validation',email='asn1711@example.invalid',roleid=role['id'],domainid=admin['domainid']))['account']
 fixture['accountid']=account['id'];(OUT/f'{cluster}-ui-fixtures.json').write_text(json.dumps(fixture,indent=2))
 r=ok(query('createASNRange',zoneid=zone,startasn=64530,endasn=64532))['asnumberrange'];fixture['ranges'].append(r)
 (OUT/f'{cluster}-ui-fixtures.json').write_text(json.dumps(fixture,indent=2))
 readonly=Mold.__new__(Mold);readonly.__dict__.update(m.__dict__);import http.cookiejar
 readonly.s=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 readonly.key=readonly.request({'command':'login','username':name,'password':os.environ['MOLD_PASSWORD'],'response':'json'})['loginresponse']['sessionkey']
 apis=ok(readonly.call('listApis')).get('api',[])
 check('readonly-api-permission-hidden',not any(a['name'] in ['deleteASNRange','createASNRange'] for a in apis) and any(a['name']=='listASNRanges' for a in apis))
 denied=readonly.call('deleteASNRange',{'id':r['id']});check('readonly-direct-delete-denied',body(denied).get('errorcode') in [401,403,432,435,436],denied)
 check('denied-delete-preserves-whole-target',body(query('listASNumbers',zoneid=zone,asnrangeid=r['id'])).get('count')==3)
 (OUT/f'{cluster}-api-validation.json').write_text(json.dumps({'cluster':cluster,'checks':checks,'all_passed':True,'retained_for_ui':True},ensure_ascii=False,indent=2))
 print(cluster,len(checks),'checks PASS; disposable UI range / read-only account retained',flush=True)

def cleanup(cluster):
 m=Mold(cluster);fixture=json.loads((OUT/f'{cluster}-ui-fixtures.json').read_text());zone=fixture['zoneid']
 for row in ok(m.call('listASNRanges',{'zoneid':zone})).get('asnumberrange',[]):
  if row['id'] in [r['id'] for r in fixture['ranges']]:ok(m.call('deleteASNRange',{'id':row['id']}))
 if fixture.get('accountid'):
  removed=ok(m.wait(m.call('deleteAccount',{'id':fixture['accountid']})));assert removed.get('jobstatus',1)==1
 ok(m.call('deleteRole',{'id':fixture['roleid']}))
 counts={cmd:ok(m.call(cmd,{'zoneid':zone})).get('count') for cmd in ['listASNRanges','listASNumbers']};assert set(counts.values())=={0}
 assert not ok(m.call('listAccounts',{'name':fixture['username'],'listall':'true'})).get('account')
 rolelist=ok(m.call('listRoles',{'page':1,'pagesize':500}));assert len(rolelist.get('role',[]))==rolelist.get('count',0)
 assert not any(row['id']==fixture['roleid'] for row in rolelist.get('role',[]))
 (OUT/f'{cluster}-cleanup.json').write_text(json.dumps({'cluster':cluster,'counts':counts,'testAccountAbsent':True,'testRoleAbsent':True},indent=2));print(cluster,'cleanup PASS',flush=True)

def extra_fixture(cluster):
 m=Mold(cluster);fixture=json.loads((OUT/f'{cluster}-ui-fixtures.json').read_text());zone=fixture['zoneid']
 assert ok(m.call('listASNRanges',{'zoneid':zone})).get('count')==0
 row=ok(m.call('createASNRange',{'zoneid':zone,'startasn':64540,'endasn':64542}))['asnumberrange']
 fixture['ranges'].append(row);(OUT/f'{cluster}-ui-fixtures.json').write_text(json.dumps(fixture,indent=2));print(cluster,'final keyboard fixture',row['id'])

if __name__=='__main__':
 for cluster in ([int(sys.argv[2])] if len(sys.argv)>2 else [31,32]):
  if sys.argv[1]=='cleanup':cleanup(cluster)
  elif sys.argv[1]=='fixture':extra_fixture(cluster)
  else:run(cluster)
