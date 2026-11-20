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

import json
from pathlib import Path
out=Path(__file__).parent
all_entries=json.loads((out/'ui-captures.json').read_text(encoding='utf-8'))['captures']
entries={e['name']:e for e in all_entries}
report=[];errors=[]
for cluster in [31,32]:
 for width in [390,768,1280]:
  for theme in ['light','dark']:
   prefix=f'{cluster}-{width}-{theme}-'
   rows={n:entries[prefix+n] for n in ['vm-detail','vm-list','vm-dialog','s2s-detail','s2s-list','s2s-connections','s2s-create','s2s-delete']}
   checks=[]
   def check(name,okay):
    checks.append({'check':name,'pass':bool(okay)})
    if not okay:errors.append(prefix+name)
   for name,row in rows.items():
    m=row['metrics']
    check(name+' actual viewport and native PNG',m['width']==width and row['imageSize']=={'width':width,'height':720})
    check(name+' no document horizontal overflow',m['pageWidth']<=width+1)
    check(name+' actual theme',('dark-mode' in m['theme'])==(theme=='dark'))
   v=rows['vm-detail']['metrics'];s=rows['s2s-detail']['metrics']
   for key,fields in [('breadcrumb',['fontSize','lineHeight','padding']),('title',['fontSize','lineHeight']),('content',['padding','fontSize','background']),('detailRow',['padding','fontSize','lineHeight','color'])]:
    for field in fields:check(key+' '+field,v[key][field]==s[key][field])
   check('tabs orientation',('ant-tabs-top' in v['tabsClass'])==('ant-tabs-top' in s['tabsClass']))
   check('content width',abs(v['content']['width']-s['content']['width'])<=1)
   check('tabs inset from card',abs((v['nav']['y']-v['content']['y'])-(s['nav']['y']-s['content']['y']))<=1)
   check('tabs rail width',abs(v['nav']['width']-s['nav']['width'])<=1)
   for key in ['tableHeader','tableCell']:
    for field in ['padding','fontSize','lineHeight','color','background']:
     check('list '+key+' '+field,rows['vm-list']['metrics'][key][field]==rows['s2s-list']['metrics'][key][field])
   vm=rows['vm-dialog']['metrics']['modal'][0]
   for name in ['s2s-create','s2s-delete']:
    actual=rows[name]['metrics']['modal'][0]
    for field in ['width','bodyPadding','footerPadding','bodyOverflow']:check(name+' '+field,vm[field]==actual[field])
    check(name+' footer visible',actual['footerBottom']<=720 and actual['footerTop']>=0)
   report.append({'cluster':cluster,'width':width,'theme':theme,'checks':checks,'status':'PASS' if all(c['pass'] for c in checks) else 'FAIL'})
actions = json.loads((out/'create-matrix-actions.json').read_text())
assert len(actions)==12
for action in actions:
 assert action['readonlyIp']==['10.10.31.107' if action['cluster']==31 else '10.10.32.170']
 assert action['scrollTop']>0 and action['escapeClosed']
 assert action['tabFocus']=='VPN 게이트웨이 추가' and action['restoredFocus']=='VPN 게이트웨이 추가'
(out/'ui-matrix.json').write_text(json.dumps({'contexts':report,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(len(report),'contexts;',sum(len(r['checks']) for r in report),'checks;',len(errors),'differences')
print('\n'.join(errors))
assert not errors


import hashlib,struct
for name,digest in json.loads((out/'ui-evidence-sha256.json').read_text()).items():
 assert hashlib.sha256((out/name).read_bytes()).hexdigest()==digest,name
for row in all_entries:
 data=(out/'screenshots'/(row['name']+'.png')).read_bytes()
 assert data[:8]==b'\x89PNG\r\n\x1a\n'
 assert struct.unpack('>II',data[16:24])==(row['metrics']['width'],row['metrics']['height'])
print(len(all_entries),'native PNG dimensions/SHA256 verified; 12 keyboard/scroll/focus cases PASS')
