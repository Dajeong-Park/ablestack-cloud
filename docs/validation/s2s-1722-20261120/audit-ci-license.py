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
import hashlib,json,re,subprocess,sys
out=Path('docs/validation/s2s-1722-20261120')
log=out/sys.argv[1]
lines=[re.sub(r'^.*?\t\d{4}-\d\d-\d\dT\S+\s?', '',line) for line in log.read_text().splitlines()]
start=next(i for i,line in enumerate(lines) if line=='Files with unapproved licenses:')
paths=[]
for line in lines[start+1:]:
    if line.startswith('*****') and paths: break
    if line.strip(): paths.append(line.strip())
count=int(re.search(r'Unapproved: (\d+)',log.read_text())[1])
assert len(paths)==count,(len(paths),count)
def tree(revision):
    data=subprocess.check_output(['git','ls-tree','-rz',revision])
    return {entry.split(b'\t',1)[1].decode():entry.split(b'\t',1)[0].split()[-1].decode() for entry in data.split(b'\0') if entry}
base='41fe8cb0dd0c05e95c4ef6d110dafc26b85a01e2'
b=tree(base); h=tree('HEAD')
unchanged=[p for p in paths if p in b and b[p]==h.get(p)]
resolved=[p for p in paths if p not in h]
new=[p for p in paths if p not in unchanged and p not in resolved]
report={'log':log.name,'base':base,'head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'unapprovedCount':count,'byteIdenticalToBase':len(unchanged),'noLongerPresentAtHead':resolved,'newOrChangedAtHead':new,'pathListSha256':hashlib.sha256('\n'.join(sorted(paths)).encode()).hexdigest(),'baseBlobIds':{p:b[p] for p in unchanged}}
(out/log.name.replace('.log','-audit.json')).write_text(json.dumps(report,indent=2)+'\n')
print({k:v for k,v in report.items() if k!='baseBlobIds'})
assert not new
