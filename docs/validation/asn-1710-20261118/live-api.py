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

import json,sys
from api import Mold,redact,OUT

def body(data):return next(iter(data.values()))
def rows(data,key):
 value=body(data)
 if value.get('errorcode'):raise AssertionError(redact(data))
 return value.get(key,[])

def run(cluster,keep=False):
 m=Mold(cluster);zone=rows(m.call('listZones'),'zone')[0]['id'];created=[];checks=[];fixtures=[]
 def record(name,ok,data=None):
  checks.append({'name':name,'pass':bool(ok),'response':redact(data)})
  (OUT/f'{cluster}-api-validation.json').write_text(json.dumps({'cluster':cluster,'checks':checks},ensure_ascii=False,indent=2))
  assert ok,(name,redact(data))
 def lookup(**p):return m.call('listASNumbers',{'zoneid':zone,**p})
 try:
  assert not rows(m.call('listASNRanges',{'zoneid':zone}),'asnumberrange'),'Use an empty dedicated test Zone'
  meta=m.call('listApis',{'name':'listASNumbers'});entry=rows(meta,'api')[0]
  record('asnumber-long-metadata',[p['type'] for p in entry['params'] if p['name']=='asnumber']==['long'],meta)
  for start in [64512,4200000000]:
   response=m.call('createASNRange',{'zoneid':zone,'startasn':str(start),'endasn':str(start+2)})
   row=body(response).get('asnumberrange',{});assert row.get('id'),redact(response);created.append(row['id']);fixtures.append(row)
   data=lookup(asnrangeid=row['id']);members=rows(data,'asnumber')
   record('small-fixture-'+str(start),len(members)==3 and {int(n['asnumber']) for n in members}==set(range(start,start+3)),data)
   for number in range(start,start+3):
    exact=lookup(asnumber=str(number));found=rows(exact,'asnumber');keyword=lookup(keyword=str(number));matched=rows(keyword,'asnumber')
    record('exact-keyword-id-'+str(number),len(found)==len(matched)==1 and found[0]['id']==matched[0]['id'] and int(found[0]['asnumber'])==number and body(exact)['count']==1,{'exact':exact,'keyword':keyword})
  for value in ['0','23456','65535','2147483647','2147483648','4294967294','4294967295','4200000010']:
   data=lookup(asnumber=value);record('valid-empty-'+value,not rows(data,'asnumber') and body(data).get('count',0)==0,data)
  for value in ['',' ','-1','-0','+1','1.5','1e3','1.10','1,000','abc','\uff11\uff12','4294967296','9223372036854775808',' 4200000000 ','1\n']:
   data=lookup(asnumber=value);record('invalid-'+repr(value),body(data).get('errorcode')==431,data)
  high=fixtures[1]['id'];low=fixtures[0]['id']
  for name,params,count in [('exact-and-range',{'asnrangeid':high},1),('wrong-range',{'asnrangeid':low},0),('free',{'isallocated':'false'},1),('allocated',{'isallocated':'true'},0),('keyword-and-match',{'keyword':'420000000'},1),('keyword-and-mismatch',{'keyword':'64512'},0)]:
   data=lookup(asnumber='4200000000',**params);record(name,len(rows(data,'asnumber'))==count and body(data).get('count',0)==count,data)
  inventory=json.loads((OUT/f'{cluster}-inventory-before.json').read_text(encoding='utf-8'))
  network=next(n for n in rows(inventory['listNetworks'],'network') if not n.get('vpcid'))
  vpc=rows(inventory['listVPCs'],'vpc')[0]
  account=rows(m.call('listAccounts',{'name':'admin','listall':'true'}),'account')[0]
  for name,params in [('network-and',{'networkid':network['id']}),('vpc-and',{'vpcid':vpc['id']}),('owner-and',{'account':'admin','domainid':account['domainid']})]:
   data=lookup(asnumber='4200000000',**params);record(name,not rows(data,'asnumber') and body(data).get('count',0)==0,data)
  data=lookup(asnumber='004200000000');record('leading-zero-decimal',len(rows(data,'asnumber'))==1 and int(rows(data,'asnumber')[0]['asnumber'])==4200000000,data)
  first=lookup(asnumber='4200000000',page=1,pagesize=1);second=lookup(asnumber='4200000000',page=2,pagesize=1)
  record('exact-page-total',len(rows(first,'asnumber'))==1 and not rows(second,'asnumber') and body(first)['count']==body(second)['count']==1,{'first':first,'second':second})
  first=lookup(page=1,pagesize=2);second=lookup(page=2,pagesize=2)
  record('list-page-total',len(rows(first,'asnumber'))==len(rows(second,'asnumber'))==2 and body(first)['count']==body(second)['count']==6 and not ({n['id'] for n in rows(first,'asnumber')}&{n['id'] for n in rows(second,'asnumber')}),{'first':first,'second':second})
  record('invalid-does-not-change-fixture',len(rows(lookup(),'asnumber'))==6 and len(rows(m.call('listASNRanges',{'zoneid':zone}),'asnumberrange'))==2)
  observed={'cluster':cluster,'zoneid':zone,'ranges':fixtures,'numbers':rows(lookup(),'asnumber'),'keywordHigh':rows(lookup(keyword='4200000000'),'asnumber'),'keywordLow':rows(lookup(keyword='64512'),'asnumber')}
  if keep:(OUT/f'{cluster}-ui-fixtures.json').write_text(json.dumps(observed,ensure_ascii=False,indent=2))
 finally:
  if not keep or sys.exc_info()[0]:
   for id in created:
    response=m.call('deleteASNRange',{'id':id});assert body(response).get('success'),redact(response)
 (OUT/f'{cluster}-api-validation.json').write_text(json.dumps({'cluster':cluster,'checks':checks,'all_passed':all(t['pass'] for t in checks),'retained_for_ui':keep},ensure_ascii=False,indent=2))
 print(cluster,len(checks),'checks PASS; UI fixtures retained='+str(keep),flush=True)

def cleanup(cluster):
 m=Mold(cluster);data=json.loads((OUT/f'{cluster}-ui-fixtures.json').read_text(encoding='utf-8'))
 for row in data['ranges']:
  response=m.call('deleteASNRange',{'id':row['id']});assert body(response).get('success'),redact(response)
 assert not rows(m.call('listASNRanges',{'zoneid':data['zoneid']}),'asnumberrange')
 assert not rows(m.call('listASNumbers',{'zoneid':data['zoneid']}),'asnumber')
 (OUT/f'{cluster}-cleanup.json').write_text(json.dumps({'cluster':cluster,'deletedRangeIds':[r['id'] for r in data['ranges']],'ranges':0,'numbers':0},indent=2));print(cluster,'cleanup PASS')

if __name__=='__main__':
 for c in [31,32]:
  if sys.argv[1]=='cleanup':cleanup(c)
  else:run(c,keep=True)
