#!/bin/bash
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See NOTICE. Apache License, Version 2.0.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends build-essential cmake pkg-config bison flex git ca-certificates libacl1-dev libcap-dev libblkid-dev libdbus-1-dev liburcu-dev libkrb5-dev uuid-dev libnfsidmap-dev libsqlite3-dev libssl-dev libsystemd-dev libunwind-dev
cmake -S /work/ganesha/src -B /work/build \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/opt/ablestack-ganesha/5.5.3 \
  -DENABLE_VFS_POSIX_ACL=ON -DENABLE_VFS_DEBUG_ACL=OFF -DUSE_FSAL_VFS=ON \
  -DUSE_FSAL_PROXY_V4=OFF -DUSE_FSAL_PROXY_V3=OFF -DUSE_FSAL_LUSTRE=OFF \
  -DUSE_FSAL_LIZARDFS=OFF -DUSE_FSAL_KVSFS=OFF -DUSE_FSAL_CEPH=OFF \
  -DUSE_FSAL_GPFS=OFF -DUSE_FSAL_XFS=OFF -DUSE_FSAL_GLUSTER=OFF \
  -DUSE_FSAL_NULL=OFF -DUSE_FSAL_RGW=OFF -DUSE_FSAL_MEM=OFF \
  -DUSE_RADOS_RECOV=OFF -DRADOS_URLS=OFF -DUSE_9P=OFF \
  -DUSE_DBUS=ON -DUSE_GSS=ON -DUSE_NFSIDMAP=ON -D_MSPAC_SUPPORT=OFF \
  -DUSE_GUI_ADMIN_TOOLS=OFF -DUSE_SYSTEM_NTIRPC=OFF
grep -q '^#define ENABLE_VFS_POSIX_ACL 1' /work/build/include/config.h
cmake --build /work/build --parallel 4
DESTDIR=/work/stage cmake --install /work/build
