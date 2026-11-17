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

import json, os, sys, time
from pathlib import Path
import urllib.request, urllib.parse, urllib.error, http.cookiejar

OUT = Path(__file__).parent
SENSITIVE = {'sessionkey','apikey','secretkey','password','zonetoken','secret','rbdsecretkey','users','user','userdetails','sshkeypairs'}
def redact(x):
    if isinstance(x, dict):
        return {k: ('[redacted]' if k.lower() in SENSITIVE else redact(v)) for k,v in x.items()}
    if isinstance(x, list): return [redact(v) for v in x]
    return x

class Mold:
    def __init__(self, cluster):
        self.cluster=str(cluster)
        self.base=f'http://10.10.{cluster}.10:8080/client/api'
        self.s=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        data=self.request({'command':'login','username':'admin','password':os.environ['MOLD_PASSWORD'],'response':'json'})['loginresponse']
        if 'sessionkey' not in data: raise RuntimeError(redact(data))
        self.key=data['sessionkey']
    def request(self, args):
        req=urllib.request.Request(self.base,data=urllib.parse.urlencode(args).encode())
        try:
            with self.s.open(req,timeout=60) as r: return json.load(r)
        except urllib.error.HTTPError as e: return json.load(e)
    def call(self, cmd, params=None):
        args={'command':cmd,'response':'json','sessionkey':self.key,**(params or {})}
        return self.request(args)
    def wait(self, data):
        val=next(iter(data.values()))
        if 'jobid' not in val: return data
        for _ in range(90):
            data=self.call('queryAsyncJobResult',{'jobid':val['jobid']})
            if data['queryasyncjobresultresponse']['jobstatus'] != 0: return data
            time.sleep(2)
        return data

if __name__=='__main__':
    cluster, mode=sys.argv[1:3]
    m=Mold(cluster)
    if mode=='inventory':
        cmds=['listZones','listNetworks','listNetworkOfferings','listPhysicalNetworks','listNetworkServiceProviders','listStoragePools','listVirtualMachines','listTemplates','listServiceOfferings','listRouters','listVPCs','listNetworkACLLists','listPublicIpAddresses','listApis']
        result={}
        for cmd in cmds:
            params={'listall':'true','page':1,'pagesize':500}
            if cmd=='listTemplates': params['templatefilter']='executable'
            result[cmd]=redact(m.call(cmd,params))
        (OUT/f'{cluster}-inventory-before.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        for cmd,data in result.items():
            val=next(iter(data.values()))
            items=next((v for v in val.values() if isinstance(v,list)),[])
            fields=['id','name','displayname','state','type','guestiptype','forvpc','networktype','storagetype','zonename','hypervisor','isready','ispersistent','networkofferingid','ip4routing','internetprotocol']
            print(cmd, json.dumps([{k:v for k,v in x.items() if k in fields} for x in items],ensure_ascii=False) if cmd!='listApis' else f'{len(items)} APIs')
    else:
        params=json.loads(sys.argv[3]) if len(sys.argv)>3 else {}
        data=m.wait(m.call(mode,params))
        if len(sys.argv)>4: (OUT/sys.argv[4]).write_text(json.dumps(redact(data),ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(redact(data),ensure_ascii=False,indent=2))
