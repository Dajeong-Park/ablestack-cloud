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
import base64, hashlib, subprocess

FIELDS=['id','name','account','domainid','projectid','publicip','ipaddress','vpcid','cidr','zoneid','fordisplay','state','type','issourcenat','isstaticnat','networkid','virtualmachineid']
def stable(data):
    return sorted([{k:v for k,v in row.items() if k in FIELDS} for row in items(data)],key=lambda x:x['id'])

REMOTE=r'''
import hashlib,json,pathlib,subprocess,zipfile
root=pathlib.Path('/usr/share/cloudstack-management');web=root/'webapp'
jar=root/'lib/cloudstack-4.23.0.0-ABLESTACK.Mold.jar'
sha=lambda b:hashlib.sha256(b).hexdigest()
run=lambda *a:subprocess.check_output(a,text=True).strip()
name='org/apache/cloudstack/api/command/user/vpn/CreateVpnGatewayCmd.class'
with zipfile.ZipFile(jar) as z: classhash=sha(z.read(name))
log=pathlib.Path('/var/log/cloudstack/management/management-server.log')
with log.open('rb') as stream:
 stream.seek(max(0,log.stat().st_size-4000000));tail=stream.read().decode(errors='replace')
patterns=['VerifyError','ClassFormatError','UnsupportedClassVersionError','NoClassDefFoundError']
failures=[line[:300] for line in tail.splitlines() if any(p in line for p in patterns)]
print(json.dumps({'jarSha256':sha(jar.read_bytes()),'classSha256':classhash,'indexSha256':sha((web/'index.html').read_bytes()),'configSha256':sha((web/'config.json').read_bytes()),'webInf':(web/'WEB-INF').is_dir(),'http':run('curl','-s','-o','/dev/null','-w','%{http_code}','http://127.0.0.1:8080/client/'),'service':run('systemctl','is-active','mold'),'pid':run('systemctl','show','mold','-p','MainPID','--value'),'recentLogClassLoadingFailures':failures}))
'''

def check(cluster):
    mold=Mold(cluster)
    before=json.loads((OUT/f'{cluster}-inventory-before.json').read_text())
    commands=['listVPCs','listVPCOfferings','listProjects','listAccounts','listVpnGateways','listVpnConnections','listVpnCustomerGateways','listPublicIpAddresses']
    after={name:mold.call(name,{'listall':'true','page':1,'pagesize':500}) for name in commands}
    checks=[]
    for name,data in after.items():
        assert 'errorcode' not in next(iter(data.values())),redact(data)
        assert stable(data)==stable(before[name]),(cluster,name,stable(before[name]),stable(data))
        checks.append({'scope':'default','api':name,'count':len(items(data)),'preserved':True})
    after['projects']={}
    for project,original in before['projects'].items():
        current={name:mold.call(name,{'projectid':project,'listall':'true','page':1,'pagesize':500}) for name in original}
        for name,data in current.items():
            assert 'errorcode' not in next(iter(data.values()))
            assert stable(data)==stable(original[name]),(project,name)
            checks.append({'scope':project,'api':name,'count':len(items(data)),'preserved':True})
        after['projects'][project]=current
    hosts=items(mold.call('listHosts',{'type':'Routing','listall':'true'}))
    assert len(hosts)==3 and all(h['state']=='Up' and h['resourcestate']=='Enabled' for h in hosts)
    save(f'{cluster}-inventory-after.json',after)
    run=subprocess.run(['sshpass','-e','ssh','-p','22','-o','ConnectTimeout=10',f'ablecloud@10.10.{cluster}.10','sudo -n python3 -'],input=REMOTE,text=True,capture_output=True,check=True)
    runtime=json.loads(run.stdout)
    prior=json.loads((OUT/f'{cluster}-deployment-before.json').read_text())
    manifest=json.loads((OUT/'ui-manifest.json').read_text())
    deployed=json.loads((OUT/f'{cluster}-deployment.json').read_text())
    classinfo=json.loads((OUT/'preservation-check.json').read_text())
    assert runtime['jarSha256']==deployed['newJarSha256'] and runtime['classSha256']==classinfo['classSha256']
    assert runtime['indexSha256']==manifest['indexSha256'] and runtime['configSha256']==prior['config_sha256']
    assert runtime['pid']==deployed['pid']
    fixture=json.loads((OUT/f'{cluster}-fixtures.json').read_text())
    vm=items(mold.call('listVirtualMachines',{'id':fixture['vmReference']['id'],'listall':'true'}))
    assert len(vm)==1 and all(vm[0].get(k)==v for k,v in fixture['vmReference'].items())
    assert runtime['webInf'] and runtime['http']=='200' and runtime['service']=='active' and not runtime['recentLogClassLoadingFailures']
    report={'status':'PASS','preservationFields':FIELDS,'checks':checks,'routingHosts':[{'id':h['id'],'name':h['name'],'state':h['state'],'resourcestate':h['resourcestate']} for h in hosts],'runtime':runtime,'dedicatedFixturesRemaining':0}
    save(f'{cluster}-postcheck.json',report)
    print(cluster,'cleanup/preservation PASS',len(checks),'resource-context checks; hosts 3 Up/Enabled; HTTP 200',flush=True)

if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(check,[31,32]))
