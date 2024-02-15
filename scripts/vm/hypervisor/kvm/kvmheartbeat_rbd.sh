#!/bin/bash
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

help() {
  printf "Usage: $0 
                    -p rbd pool name
                    -n pool auth username
                    -s pool auth secret
                    -h host
                    -i source host ip
                    -r write/read hb log 
                    -c cleanup
                    -t interval between read hb log\n"
  exit 1
}
#set -x
PoolName=
PoolAuthUserName=
PoolAuthSecret=
HostIP=
SourceHostIP=
interval=0
rflag=0
cflag=0

while getopts 'p:n:s:h:i:t:r:c:' OPTION
do
  case $OPTION in
  p)
     PoolName="$OPTARG"
     ;;
  n)
     PoolAuthUserName="$OPTARG"
     ;;
  s)
     PoolAuthSecret="$OPTARG"
     ;;
  h)
     HostIP="$OPTARG"
     ;;
  i)
     SourceHostIP="$OPTARG"
     ;;
  t)
     interval="$OPTARG"
     ;;
  r)
     rflag=1 
     ;;
  c)
     cflag=1
     ;;
  *)
     help
     ;;
  esac
done

if [ -z "$PoolName" ]; then
  exit 2
fi


#write the heart beat log
write_hbLog() {
  Timestamp=$(date +%s)
  obj=$(rbd -p $PoolName ls --id $PoolAuthUserName | grep MOLD-HB)

  if [ $? -gt 0 ]; then
     rbd -p $PoolName create --size 1 --id $PoolAuthUserName MOLD-HB
  fi

  obj=$(rbd -p $PoolName --id $PoolAuthUserName image-meta set MOLD-HB $HostIP $Timestamp)
  if [ $? -gt 0 ]; then
   	printf "Failed to create rbd file"
    return 2
  fi
  return 0
}

#check the heart beat log
check_hbLog() {
  now=$(date +%s)
  getHbTime=$(rbd -p $PoolName --id $PoolAuthUserName image-meta get MOLD-HB $HostIP)
  diff=$(expr $now - $getHbTime)

  if [ $diff -gt $interval ]; then
    return $diff
  fi
  return 0
}

if [ "$rflag" == "1" ]; then
  check_hbLog
  diff=$?
  if [ $diff == 0 ]; then
    echo "=====> ALIVE <====="
  else
    echo "=====> Considering host as DEAD because last write on [RBD pool] was [$diff] seconds ago, but the max interval is [$interval] <======"
  fi
    exit 0
elif [ "$cflag" == "1" ]; then
  /usr/bin/logger -t heartbeat "kvmheartbeat_rbd.sh will reboot system because it was unable to write the heartbeat to the storage."
  sync &
  sleep 5
  echo b > /proc/sysrq-trigger
  exit $?
else
  write_hbLog
  exit 0
fi
