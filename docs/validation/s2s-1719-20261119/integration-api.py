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
for cluster in [31,32]:
    mold=Mold(cluster);projects=json.loads((OUT/f'{cluster}-projects-before.json').read_text())
    pid,g=next((pid,g) for pid,d in projects.items() for g in items(d['listVpnGateways']))
    cases=[({'projectid':pid},[g['id']]),({'projectid':pid,'keyword':g['publicip']},[g['id']]),({'projectid':pid,'keyword':g['id'].upper()},[g['id']]),({'projectid':pid,'keyword':'s2s1719-no-match'},[]),({'projectid':pid,'id':g['id'],'keyword':'s2s1719-no-match'},[]),({'keyword':g['publicip']},[]),({'keyword':f'qa-s2s1719-{cluster}'},[])]
    results=[]
    for params,expected in cases:
        result=mold.call('listVpnGateways',{'listall':'true','page':1,'pagesize':20,**params});b=result.get('listvpngatewaysresponse',{})
        assert not b.get('errorcode') and sorted(x['id'] for x in b.get('vpngateway',[]))==sorted(expected) and b.get('count',0)==len(expected),redact(result)
        results.append({'params':params,'response':result,'passed':True})
    save(f'{cluster}-integration-api.json',results)
    print(cluster,len(results),'read-only integration cases passed; existing project gateway unchanged',flush=True)
