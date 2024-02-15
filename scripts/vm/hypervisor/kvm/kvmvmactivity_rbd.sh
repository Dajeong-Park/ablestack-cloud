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
                    -u volume uuid list
                    -t time on ms
                    -d suspect time\n"
  exit 1
}
#set -x
PoolName=
PoolAuthUserName=
PoolAuthSecret=
HostIP=
SourceHostIP=
UUIDList=
MSTime=
SuspectTime=

while getopts 'p:n:s:h:i:u:t:d:' OPTION
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
  u)
     UUIDList="$OPTARG"
     ;;
  t)
     MSTime="$OPTARG"
     ;;
  d)
     SuspectTime="$OPTARG"
     ;;
  *)
     help
     ;;
  esac
done

if [ -z "$PoolName" ]; then
  exit 2
fi

if [ -z "$SuspectTime" ]; then
  exit 2
fi

# First check: heartbeat file
getHbTime=$(rbd -p $PoolName --id $PoolAuthUserName image-meta get MOLD-HB $HostIP)
diff=$(expr $(date +%s) - $getHbTime)

if [ $diff -lt 61 ]; then
    echo "=====> ALIVE <====="
    exit 0
fi

if [ -z "$UUIDList" ]; then
    echo "=====> Considering host as DEAD due to empty UUIDList <======"
    exit 0
fi

# Second check: disk activity check
lastestUUIDList=
for UUID in $(echo $UUIDList | sed 's/,/ /g'); do
    time=$(rbd -p $PoolName info $UUID --id $PoolAuthUserName | grep modify_timestamp)
    time=${time#*modify_timestamp: }
    time=$(date -d "$time" +%s)
    lastestUUIDList+="${time}\n"
done

latestUpdateTime=$(echo -e $lastestUUIDList 2> /dev/null | sort -nr | head -1)
obj=$(rbd -p $PoolName ls --id $PoolAuthUserName | grep MOLD-AC)
if [ $? -gt 0 ]; then
    rbd -p $PoolName create --size 1 --id $PoolAuthUserName MOLD-AC
    rbd -p $PoolName --id $PoolAuthUserName image-meta set MOLD-AC $HostIP $SuspectTime:$latestUpdateTime:$MSTime
    if [[ $latestUpdateTime -gt $SuspectTime ]]; then
        echo "=====> ALIVE <====="
    else
        echo "=====> Considering host as DEAD due to file [RBD pool] does not exists and condition [latestUpdateTime -gt SuspectTime] has not been satisfied. <======"
    fi
else
    acTime=$(rbd -p $PoolName --id $PoolAuthUserName image-meta get MOLD-AC $HostIP)
    arrTime=(${acTime//:/ })
    lastSuspectTime=${arrTime[0]}
    lastUpdateTime=${arrTime[1]}
    rbd -p $PoolName --id $PoolAuthUserName image-meta set MOLD-AC $HostIP $SuspectTime:$latestUpdateTime:$MSTime
    suspectTimeDiff=$(expr $SuspectTime - $lastSuspectTime)
    if [ $suspectTimeDiff -lt 0 ]; then
        if [[ $latestUpdateTime -gt $SuspectTime ]]; then
            echo "=====> ALIVE <====="
        else
            echo "=====> Considering host as DEAD due to file [RBD pool] exist, condition [suspectTimeDiff -lt 0] was satisfied and [latestUpdateTime -gt SuspectTime] has not been satisfied. <======"
        fi
    else
        if [[ $latestUpdateTime -gt $lastUpdateTime ]]; then
            echo "=====> ALIVE <====="
        else
            echo "=====> Considering host as DEAD due to file [RBD pool] exist and conditions [suspectTimeDiff -lt 0] and [latestUpdateTime -gt SuspectTime] have not been satisfied. <======"
        fi
    fi
fi

exit 0