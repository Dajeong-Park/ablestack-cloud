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

import concurrent.futures,json,threading,sys
from api import Mold,redact,OUT

def body(data):return next(iter(data.values()))
def ranges(m,zone):return body(m.call('listASNRanges',{'zoneid':zone})).get('asnumberrange',[])
def numbers(m,zone):return body(m.call('listASNumbers',{'zoneid':zone,'page':1,'pagesize':500})).get('asnumber',[])
def run(cluster):
 m=Mold(cluster);zone=body(m.call('listZones'))['zone'][0]['id'];before=ranges(m,zone);assert not before
 report={'cluster':cluster,'tests':[]};owned=set()
 def check(name,ok,data=None):
  report['tests'].append({'name':name,'pass':bool(ok),'response':redact(data) if data is not None else None})
  (OUT/f'{cluster}-api-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  assert ok,(name,redact(data))
 def create(a,b):return m.call('createASNRange',{'zoneid':zone,'startasn':a,'endasn':b})
 def remove(id):
  result=m.call('deleteASNRange',{'id':id});check('cleanup-'+id,body(result).get('success') is True,result);owned.discard(id)
 try:
  invalid=[('', ''),(' ', ' '),('-1','-1'),('+1','+1'),('1.5','1.5'),('1e3','1e3'),('1.10','1.10'),('1,000','1,000'),('12x','12x'),('\uff11\uff12','\uff11\uff12'),('0','0'),('4294967295','4294967295'),('4294967296','4294967296'),('9223372036854775808','9223372036854775808'),('20','10'),('23456','23456'),('23455','23457'),('65535','65535'),('65534','65536'),('4200010000','4200011000')]
  for a,b in invalid:
   data=create(a,b);check(f'invalid:{a}/{b}',body(data).get('errorcode')==431 and not ranges(m,zone) and not numbers(m,zone),data)
  contract=m.call('listApis',{'name':'createASNRange'});check('api-string-contract',all(p['type']=='string' for p in body(contract)['api'][0]['params'] if p['name'] in ['startasn','endasn']),contract)
  for a,b in [('1','1'),('64512','64535'),('2147483648','2147483648'),('4200000000','4200000002'),('4294967294','4294967294'),(' 4200000010 ',' 4200000010 ')]:
   result=create(a,b);row=body(result).get('asnumberrange',body(result));id=row.get('id')
   if id:owned.add(id)
   check(f'valid:{a}/{b}',id and int(row['startasn'])==int(a) and int(row['endasn'])==int(b),result)
   observed=[n for n in numbers(m,zone) if n.get('asnrangeid')==id]
   check('members-exact',len(observed)==int(b)-int(a)+1 and sorted(int(n['asnumber']) for n in observed)==list(range(int(a),int(b)+1)),observed)
   for c,d in [(a,b),(str(int(a)-1 if int(a)>1 else 1),b)]:
    reject=create(c,d);check('overlap-rejected',body(reject).get('errorcode')==431 and len(ranges(m,zone))==1 and len(numbers(m,zone))==len(observed),reject)
   remove(id)
  clients=[Mold(cluster),Mold(cluster)];gate=threading.Barrier(2)
  def concurrent_create(i):
   gate.wait();return clients[i].call('createASNRange',{'zoneid':zone,'startasn':'4200000100','endasn':'4200000102'})
  with concurrent.futures.ThreadPoolExecutor(2) as ex:results=list(ex.map(concurrent_create,[0,1]))
  saved=ranges(m,zone)
  for r in saved:owned.add(r['id'])
  check('mysql-concurrent-overlap',len(saved)==1 and len(numbers(m,zone))==3 and sum(body(r).get('errorcode')==431 for r in results)==1,results)
  for r in saved:remove(r['id'])
  check('empty-restored',not ranges(m,zone) and not numbers(m,zone))
 finally:
  # Delete only IDs returned by this test; preserve unrelated resources.
  for id in list(owned):remove(id)
 report['all_passed']=all(t['pass'] for t in report['tests']);(OUT/f'{cluster}-api-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(cluster,len(report['tests']),'PASS',flush=True)
if __name__=='__main__':
 for c in [31,32]:run(c)
