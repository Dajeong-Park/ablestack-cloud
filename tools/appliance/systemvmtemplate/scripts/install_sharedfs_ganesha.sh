#!/bin/bash
# Licensed under the Apache License, Version 2.0. See NOTICE.
# Runs inside the disposable image builder, never on the management/host OS.
set -euo pipefail
if [ "$(dpkg --print-architecture)" != amd64 ]; then
  echo "SharedFS native POSIX ACL image profile is currently amd64-only"
  exit 0
fi
source_commit=2a57b6d53295426247b200cd100ba0741b12aff9
ntirpc_commit=bf7fd0259c33ce95f5f2bf22817a8912f7fe5188
helpers=/usr/share/cloud/sharedfs-build
work=$(mktemp -d /var/tmp/sharedfs-ganesha-build.XXXXXXXX)
trap 'rm -rf -- "$work"' EXIT
apt-mark showmanual > "$work/manual-before"
apt-get update
apt-get install -y --no-install-recommends git ca-certificates
git clone --depth 1 --branch V5.5.3 https://github.com/nfs-ganesha/nfs-ganesha.git "$work/ganesha"
test "$(git -C "$work/ganesha" rev-parse HEAD)" = "$source_commit"
git -C "$work/ganesha" submodule update --init src/libntirpc
test "$(git -C "$work/ganesha/src/libntirpc" rev-parse HEAD)" = "$ntirpc_commit"
GANESHA_BUILD_ROOT="$work" bash "$helpers/ganesha-posix-acl-container.sh"
prefix=/opt/ablestack-ganesha/5.5.3-posix-acl
test ! -e "$prefix"
mkdir -p "$(dirname "$prefix")"
cp -a "$work/stage$prefix" "$prefix"
# This is an actual NFSv4 named-access/deny/default-ACL test on a fresh SPARSE
# filesystem in private mount+network namespaces. Do not manufacture attestations.
python3 "$helpers/probe-ganesha-posix-acl.py" --prefix "$prefix" --profile "$work/profile.json"
tar -C "$work/stage" -czf "$work/native.tar.gz" "opt/ablestack-ganesha/5.5.3-posix-acl/bin" "opt/ablestack-ganesha/5.5.3-posix-acl/lib"
python3 "$helpers/install-ganesha-posix-acl.py" "$work/native.tar.gz" "$work/profile.json"
# Preserve existing manually installed packages and mark only new build tools
# automatic. Runtime packages needed by the private build remain explicit.
apt-mark showmanual > "$work/manual-after"
comm -13 <(sort "$work/manual-before") <(sort "$work/manual-after") | xargs -r apt-mark auto
apt-mark manual libacl1 libcap2 libblkid1 libdbus-1-3 liburcu8 libkrb5-3 libgssapi-krb5-2 libnfsidmap1 libsqlite3-0 libssl3 libsystemd0 libunwind8
apt-get -y autoremove
rm -rf -- "$helpers"
echo "SharedFS Ganesha native POSIX ACL image profile verified"
