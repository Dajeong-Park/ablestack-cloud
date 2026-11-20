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
import uuid

class User(Mold):
    def __init__(self,cluster,username):
        self.cluster=cluster
        self.base=f'http://10.10.{cluster}.10:8080/client/api'
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        login=self.request({'command':'login','username':username,'password':os.environ['MOLD_PASSWORD'],'domain':'/','response':'json'})['loginresponse']
        self.key=login['sessionkey']
        assert str(login['type'])=='0', 'Use a regular account for permission tests'

def failed(data):
    body=next(iter(data.values()))
    return bool(body.get('errorcode')) or body.get('jobstatus')==2

def validate(cluster):
    f=json.loads((OUT/f'{cluster}-fixtures.json').read_text())
    mold=None
    for _ in range(90):
        try:
            mold=Mold(cluster)
            hosts=items(mold.call('listHosts',{'type':'Routing','listall':'true'}))
            if len(hosts)==3 and all(h['state']=='Up' and h['resourcestate']=='Enabled' for h in hosts): break
        except (OSError,KeyError): pass
        time.sleep(2)
    else: raise RuntimeError('Hosts/API did not recover after deployment')
    previous=OUT/f'{cluster}-api-validation.json'
    tests=json.loads(previous.read_text()) if '--permissions' in sys.argv and previous.exists() else []
    def record(name,**data):
        tests.append({'name':name,**data}); save(f'{cluster}-api-validation.json',tests)
    def lookup(resource,display=None,client=None):
        params={'id':resource.get('current_id',resource['gateway']['id']),'listall':'true'}
        if resource['scope']=='project': params['projectid']=f['project']['id']
        if display is not None: params['fordisplay']=str(display).lower()
        data=(client or mold).call('listVpnGateways',params)
        assert not failed(data),redact(data)
        return items(data)
    def update(resource,label,display=None,custom=None):
        params={'id':resource.get('current_id',resource['gateway']['id'])}
        if display is not None: params['fordisplay']=str(display).lower()
        if custom is not None: params['customid']=custom
        accepted=mold.call('updateVpnGateway',params)
        assert next(iter(accepted.values())).get('jobid'),redact(accepted)
        final=mold.wait(accepted)
        body=final.get('queryasyncjobresultresponse',{})
        assert body.get('jobstatus')==1,redact(final)
        if custom is not None:
            resource['current_id']=custom; save(f'{cluster}-fixtures.json',f)
        gateway=body.get('jobresult',{}).get('vpngateway')
        assert gateway,redact(final)
        expected_id=resource.get('current_id',resource['gateway']['id'])
        expected_display=resource.get('display',True) if display is None else display
        assert gateway['id']==expected_id and gateway['fordisplay']==expected_display,redact(final)
        for key in ['publicip','vpcid','account','domainid','domain','projectid','project']:
            assert gateway.get(key)==resource['gateway'].get(key),(key,gateway.get(key),resource['gateway'].get(key))
        rows=lookup(resource,expected_display)
        assert len(rows)==1
        for key in ['id','publicip','vpcid','account','domainid','domain','projectid','project','fordisplay']:
            assert rows[0].get(key)==gateway.get(key),(key,rows,gateway)
        defaults=lookup(resource)
        assert len(defaults)==(1 if expected_display else 0), 'Default visibility policy changed'
        resource['display']=expected_display; resource['latest']=gateway; save(f'{cluster}-fixtures.json',f)
        record(resource['scope']+'-'+label,request=params,accepted=accepted,final=final,requery=rows,defaultCount=len(defaults),status='PASS')
        print(cluster,resource['scope'],label,'PASS',flush=True)
    for resource in ([] if '--permissions' in sys.argv else f['resources']):
        for label,display in [('false',False),('omitted-preserves-false',None),('true',True),('omitted-preserves-true',None)]:
            update(resource,label,display)
        for label,display in [('custom-false',False),('custom-omitted-preserves-false',None),('custom-true',True)]:
            custom=str(uuid.uuid5(uuid.NAMESPACE_URL,f['prefix']+'-'+resource['scope']+'-'+label))
            previous_id=resource.get('current_id',resource['gateway']['id'])
            update(resource,label,display,custom)
            params={'id':previous_id,'fordisplay':str(resource['display']).lower(),'listall':'true'}
            if resource['scope']=='project': params['projectid']=f['project']['id']
            old=mold.call('listVpnGateways',params)
            assert failed(old) or not items(old), 'Old UUID still resolves after customid change'
            record(resource['scope']+'-'+label+'-old-id',response=old,status='PASS')
        update(resource,'omitted-after-custom',None)
        other=next(r for r in f['resources'] if r['scope']!=resource['scope'])
        for label,custom in [('duplicate-customid',other.get('current_id',other['gateway']['id'])),('invalid-customid','not-a-uuid')]:
            data=mold.wait(mold.call('updateVpnGateway',{'id':resource['current_id'],'customid':custom}))
            assert failed(data),redact(data)
            assert lookup(resource,True)[0]['id']==resource['current_id']
            record(resource['scope']+'-'+label,response=data,status='PASS')
    data=mold.wait(mold.call('updateVpnGateway',{'id':str(uuid.uuid4())}))
    assert failed(data),redact(data)
    record('missing-target',response=data,status='PASS')
    user=User(cluster,f['account']['name'])
    owned=next(r for r in f['resources'] if r['scope']=='account')
    foreign=next(r for r in f['resources'] if r['scope']=='project')
    rows=lookup(owned,client=user)
    assert len(rows)==1 and 'fordisplay' not in rows[0],redact(rows)
    record('regular-user-response-field-hidden',response=rows,status='PASS')
    data=user.wait(user.call('updateVpnGateway',{'id':foreign['current_id']}))
    assert failed(data),redact(data)
    record('regular-user-foreign-resource-denied',response=data,status='PASS')
    assert lookup(foreign,True)[0]['id']==foreign['current_id']
    # Existing BaseCmd policy ignores unauthorized Admin-only parameters.
    data=user.wait(user.call('updateVpnGateway',{'id':owned['current_id'],'fordisplay':'false','customid':str(uuid.uuid4())}))
    if not failed(data):
        result=data['queryasyncjobresultresponse']['jobresult']['vpngateway']
        assert result['id']==owned['current_id'] and 'fordisplay' not in result,redact(data)
        outcome='unauthorized parameters ignored by existing BaseCmd policy'
    else: outcome='command denied by existing role policy'
    actual=lookup(owned,True)
    assert len(actual)==1 and actual[0]['id']==owned['current_id'] and actual[0]['fordisplay'] is True
    record('regular-user-admin-only-parameters-preserved',response=data,outcome=outcome,status='PASS')
    contracts=items(mold.call('listApis'))
    contract=next(x for x in contracts if x['name']=='updateVpnGateway')
    assert next(p for p in contract['params'] if p['name']=='id')['description']=='ID of the site-to-site VPN local gateway'
    record('id-description',contract=contract,status='PASS')
    print(cluster,'API validation PASS',len(tests),'cases; regular user:',outcome,flush=True)

if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(validate,[31,32]))
