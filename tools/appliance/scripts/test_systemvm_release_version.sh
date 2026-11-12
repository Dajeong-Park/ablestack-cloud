#!/bin/bash
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
set -euo pipefail
APPLIANCE_DIR=$(cd "$(dirname "$0")/.." && pwd)
TEST_DIR=$(mktemp -d /tmp/systemvm-release-test.XXXXXX)
trap 'rm -rf "$TEST_DIR"' EXIT

check_definition() (
  local product=$1 build=$2
  cd "$TEST_DIR"
  mkdir -p systemvmtemplate/scripts
  cp "$APPLIANCE_DIR/systemvmtemplate/scripts/configure_systemvm_services.sh" systemvmtemplate/scripts/
  printf '#!/bin/bash\nexit 0\n' > shar_cloud_scripts.sh
  chmod +x shar_cloud_scripts.sh
  # Exercise the actual definition builder without running Packer.
  set +u
  source "$APPLIANCE_DIR/build.sh" systemvmtemplate "$product" x86_64 "$build"
  create_definition
  test "$appliance_build_name" = "systemvmtemplate-$product.$build-x86_64"
  grep -Fx "CLOUDSTACK_RELEASE=$product" "$appliance_build_name/scripts/configure_systemvm_services.sh"
)

check_definition 4.23.0.0 1569.20261109
check_definition 4.23.0 123
if bash -c 'source "$1" systemvmtemplate 4.23.0.0.1569 x86_64 1' _ "$APPLIANCE_DIR/build.sh"; then
  echo "Malformed product version was accepted" >&2
  exit 1
fi
echo 'SystemVM product/build version separation: PASS'
