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

set -euo pipefail
web=/usr/share/cloudstack-management/webapp
jar=/usr/share/cloudstack-management/lib/cloudstack-4.23.0.0-ABLESTACK.Mold.jar
class=org/apache/cloudstack/api/command/user/address/ListPublicIpAddressesCmd.class
backup=/root/publicip1689-api-$(date -u +%Y%m%d-%H%M%S)
mkdir -p "$backup"
test -d "$web/WEB-INF"
cp -p "$jar" "$backup/backend-before.jar"
sha256sum "$jar" /home/ablecloud/ListPublicIpAddressesCmd-1689.class
python3 - "$jar" "$class" "$backup" <<'PY'
import sys,zipfile,pathlib,hashlib,json
jar=pathlib.Path(sys.argv[1]);entry=sys.argv[2];backup=pathlib.Path(sys.argv[3]);data=pathlib.Path('/home/ablecloud/ListPublicIpAddressesCmd-1689.class').read_bytes();before={}
with zipfile.ZipFile(jar) as source, zipfile.ZipFile(str(jar)+'.1689-stage','w') as dest:
 assert entry in source.namelist()
 assert not any(n.upper().endswith(('.SF','.RSA','.DSA')) for n in source.namelist())
 for item in source.infolist():
  payload=source.read(item.filename)
  if item.filename!=entry:before[item.filename]=hashlib.sha256(payload).hexdigest()
  dest.writestr(item,data if item.filename==entry else payload)
with zipfile.ZipFile(str(jar)+'.1689-stage') as z:
 assert z.read(entry)==data
 assert before=={n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n!=entry}
backup.joinpath('entry-verification.json').write_text(json.dumps({'changedEntry':entry,'classSha256':hashlib.sha256(data).hexdigest(),'otherEntriesPreserved':len(before)},indent=2))
print(backup.joinpath('entry-verification.json').read_text())
PY
chmod --reference="$jar" "$jar.1689-stage"
chown --reference="$jar" "$jar.1689-stage"
mv "$jar.1689-stage" "$jar"
systemctl restart mold
for attempt in $(seq 1 60); do
 if [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/client/ || true)" = 200 ]; then break; fi
 sleep 2
done
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/client/)" = 200
test -d "$web/WEB-INF"
systemctl show mold -p MainPID -p ActiveState
sha256sum "$jar"
printf 'BACKUP=%s\nHTTP=200\nWEB_INF=present\n' "$backup"
