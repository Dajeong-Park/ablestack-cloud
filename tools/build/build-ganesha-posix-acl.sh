#!/bin/bash
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See NOTICE. Apache License, Version 2.0.
set -euo pipefail

output=$(realpath -m "${1:?Usage: build-ganesha-posix-acl.sh OUTPUT_DIRECTORY}")
mkdir -p "$output"
source_commit=2a57b6d53295426247b200cd100ba0741b12aff9
image=docker.io/library/debian@sha256:366a6da5efcceffbaa19c560a101b97b87a1a9664eeeac8bc3d24395ddbf14f3
if [ ! -d "$output/ganesha/.git" ]; then
  git clone --depth 1 --branch V5.5.3 https://github.com/nfs-ganesha/nfs-ganesha.git "$output/ganesha"
fi
test "$(git -C "$output/ganesha" rev-parse HEAD)" = "$source_commit"
git -C "$output/ganesha" submodule update --init src/libntirpc
script_dir=$(cd "$(dirname "$0")" && pwd)
cp "$script_dir/ganesha-posix-acl-container.sh" "$output/build-in-container.sh"
cat > "$output/storage.conf" <<EOF
[storage]
driver = "vfs"
runroot = "$output/podman-run"
graphroot = "$output/podman-store"
EOF
CONTAINERS_STORAGE_CONF="$output/storage.conf" podman run --rm \
  --network host --cgroups=disabled --security-opt label=disable \
  -v "$output:/work" "$image" bash /work/build-in-container.sh
tar -C "$output/stage" -czf "$output/ganesha-posix-acl-5.5.3.tar.gz" \
  opt/ablestack-ganesha/5.5.3/bin opt/ablestack-ganesha/5.5.3/lib
sha256sum "$output/ganesha-posix-acl-5.5.3.tar.gz"
