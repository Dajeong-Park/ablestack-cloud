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
import json,sys,subprocess,concurrent.futures,runpy,time
out=Path('docs/validation/s2s-1723-20261120').resolve();sys.path.insert(0,str(out))
from api_client import Mold,items,save

def cleanup(cluster):
 f=json.loads((out/f'{cluster}-fixtures.json').read_text());m=Mold(cluster);report={'cluster':cluster,'operations':[]};assert f['prefix']==f'qa-s2s1723-{cluster}'
 def action(command,params):
  receipt=m.call(command,params);entry={'command':command,'params':params,'receipt':receipt};report['operations'].append(entry);save(f'{cluster}-cleanup.json',report)
  result=m.wait(receipt);entry['result']=result;save(f'{cluster}-cleanup.json',report);body=next(iter(result.values()));assert not body.get('errorcode') and body.get('jobstatus',1)==1
 for row in f['resources']:
  vpc=row['vpc'];assert vpc['name']==f['prefix']+'-'+row['scope'];owner={'projectid':f['project']['id']} if row['scope']=='project' else {'account':vpc['account'],'domainid':vpc['domainid']}
  for value in ['true','false']:
   for g in items(m.call('listVpnGateways',{'vpcid':vpc['id'],'listall':'true','fordisplay':value,**owner})):
    assert g['vpcid']==vpc['id'];action('deleteVpnGateway',{'id':g['id'],**owner})
  action('deleteVPC',{'id':vpc['id'],**owner})
 action('deleteProject',{'id':f['project']['id']})
 for key in ['accountUser','domainadmin']:
  a=f[key];assert a['name'].startswith(f['prefix']+'-');action('deleteAccount',{'id':a['id']})
 action('deleteDomain',{'id':f['domain']['id']})
 report['finished']=True;save(f'{cluster}-cleanup.json',report);print(cluster,'owned fixtures removed',flush=True)
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(cleanup,[31,32]))
