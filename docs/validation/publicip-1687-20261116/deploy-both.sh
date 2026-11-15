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
cd /home/ablecloud/work/issue-1685-public-ip
evidence=docs/validation/publicip-1687-20261116
test -f ui/dist/index.html
rg 'Build complete' "$evidence/build.log"
tar -C ui/dist -czf "$evidence/publicip1687-ui.tgz" .
sha256sum "$evidence/publicip1687-ui.tgz" > "$evidence/artifact.sha256"
git rev-parse HEAD > "$evidence/build-source.txt"
for cluster in 31 32; do
  sshpass -e scp -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "$evidence/publicip1687-ui.tgz" "ablecloud@10.10.$cluster.10:/home/ablecloud/publicip1687-ui.tgz"
  sshpass -e scp -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "$evidence/deploy-static.sh" "ablecloud@10.10.$cluster.10:/home/ablecloud/publicip1687-deploy-static.sh"
  sshpass -e ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "ablecloud@10.10.$cluster.10" 'sudo -n bash /home/ablecloud/publicip1687-deploy-static.sh' > "$evidence/deploy-$cluster.log" 2>&1
  cat "$evidence/deploy-$cluster.log"
done
