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

import pathlib,json,hashlib,subprocess,tarfile
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
sha=lambda b:hashlib.sha256(b).hexdigest()
assert str(ROOT).startswith('/home/ablecloud/work/dhslove/')
dist=ROOT/'ui/dist'
for language in ['ko_KR','en']:
    assert (dist/'locales'/(language+'.json')).read_bytes()==(ROOT/'ui/public/locales'/(language+'.json')).read_bytes(), 'Built runtime locale differs from source'
js=''.join(p.read_text() for p in (dist/'js').glob('*.js'))
for marker in ['s2s-vpc-option','s2s-ip-id','s2s-connections-toolbar','s2s-dialog-context','s2s-gateway-search-control','asn-search-control','blockingLoadingState','fetchSyncProgress','extractJobId']:
    assert marker in js,marker
with tarfile.open(OUT/'s2s1722-ui.tgz','w:gz') as t:
    for p in dist.iterdir():
        if p.name not in ['config.json','WEB-INF','META-INF']: t.add(p,arcname=p.name)
paths=subprocess.check_output(['git','diff','--name-only','afbf6f26f14cfdb22cedb65d746c0a3f18784b2e'],text=True).splitlines()
paths+=['ui/src/utils/s2sGateway.js','ui/src/components/view/S2sGatewayValue.vue','ui/src/views/network/S2sVpnConnectionsTab.vue','ui/src/views/network/S2sGatewayDialog.vue']
report={'buildCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'productionSourceMap':False,'uglifySourceMap':False,'validationBuildConfigSha256':sha((ROOT/'ui/.s2s1722-build.config.js').read_bytes()),'sourceBase':'afbf6f26f14cfdb22cedb65d746c0a3f18784b2e','upstreamBase':'41fe8cb0dd0c05e95c4ef6d110dafc26b85a01e2','sourceSha256':{p:sha((ROOT/p).read_bytes()) for p in paths if p.startswith('ui/') and p != 'ui/public/config.json' and (ROOT/p).is_file()},'uiPayloadSha256':sha((OUT/'s2s1722-ui.tgz').read_bytes()),'indexSha256':sha((dist/'index.html').read_bytes()),'backendChanged':True,'changedModules':['api','ui'],'markersVerified':True}
(OUT/'ui-manifest.json').write_text(json.dumps(report,indent=2))
for cluster in [31,32]:
    host=f'ablecloud@10.10.{cluster}.10';opts=['-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=10']
    before=json.loads((OUT/f'{cluster}-deployment-before.json').read_text());before['jar_sha256']=json.loads((OUT/f'{cluster}-deployment.json').read_text())['newJarSha256'];before['ui_index_sha256']=json.loads((OUT/'pilot-ui-manifest.json').read_text())['indexSha256']
    subprocess.run(['sshpass','-e','scp','-P','22',*opts,str(OUT/'s2s1722-ui.tgz'),str(OUT/'deploy-s2s1722-static.sh'),host+':/home/ablecloud/'],check=True)
    r=subprocess.run(['sshpass','-e','ssh','-p','22',*opts,host,'sudo -n bash /home/ablecloud/deploy-s2s1722-static.sh '+before['ui_index_sha256']+' '+before['jar_sha256']+' '+report['uiPayloadSha256']],text=True,capture_output=True)
    (OUT/f'{cluster}-ui-deployment.log').write_text(r.stdout+r.stderr)
    if r.returncode:
        backup=next((line.split('=',1)[1] for line in r.stdout.splitlines() if line.startswith('BACKUP=')),None)
        if backup:
            assert backup.startswith('/root/s2s1722-ui-') and '..' not in backup
            rollback=subprocess.run(['sshpass','-e','ssh','-p','22',*opts,host,'sudo -n tar -xzf '+backup+'/static-before.tgz -C /usr/share/cloudstack-management/webapp'],capture_output=True,text=True)
            (OUT/f'{cluster}-rollback.log').write_text(rollback.stdout+rollback.stderr)
        raise RuntimeError(str(cluster)+' deployment failed; inspect saved report')
    print(cluster,r.stdout[-1100:],flush=True)
subprocess.run(['git','restore','--','ui/public/config.json'],check=True)
