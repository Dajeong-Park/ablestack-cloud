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
import json,hashlib,re
from PIL import Image,ImageChops
out=Path('docs/validation/s2s-1723-20261120');rows=json.loads((out/'ui-captures.json').read_text(encoding='utf-8'))['captures'];pattern=re.compile(r'^(31|32)-(390|768|1280)-(light|dark)-');matrix={r['name']:r for r in rows if pattern.match(r['name']) and r.get('source')=='025ae706601'};assert len(matrix)==168
report={'source':'025ae706601','contexts':[],'imageAudit':[],'assertions':0,'failures':[]}
def check(condition,name):
 report['assertions']+=1
 if not condition:report['failures'].append(name)
for cluster in [31,32]:
 for width in [390,768,1280]:
  for theme in ['light','dark']:
   p=f'{cluster}-{width}-{theme}-';m=lambda suffix:matrix[p+suffix]['metrics'];vm=m('vm-edit');vd=m('vm-detail');sd=m('s2s-detail');vs=m('vm-search')['compare']['search'];ss=m('s2s-search')['compare']['search'];context={'cluster':cluster,'width':width,'theme':theme,'captures':14}
   for name,r in matrix.items():
    if not name.startswith(p):continue
    check(r['metrics']['width']==width and r['imageSize']=={'width':width,'height':720},name+' requested dimensions')
    check(r['metrics']['pageWidth']<=width,name+' document overflow')
   for suffix in ['s2s-create','s2s-edit','s2s-delete']:
    modal=m(suffix)['modal'][0];ref=vm['modal'][0]
    for key in ['width','bodyPadding','footerPadding','bodyOverflow']:check(modal[key]==ref[key],p+suffix+' '+key)
    check(0<=modal['footerTop']<modal['footerBottom']<=720,p+suffix+' footer boundary')
    for button in modal['buttons']:check(0<=button['x']<button['right']<=width,p+suffix+' '+button['text']+' button boundary')
   check(m('s2s-edit')['modal'][0]['buttons'][-1]['disabled'],p+'same value disabled')
   check(not m('s2s-edit-keyboard')['modal'][0]['buttons'][-1]['disabled'],p+'changed value enabled')
   check(m('s2s-edit-keyboard')['focus']=='표시 설정 수정',p+'keyboard primary focus')
   check(m('s2s-search')['focus']==m('vm-search')['focus'],p+'search trigger focus matches VM')
   for kind in ['input','select','label']:
    for key in ['fontSize','padding','color','background']:check(vs[kind][key]==ss[kind][key],p+'search '+kind+' '+key)
   for key in ['fontSize','padding','color','background']:check(vs['panel'][key]==ss['panel'][key],p+'search panel '+key)
   for key in ['content','nav','detailRow','breadcrumb','title']:
    for prop in ['padding','fontSize','color','background']:check(vd[key][prop]==sd[key][prop],p+key+' '+prop)
   check(abs(vd['nav']['width']-sd['nav']['width'])<1,p+'tab rail width')
   check(set(vd['tabsClass'].split())==set(x for x in sd['tabsClass'].split() if x.startswith('ant-')),p+'tab direction classes')
   for key in ['tableHeader','tableCell']:
    for prop in ['padding','fontSize','color','background']:check(m('vm-list')[key][prop]==m('s2s-list')[key][prop],p+key+' '+prop)
   check((m('vm-list')['sidebar'] or {}).get('width')==(m('s2s-list')['sidebar'] or {}).get('width'),p+'same sidebar width')
   context['scroll']={suffix:{k:m(suffix)['modal'][0][k] for k in ['bodyHeight','bodyScrollHeight','scrollTop']} for suffix in ['vm-edit','vm-edit-scroll','s2s-create','s2s-create-scroll','s2s-edit','s2s-edit-keyboard']}
   report['contexts'].append(context)
for name,r in matrix.items():
 path=out/'screenshots'/(name+'.png');im=Image.open(path);width=r['metrics']['width'];check(im.size==(width,720),name+' PNG dimension')
 repeated=width==1280 and ImageChops.difference(im.crop((0,0,379,720)),im.crop((901,0,1280,720))).getbbox() is None;check(not repeated,name+' repeated tile')
 report['imageAudit'].append({'name':name,'width':im.width,'height':im.height,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'repeated901':repeated})
(out/'vm-ui-standard-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('contexts',len(report['contexts']),'assertions',report['assertions'],'failures',report['failures'])
assert not report['failures']
