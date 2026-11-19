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

fixtures=json.loads((OUT/'fixtures.json').read_text())
for cluster in [31,32]:
    mold=Mold(cluster); target=fixtures[str(cluster)][0]['gateway']
    username=f'qa-s2s1719-{cluster}-reader'
    assert not items(mold.call('listAccounts',{'name':username,'domainid':target['domainid'],'listall':'true'})), 'dedicated account exists; inspect first'
    result=mold.call('createAccount',{'username':username,'account':username,'password':os.environ['MOLD_PASSWORD'],'firstname':'QA1719','lastname':'Reader','email':'qa1719@example.invalid','accounttype':0,'domainid':target['domainid']})
    account=result.get('createaccountresponse',{}).get('account');assert account,redact(result)
    save(f'{cluster}-acl-probe-account.json',{'id':account['id'],'name':username,'domainid':target['domainid']})
    reader=Mold(cluster)
    login=reader.request({'command':'login','username':username,'password':os.environ['MOLD_PASSWORD'],'domain':'/','response':'json'}).get('loginresponse',{})
    assert login.get('sessionkey'), 'dedicated reader login failed'
    reader.key=login['sessionkey'];checks=[]
    for params in [{'keyword':target['publicip']},{'keyword':target['id']},{'keyword':'한글'},{'keyword':'%'}]:
        result=reader.call('listVpnGateways',{'listall':'true',**params});body=result.get('listvpngatewaysresponse',{})
        assert not body.get('errorcode') and body.get('count',0)==0 and not items(result),redact(result)
        checks.append({'params':params,'response':result,'passed':True})
    save(f'{cluster}-acl-probe.json',{'account':username,'checks':checks})
    reader.call('logout')
    result=mold.wait(mold.call('deleteAccount',{'id':account['id']}))
    save(f'{cluster}-acl-probe-delete.json',result)
    assert next(iter(result.values())).get('jobstatus',1)==1,redact(result)
    assert not items(mold.call('listAccounts',{'id':account['id'],'listall':'true'}))
    print(cluster,'regular reader cannot discover another owner through any new keyword branch; dedicated account removed',flush=True)
