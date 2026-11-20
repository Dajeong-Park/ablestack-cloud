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

def success(data, object_name):
    body = next(iter(data.values()))
    assert 'errorcode' not in body and body.get('jobstatus', 1) == 1, redact(data)
    result = body.get('jobresult', body)
    assert object_name in result, redact(data)
    return result[object_name]

def create(cluster):
    journal = OUT/f'{cluster}-fixtures.json'
    f = json.loads(journal.read_text()) if journal.exists() else {'cluster':cluster,'prefix':f'qa-s2s1720-{cluster}','resources':[]}
    def checkpoint(): save(journal.name, f)
    mold = Mold(cluster)
    before = json.loads((OUT/f'{cluster}-inventory-before.json').read_text())
    prefix = f['prefix']
    assert not any(p['name'].startswith(prefix) for p in items(before['listProjects']))
    assert not any(a['name'].startswith(prefix) for a in items(before['listAccounts']))
    zone = items(before['listZones'])[0]['id']
    offering = next(x['id'] for x in items(before['listVPCOfferings']) if x['name']=='Default VPC offering')
    domain = next(a['domainid'] for a in items(before['listAccounts']) if a['name']=='admin')
    if 'account' not in f:
        data = mold.call('createAccount', {'username':prefix+'-user','account':prefix+'-user','password':os.environ['MOLD_PASSWORD'],'firstname':'S2S1720','lastname':'QA','email':prefix+'@example.invalid','accounttype':0,'domainid':domain})
        f['account'] = success(data,'account'); checkpoint()
    if 'project' not in f:
        data = mold.wait(mold.call('createProject', {'name':prefix+'-project','displaytext':'Disposable 1720 API response validation'}))
        f['project'] = success(data,'project'); checkpoint()
    for idx, scope in enumerate(['account','project']):
        if len(f['resources'])<=idx: f['resources'].append({'scope':scope}); checkpoint()
        resource = f['resources'][idx]
        routing = items(mold.call('listHosts',{'type':'Routing','listall':'true'}))
        assert len(routing)==3 and all(h['state']=='Up' and h['resourcestate']=='Enabled' for h in routing), 'Hosts must be healthy'
        params = {'name':prefix+'-'+scope,'displaytext':'Disposable 1720 response validation','cidr':f'10.{223+idx}.{cluster}.0/24','zoneid':zone,'vpcofferingid':offering}
        params.update({'account':f['account']['name'],'domainid':domain} if scope=='account' else {'projectid':f['project']['id']})
        if 'vpc' not in resource:
            data = mold.wait(mold.call('createVPC', params)); save(f'{cluster}-{scope}-create-vpc.json',data)
            resource['vpc'] = success(data,'vpc'); checkpoint()
        if 'gateway' not in resource:
            data = mold.wait(mold.call('createVpnGateway',{'vpcid':resource['vpc']['id']})); save(f'{cluster}-{scope}-create-gateway.json',data)
            resource['gateway'] = success(data,'vpngateway'); checkpoint()
        print(cluster,scope,resource['vpc']['id'],resource['gateway']['id'],resource['gateway'].get('account'),resource['gateway'].get('projectid'),flush=True)
    result = mold.wait(mold.call('updateVpnGateway',{'id':f['resources'][0]['gateway']['id']}))
    save(f'{cluster}-baseline-live-update.json',result)
    body = result.get('queryasyncjobresultresponse',{})
    assert body.get('jobstatus') == 1 and 'vpngateway' not in body.get('jobresult',{}), 'Reproduce original empty success before deployment'
    print(cluster,'baseline live empty-success reproduced',flush=True)

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(create,[31,32]))
