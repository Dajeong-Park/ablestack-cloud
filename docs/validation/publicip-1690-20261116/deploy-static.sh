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
artifact=/home/ablecloud/publicip1690-ui.tgz
web=/usr/share/cloudstack-management/webapp
stamp=$(date -u +%Y%m%d-%H%M%S)
backup=/root/publicip1690-ui-$stamp
mkdir -p "$backup/dist"
test -d "$web/WEB-INF"
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/client/)" = 200
sha256sum /usr/share/cloudstack-management/lib/cloudstack-4.23.0.0-ABLESTACK.Mold.jar > "$backup/backend-before.sha256"
systemctl show mold -p MainPID -p ActiveState
cd "$web"
server_dirs=(WEB-INF)
[ ! -d META-INF ] || server_dirs+=(META-INF)
find "${server_dirs[@]}" -type f -print0 | sort -z | xargs -0 sha256sum > "$backup/server-before.sha256"
sha256sum config.json > "$backup/config-before.sha256"
sha256sum index.html > "$backup/index-before.sha256"
tar -xzf "$artifact" -C "$backup/dist"
# The artifact contains static build output only. Runtime config stays local.
paths=()
for name in index.html assets css js locales fonts img images favicon.ico favicon.png; do
  if [ -e "$backup/dist/$name" ]; then paths+=("$name"); fi
done
[ -f "$backup/dist/index.html" ]
old=()
for name in "${paths[@]}"; do [ ! -e "$web/$name" ] || old+=("$name"); done
python3 - "$backup/dist" "$web" "$backup/overwritten.paths0" "${paths[@]}" <<'PY'
import sys,pathlib
source,target,listing=map(pathlib.Path,sys.argv[1:4]);changed=[]
for name in sys.argv[4:]:
 root=source/name
 for path in ([root] if root.is_file() else root.rglob('*')):
  if not path.is_file():continue
  relative=path.relative_to(source);old=target/relative
  if old.is_symlink() or (old.is_file() and old.read_bytes()!=path.read_bytes()):changed.append(str(relative))
listing.write_bytes(b''.join(p.encode()+b'\0' for p in changed))
print('STATIC_FILES_BACKED_UP='+str(len(changed)))
PY
tar -czf "$backup/static-before.tgz" --null -T "$backup/overwritten.paths0"
for name in "${paths[@]}"; do
  if [ -d "$backup/dist/$name" ]; then
    mkdir -p "$web/$name"
    rsync -rt --chmod=D755,F644 "$backup/dist/$name/" "$web/$name/"
  else
    install -m 644 "$backup/dist/$name" "$web/$name"
  fi
done
(cd "$backup/dist"; find "${paths[@]}" -type f -print0 | sort -z | xargs -0 sha256sum) > "$backup/static-after.sha256"
sha256sum --quiet -c "$backup/static-after.sha256"
sha256sum --quiet -c "$backup/server-before.sha256"
sha256sum --quiet -c "$backup/config-before.sha256"
test -d "$web/WEB-INF"
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/client/)" = 200
for marker in public-ip-status public-ip-release-summary label.public.ip.allocated public-ip-search-control displayall message.public.ip.search.scope public-ip-network-reference public-ip-display message.public.ip.display.pending message.public.ip.copy.failed public-ip-detail-value public-ip-reservation blockingLoadingState fetchSyncProgress extractJobId vnf-search-select vnf-unmanage vmEditCurrent; do
  grep -rl "$marker" js >/dev/null
done
sha256sum index.html "$artifact"
printf 'BACKUP=%s\nSERVER_CONFIG_PRESERVED=1\nHTTP=200\nWEB_INF=present\n' "$backup"
sha256sum --quiet -c "$backup/backend-before.sha256"
systemctl show mold -p MainPID -p ActiveState
cat "$backup/backend-before.sha256"
