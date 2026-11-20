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
import json,math,re,hashlib
from PIL import Image,ImageChops
out=Path('docs/validation/s2s-1723-breadcrumb-20261120');rows=json.loads((out/'captures.json').read_text(encoding='utf-8'));by={r['name']:r for r in rows};report={'contexts':[],'assertions':0,'failures':[]}
def check(ok,key):
 report['assertions']+=1
 if not ok:report['failures'].append(key)
def rgba(s):
 nums=[float(x) for x in re.findall(r'[\d.]+',s)];return nums[:3]+[nums[3] if len(nums)>3 else 1]
def blend(f,b):return [f[i]*f[3]+b[i]*(1-f[3]) for i in range(3)]+[1]
def luminance(c):
 vals=[v/255 for v in c[:3]];return sum(w*(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for w,v in zip([.2126,.7152,.0722],vals))
def contrast(color,bg):
 a,b=sorted([luminance(blend(rgba(color),rgba(bg))),luminance(rgba(bg))]);return (b+.05)/(a+.05)
for cluster in [31,32]:
 for width in [390,768,1280]:
  for theme in ['light','dark']:
   prefix=f'{cluster}-{width}-{theme}-'
   if prefix+'vpn-error' not in by:continue
   ref=by[prefix+'vm-list']['metrics'];vpn=by[prefix+'vpn-list']['metrics'];summary={'cluster':cluster,'width':width,'theme':theme}
   for elem in ['card','body','row','path','left','right']:
    for prop in ['padding','margin','display','fontSize','fontWeight','border','borderRadius','gap']:
     check(ref[elem][prop]==vpn[elem][prop],prefix+elem+'/'+prop)
   for prop in ['background','color']:check(ref['card'][prop]==vpn['card'][prop],prefix+'card/'+prop)
   buttons=vpn['controls']['buttons'];action=buttons[0];search=vpn['search'];check(abs(action['y']-search['y'])<1,prefix+'action/search top alignment')
   check(min(t['y'] for t in vpn['tags'])>=max(action['y']+action['height'],search['y']+search['height']),prefix+'chips separate row')
   for suffix in ['vm-list','vm-detail','vpn-list','vpn-hidden','vpn-search','vpn-error','vpn-detail']:
    r=by.get(prefix+suffix)
    if not r:continue
    check(r['metrics']['width']==width and r['imageSize']=={'width':width,'height':720},prefix+suffix+' viewport')
    check(r['metrics']['pageWidth']<=width,prefix+suffix+' overflow')
    p=out/'screenshots'/(r['name']+'.png');im=Image.open(p);check(im.size==(width,720),prefix+suffix+' png')
    if width==1280:check(ImageChops.difference(im.crop((0,0,379,720)),im.crop((901,0,1280,720))).getbbox() is not None,prefix+suffix+' repeat')
   m=by[prefix+'vpn-search']['metrics'];bg=m['controls']['formSurface']['background'];color=m['controls']['formExtra']['color'];summary['helpContrast']=round(contrast(color,bg),3);summary['helpColor']=color;check(summary['helpContrast']>=4.5,prefix+'help contrast')
   hint=m['controls']['formHint'];check(contrast(hint['color'],bg)>=4.5,prefix+'account hint contrast')
   e=by[prefix+'vpn-error']['metrics']['controls'];errorbg=blend(rgba(e['errorSurface']['background']),rgba(e['formSurface']['background']));errorrgb='rgb('+','.join(map(str,errorbg[:3]))+')';summary['errorContrast']=round(contrast(e['formError']['color'],errorrgb),3);check(summary['errorContrast']>=4.5,prefix+'error contrast')
   ref=by[prefix+'vm-detail']['metrics'];vpn=by[prefix+'vpn-detail']['metrics']
   for elem in ['card','body','row','path','left','right']:
    for prop in ['padding','margin','display','fontSize','fontWeight','border','borderRadius','gap']:check(ref[elem][prop]==vpn[elem][prop],prefix+'detail '+elem+'/'+prop)
   report['contexts'].append(summary)
(out/'breadcrumb-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('Contexts',len(report['contexts']),'assertions',report['assertions'],'failures',report['failures']);print('Contrast',[(r['cluster'],r['width'],r['theme'],r['helpContrast'],r['errorContrast']) for r in report['contexts']]);assert not report['failures']
