# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.

from pathlib import Path
import hashlib,json,re
from PIL import Image
p=Path(__file__).resolve().parent
raw=json.loads((p/'ui-captures.json').read_text(encoding='utf-8'))
latest={r['name']:r for r in raw}
checks=[]
def check(ok,label):
 checks.append({'check':label,'passed':bool(ok)})
 if not ok:raise AssertionError(label)
def lum(rgb):
 a=[v/255 for v in rgb];a=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in a]
 return .2126*a[0]+.7152*a[1]+.0722*a[2]
def contrast(fg,bg):
 f=[float(x) for x in re.findall(r'[0-9.]+',fg)];b=[float(x) for x in re.findall(r'[0-9.]+',bg)]
 alpha=f[3] if len(f)>3 else 1
 f=[f[i]*alpha+b[i]*(1-alpha) for i in range(3)]
 x,y=sorted([lum(f),lum(b)])
 return (y+.05)/(x+.05)
frames=[];ratios=[]
for c in [31,32]:
 for width in [390,768,1280]:
  for theme in ['light','dark']:
   prefix=f'{c}-{width}-{theme}-'
   vm=latest[prefix+'vm']['metrics']
   for mode in ['vm','default-all','visible','hidden','all','advanced']:
    r=latest[prefix+mode];m=r['metrics'];png=p/'screenshots'/(r['name']+'.png')
    im=Image.open(png).convert('RGB');frames.append(r['name'])
    check(im.size==(width,720)==(m['width'],m['height']),r['name']+'/native-dimensions')
    check(m['pageWidth']<=width,r['name']+'/document-width')
    check(m['standardOrder'],r['name']+'/breadcrumb-order')
    check(not m['chips'] and not m['filterRow'],r['name']+'/no-display-chip-row')
    for el in ['card','body','refresh']:
     for key in ['background','padding','fontSize','lineHeight','border','borderRadius','color']:
      check(m[el][key]==vm[el][key],r['name']+'/'+el+'/'+key)
    if mode!='vm':
     check(m['advancedDisplayCount']==0,r['name']+'/no-display-in-advanced-search')
     check(m['displayText']==({'visible':'표시 대상','hidden':'숨김'}.get(mode,'모두')),r['name']+'/display-label')
     count={'visible':2,'hidden':1}.get(mode,3)
     check(len(m['rows'])==count and f'전체 {count} 개' in m['pagination'],r['name']+'/rows-and-count')
    if mode not in ['advanced']:
     a=m['visibleStyles'];b=vm['visibleStyles']
     for el in ['value','selector','refresh']:
      # Focus border is intentionally different after using the select.
      for key in a[el]:
       if key=='border' and el=='selector':continue
       check(a[el][key]==b[el][key],r['name']+'/actual-'+el+'/'+key)
     ratio=contrast(a['value']['color'],a['cardBackground']);ratios.append(ratio)
     check(ratio>=4.5,r['name']+'/selected-text-contrast')
    else:
     check(m['form']['labels']==['아이디','도메인','계정','VPC'],r['name']+'/advanced-fields')
     ratio=contrast(m['form']['hint']['color'],m['form']['surface']['background']);ratios.append(ratio)
     check(ratio>=4.5,r['name']+'/help-text-contrast')
    if width==1280:
     # Detect accidental duplicated screenshot tiles, ignoring chrome/UI structure.
     same=True
     for yy in [120,240,360,480,600]:
      if im.crop((0,yy,300,yy+30)).tobytes()!=im.crop((901,yy,1201,yy+30)).tobytes():same=False
     check(not same,r['name']+'/no-repeated-901px-tile')
    r['pngSha256']=hashlib.sha256(png.read_bytes()).hexdigest()
manifest={'source':next(iter(latest.values()))['source'],'contexts':12,'matrixFrames':72,'matrix':frames,'captures':list(latest.values()),'rawCaptureCount':len(raw),'deduplication':'Latest observation by name; screenshot/DOM files overwrite by name.'}
(p/'ui-capture-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
report={'source':manifest['source'],'contexts':12,'matrixFrames':len(frames),'nativePngDimensions':True,'minMeasuredTextContrast':round(min(ratios),2),'checks':checks,'passed':True}
(p/'ui-standard-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('UI audit PASS:',len(frames),'frames;',len(checks),'checks; minimum contrast',round(min(ratios),2))
