#!/usr/bin/bash

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

set -eo pipefail

# CloudStack B&R NAS Backup and Recovery Tool for KVM

# TODO: do libvirt/logging etc checks

### Declare variables ###

OP=""
VM=""
NAS_TYPE=""
NAS_ADDRESS=""
MOUNT_OPTS=""
BACKUP_DIR=""
BACKUP_TYPE=""
CHECKPOINT_NAME=""
PARENT_BACKUP_DIR=""
PARENT_CHECKPOINT_NAME=""
PARENT_CHECKPOINT_PATH=""
BACKUP_FILES=""
DISK_PATHS=""
QUIESCE=""
FORCED="false"
logFile="/var/log/cloudstack/agent/agent.log"

EXIT_CLEANUP_FAILED=20

log() {
  [[ "$verb" -eq 1 ]] && builtin echo "$@"
  if [[ "$1" == "-ne"  || "$1" == "-e" || "$1" == "-n" ]]; then
    builtin echo -e "$(date '+%Y-%m-%d %H-%M-%S>')" "${@: 2}" >> "$logFile"
  else
    builtin echo "$(date '+%Y-%m-%d %H-%M-%S>')" "$@" >> "$logFile"
  fi
}

vercomp() {
  local IFS=.
  local i ver1=($1) ver2=($3)

  # Compare each segment of the version numbers
  for ((i=0; i<${#ver1[@]}; i++)); do
      if [[ -z ${ver2[i]} ]]; then
          ver2[i]=0
      fi

      if ((10#${ver1[i]} > 10#${ver2[i]})); then
          return  0 # Version 1 is greater
      elif ((10#${ver1[i]} < 10#${ver2[i]})); then
          return 2  # Version 2 is greater
      fi
  done
  return 0  # Versions are equal
}

sanity_checks() {
  hvVersion=$(virsh version | grep hypervisor | awk '{print $(NF)}')
  libvVersion=$(virsh version | grep libvirt | awk '{print $(NF)}' | tail -n 1)
  apiVersion=$(virsh version | grep API | awk '{print $(NF)}')

  vercomp "$hvVersion" ">=" "4.2.0"
  hvStatus=$?
  vercomp "$libvVersion" ">=" "7.2.0"
  libvStatus=$?

  if [[ $hvStatus -eq 0 && $libvStatus -eq 0 ]]; then
    log -ne "Success... [ QEMU: $hvVersion Libvirt: $libvVersion apiVersion: $apiVersion ]"
  else
    echo "Failure... Your QEMU version $hvVersion or libvirt version $libvVersion is unsupported. Consider upgrading to the required minimum version of QEMU: 4.2.0 and Libvirt: 7.2.0"
    exit 1
  fi
}

### Operation methods ###

backup_running_vm() {
  mount_operation
  mkdir -p "$dest" || { echo "Failed to create backup directory $dest"; exit 1; }
  mkdir -p "$dest/checkpoints" || { echo "Failed to create checkpoint directory $dest/checkpoints"; exit 1; }

  local parent_checkpoint_file=""
  if [[ "$BACKUP_TYPE" == "INCREMENTAL" && -n "$PARENT_CHECKPOINT_PATH" ]]; then
    parent_checkpoint_file="$mount_point/$PARENT_CHECKPOINT_PATH"
    redefine_checkpoint_if_needed "$VM" "$parent_checkpoint_file"
  fi

  echo "<domainbackup mode='push'>" > "$dest/backup.xml"
  if [[ "$BACKUP_TYPE" == "INCREMENTAL" && -n "$PARENT_CHECKPOINT_NAME" ]]; then
    echo "<incremental>$PARENT_CHECKPOINT_NAME</incremental>" >> "$dest/backup.xml"
  fi
  echo "<disks>" >> "$dest/backup.xml"
  echo "<domaincheckpoint><name>$CHECKPOINT_NAME</name><disks>" > "$dest/checkpoint.xml"
  local index=0
  while IFS='|' read -r disk target; do
    [[ -z "$disk" ]] && continue
    local backup_file
    backup_file=$(get_backup_file_by_index "$index" "$(basename "$target").qcow2")
    echo "<disk name='$disk' backup='yes' type='file'><target file='$dest/$backup_file' /><driver type='qcow2'/></disk>" >> "$dest/backup.xml"
    echo "<disk name='$disk' checkpoint='bitmap'/>" >> "$dest/checkpoint.xml"
    index=$((index + 1))
  done < <(virsh -c qemu:///system domblklist "$VM" --details 2>/dev/null | awk '/disk/ {print $3 "|" $4}')
  echo "</disks></domainbackup>" >> "$dest/backup.xml"
  echo "</disks></domaincheckpoint>" >> "$dest/checkpoint.xml"

  local thaw=0
  if [[ ${QUIESCE} == "true" ]]; then
    if virsh -c qemu:///system qemu-agent-command "$VM" '{"execute":"guest-fsfreeze-freeze"}' > /dev/null 2>/dev/null; then
      thaw=1
    fi
  fi

  # Start push backup
  local backup_begin=0
  if virsh -c qemu:///system backup-begin --domain "$VM" --backupxml "$dest/backup.xml" --checkpointxml "$dest/checkpoint.xml" 2>&1 > /dev/null; then
    backup_begin=1;
  fi

  if [[ $thaw -eq 1 ]]; then
    if ! response=$(virsh -c qemu:///system qemu-agent-command "$VM" '{"execute":"guest-fsfreeze-thaw"}' 2>&1 > /dev/null); then
      echo "Failed to thaw the filesystem for vm $VM: $response"
      cleanup
      exit 1
    fi
  fi

  if [[ $backup_begin -ne 1 ]]; then
    cleanup
    exit 1
  fi

  backup_domain_information "$VM"

  while true; do
    status=$(virsh -c qemu:///system domjobinfo "$VM" --completed --keep-completed | awk '/Job type:/ {print $3}')
    case "$status" in
      Completed)
        break ;;
      Failed)
        echo "Virsh backup job failed"
        cleanup ;;
    esac
    sleep 5
  done

  if [[ "$BACKUP_TYPE" == "INCREMENTAL" && -n "$PARENT_BACKUP_DIR" ]]; then
    local index=0
    while IFS='|' read -r disk target; do
      [[ -z "$disk" ]] && continue
      local backup_file
      backup_file=$(get_backup_file_by_index "$index" "$(basename "$target").qcow2")
      output="$dest/$backup_file"
      parent="../$(basename "$PARENT_BACKUP_DIR")/$backup_file"
      if ! qemu-img rebase -u -F qcow2 -b "$parent" "$output" > "$logFile" 2> >(cat >&2); then
        echo "qemu-img rebase failed for $output with parent $parent"
        cleanup
      fi
      index=$((index + 1))
    done < <(virsh -c qemu:///system domblklist "$VM" --details 2>/dev/null | awk '/disk/ {print $3 "|" $4}')
  fi

  dump_checkpoint_xml "$VM"
  rm -f "$dest/backup.xml"
  rm -f "$dest/checkpoint.xml"
  sync

  # Print statistics
  virsh -c qemu:///system domjobinfo "$VM" --completed
  du -sb "$dest" | cut -f1

  umount "$mount_point"
  rmdir "$mount_point"
}

backup_rbd_volumes() {
  log -ne "Entered backup_rbd_volumes with DISK_PATHS=[$DISK_PATHS], BACKUP_FILES=[$BACKUP_FILES], BACKUP_DIR=[$BACKUP_DIR]"
  mount_operation
  mkdir -p "$dest" || { echo "Failed to create backup directory $dest"; exit 1; }

  backup_domain_information "$VM"

  local index=0
  while IFS= read -r disk; do
    local created_snapshot=""
    log -ne "Loop disk raw value=[$disk]"
    [[ -z "$disk" ]] && continue

    parse_rbd_uri "$disk"
    log -ne "Parsed disk [$disk] -> RBD_IMAGE=[$RBD_IMAGE], MON=[$RBD_MON_HOST], USER=[$RBD_USER]"

    if [[ -z "$RBD_IMAGE" ]]; then
      echo "Unable to parse RBD disk path: $disk"
      cleanup
    fi

    build_rbd_cmd
    log -ne "Built RBD command: ${RBD_CMD[*]}"

    local backup_file
    backup_file=$(get_backup_file_by_index "$index" "${RBD_IMAGE##*/}.raw")
    local output="$dest/$backup_file"
    local current_snapshot="${CHECKPOINT_NAME}"

    log -ne "Resolved backup file [$backup_file], destination [$output]"
    log -ne "Starting RBD backup for disk path [$disk], resolved image [$RBD_IMAGE], output [$output]"

    if ! timeout 30s "${RBD_CMD[@]}" info "$RBD_IMAGE" >> "$logFile" 2>&1; then
      echo "Failed to access RBD image $RBD_IMAGE"
      cleanup
    fi

    if [[ "$BACKUP_TYPE" == "INCREMENTAL" && -n "$PARENT_CHECKPOINT_NAME" ]]; then
      if ! timeout 30s "${RBD_CMD[@]}" snap ls "$RBD_IMAGE" 2>>"$logFile" | awk 'NR>1 {print $2}' | grep -Fxq "$PARENT_CHECKPOINT_NAME"; then
        echo "Parent RBD snapshot ${RBD_IMAGE}@${PARENT_CHECKPOINT_NAME} not found for incremental backup"
        cleanup
      fi
    fi

    if ! timeout 30s "${RBD_CMD[@]}" snap create "${RBD_IMAGE}@${current_snapshot}" >> "$logFile" 2>&1; then
      echo "Failed to create RBD snapshot ${RBD_IMAGE}@${current_snapshot}"
      cleanup
    fi
    created_snapshot="${RBD_IMAGE}@${current_snapshot}"

    if [[ "$BACKUP_TYPE" == "INCREMENTAL" && -n "$PARENT_CHECKPOINT_NAME" ]]; then
      if ! timeout 6h "${RBD_CMD[@]}" export-diff --from-snap "$PARENT_CHECKPOINT_NAME" "${RBD_IMAGE}@${current_snapshot}" "$output" >> "$logFile" 2>&1; then
        echo "Failed to export incremental RBD diff for ${RBD_IMAGE}@${current_snapshot}"
        [[ -n "$created_snapshot" ]] && "${RBD_CMD[@]}" snap rm "$created_snapshot" >> "$logFile" 2>&1 || true
        cleanup
      fi
    else
      if ! timeout 6h "${RBD_CMD[@]}" export "${RBD_IMAGE}@${current_snapshot}" "$output" >> "$logFile" 2>&1; then
        echo "Failed to export full RBD snapshot ${RBD_IMAGE}@${current_snapshot}"
        [[ -n "$created_snapshot" ]] && "${RBD_CMD[@]}" snap rm "$created_snapshot" >> "$logFile" 2>&1 || true
        cleanup
      fi
    fi

    log -ne "Finished exporting backup file [$output] size=[$(stat -c %s "$output" 2>/dev/null)]"
    stat -c %s "$output"
    index=$((index + 1))
  done < <(split_csv "$DISK_PATHS")

  write_rbd_backup_metadata "$BACKUP_TYPE" "$CHECKPOINT_NAME" "$PARENT_CHECKPOINT_NAME"

  sync
  log -ne "RBD backup completed checkpoint=[$CHECKPOINT_NAME] parent=[$PARENT_CHECKPOINT_NAME]"
  umount "$mount_point"
  rmdir "$mount_point"
}

backup_domain_information() {
  local vm_name="$1"

  [[ -z "$vm_name" ]] && return 0

  mkdir -p "$dest/checkpoints" || {
    echo "Failed to create checkpoint directory $dest/checkpoints"
    exit 1
  }

  if virsh -c qemu:///system dominfo "$vm_name" > /dev/null 2>&1; then
    virsh -c qemu:///system dumpxml "$vm_name" > "$dest/domain-config.xml" 2>/dev/null || true
    virsh -c qemu:///system dominfo "$vm_name" > "$dest/dominfo.xml" 2>/dev/null || true
    virsh -c qemu:///system domiflist "$vm_name" > "$dest/domiflist.xml" 2>/dev/null || true
    virsh -c qemu:///system domblklist "$vm_name" > "$dest/domblklist.xml" 2>/dev/null || true

    if [[ -n "$CHECKPOINT_NAME" ]]; then
      cat > "$dest/checkpoints/$CHECKPOINT_NAME.meta" <<EOF
checkpoint_name=$CHECKPOINT_NAME
backup_type=$BACKUP_TYPE
vm_name=$vm_name
disk_paths=$DISK_PATHS
backup_files=$BACKUP_FILES
EOF
    fi

    log -ne "Backed up domain information for VM [$vm_name]"
  else
    log -ne "VM [$vm_name] not found in libvirt; skipped domain metadata backup"
  fi
}

has_child_backup() {
  local checkpoint_name="$1"

  [[ -z "$checkpoint_name" ]] && return 1

  grep -R -q "^parent_checkpoint_name=$checkpoint_name$" "$mount_point"/*/rbd-backup.meta 2>/dev/null
}

delete_rbd_snapshot_if_unreferenced() {
  local disk_paths="$1"
  local checkpoint_name="$2"

  [[ -z "$checkpoint_name" ]] && return 0

  if has_child_backup "$checkpoint_name"; then
    log -ne "Skip snapshot delete [$checkpoint_name] (child exists)"
    return 0
  fi

  while IFS= read -r disk; do
    [[ -z "$disk" ]] && continue
    parse_rbd_uri "$disk"
    build_rbd_cmd

    if [[ -n "$RBD_IMAGE" ]]; then
      log -ne "Deleting snapshot [${RBD_IMAGE}@${checkpoint_name}]"
      "${RBD_CMD[@]}" snap rm "${RBD_IMAGE}@${checkpoint_name}" >> "$logFile" 2>&1 || true
    fi
  done < <(split_csv "$disk_paths")
}

delete_backup() {
  mount_operation

  if [[ -f "$dest/rbd-backup.meta" ]]; then
    source "$dest/rbd-backup.meta"

    log -ne "Deleting backup with metadata [$dest]"

    if [[ "$FORCED" != "true" ]] && has_child_backup "$checkpoint_name"; then
      echo "Cannot delete backup [$backup_dir]: child backup exists"
      umount "$mount_point"
      rmdir "$mount_point"
      exit 1
    fi

    delete_rbd_snapshot_if_unreferenced "$disk_paths" "$checkpoint_name"
  elif [[ -n "$CHECKPOINT_NAME" && -n "$DISK_PATHS" ]]; then
    log -ne "Deleting backup using command metadata [$dest]"
    delete_rbd_snapshot_if_unreferenced "$DISK_PATHS" "$CHECKPOINT_NAME"
  fi

  rm -frv $dest
  sync
  umount $mount_point
  rmdir $mount_point
}

get_backup_stats() {
  mount_operation

  echo $mount_point
  df -P $mount_point 2>/dev/null | awk 'NR==2 {print $2, $3}'
  umount $mount_point
  rmdir $mount_point
}

mount_operation() {
  mount_point=$(mktemp -d -t csbackup.XXXXX)
  dest="$mount_point/${BACKUP_DIR}"
  if [ ${NAS_TYPE} == "cifs" ]; then
    MOUNT_OPTS="${MOUNT_OPTS},nobrl"
  fi
  mount -t ${NAS_TYPE} ${NAS_ADDRESS} ${mount_point} $([[ ! -z "${MOUNT_OPTS}" ]] && echo -o ${MOUNT_OPTS}) 2>&1 | tee -a "$logFile"
  if [ $? -eq 0 ]; then
      log -ne "Successfully mounted ${NAS_TYPE} store"
  else
      echo "Failed to mount ${NAS_TYPE} store"
      exit 1
  fi
}

cleanup() {
  local status=0

  rm -rf "$dest" || { echo "Failed to delete $dest"; status=1; }
  umount "$mount_point" || { echo "Failed to unmount $mount_point"; status=1; }
  rmdir "$mount_point" || { echo "Failed to remove mount point $mount_point"; status=1; }

  if [[ $status -ne 0 ]]; then
    echo "Backup cleanup failed"
    exit $EXIT_CLEANUP_FAILED
  fi
}

split_csv() {
  tr ',' '\n' <<< "$1"
}

is_rbd_disk_path() {
  local disk_path="$1"
  [[ "$disk_path" == rbd:* || "$disk_path" == rbd/* ]]
}

get_backup_file_by_index() {
  local index="$1"
  local fallback="$2"
  if [[ -z "$BACKUP_FILES" ]]; then
    echo "$fallback"
    return
  fi
  local current=0
  while IFS= read -r value; do
    if [[ "$current" -eq "$index" ]]; then
      echo "$value"
      return
    fi
    current=$((current + 1))
  done < <(split_csv "$BACKUP_FILES")
  echo "$fallback"
}

dump_checkpoint_xml() {
  local vm_name="$1"
  if [[ -n "$CHECKPOINT_NAME" ]]; then
    virsh -c qemu:///system checkpoint-dumpxml --domain "$vm_name" --checkpointname "$CHECKPOINT_NAME" --no-domain > "$dest/checkpoints/$CHECKPOINT_NAME.xml" 2>/dev/null || true
  fi
}

redefine_checkpoint_if_needed() {
  local vm_name="$1"
  local checkpoint_file="$2"
  if [[ -z "$PARENT_CHECKPOINT_NAME" || -z "$checkpoint_file" || ! -f "$checkpoint_file" ]]; then
    return
  fi
  if virsh -c qemu:///system checkpoint-info --domain "$vm_name" --checkpointname "$PARENT_CHECKPOINT_NAME" > /dev/null 2>&1; then
    return
  fi
  if ! virsh -c qemu:///system checkpoint-create --domain "$vm_name" --xmlfile "$checkpoint_file" --redefine > /dev/null 2>&1; then
    echo "Failed to redefine checkpoint $PARENT_CHECKPOINT_NAME on domain $vm_name"
    cleanup
  fi
}

parse_rbd_uri() {
  local uri="$1"
  log -ne "parse_rbd_uri called with uri=[$uri]"

  RBD_IMAGE=""
  RBD_MON_HOST=""
  RBD_USER=""
  RBD_KEY=""

  if [[ "$uri" == rbd:* ]]; then
    local payload="${uri#rbd:}"
    RBD_IMAGE="${payload%%:*}"

    if [[ "$uri" =~ :mon_host=([^:]*) ]]; then
      RBD_MON_HOST="${BASH_REMATCH[1]}"
      RBD_MON_HOST="${RBD_MON_HOST//\\;/,}"
      RBD_MON_HOST="${RBD_MON_HOST//\\:/:}"
    fi

    if [[ "$uri" =~ :id=([^:]*) ]]; then
      RBD_USER="${BASH_REMATCH[1]}"
    fi

    if [[ "$uri" =~ :key=([^:]*) ]]; then
      RBD_KEY="${BASH_REMATCH[1]}"
    fi
  elif [[ "$uri" == rbd/* ]]; then
    RBD_IMAGE="$uri"
  else
    echo "Invalid RBD disk path: $uri"
    cleanup
  fi

  if [[ -z "$RBD_IMAGE" ]]; then
    echo "Failed to parse RBD image from uri: $uri"
    cleanup
  fi

  log -ne "Parsed RBD uri -> IMAGE=[$RBD_IMAGE], MON=[$RBD_MON_HOST], USER=[$RBD_USER]"
}

build_rbd_cmd() {
  RBD_CMD=(rbd)
  if [[ -n "$RBD_MON_HOST" ]]; then
    RBD_CMD+=(-m "$RBD_MON_HOST")
  fi
  if [[ -n "$RBD_USER" ]]; then
    RBD_CMD+=(--id "$RBD_USER")
  fi
  if [[ -n "$RBD_KEY" ]]; then
    RBD_CMD+=(--key "$RBD_KEY")
  fi
}

write_rbd_backup_metadata() {
  local backup_type="$1"
  local checkpoint_name="$2"
  local parent_checkpoint_name="$3"

  cat > "$dest/rbd-backup.meta" <<EOF
vm_name=$VM
backup_type=$backup_type
checkpoint_name=$checkpoint_name
parent_checkpoint_name=$parent_checkpoint_name
disk_paths=$DISK_PATHS
backup_files=$BACKUP_FILES
backup_dir=$BACKUP_DIR
EOF

  log -ne "Wrote RBD backup metadata to [$dest/rbd-backup.meta]"
}

function usage {
  echo ""
  echo "Usage: $0 -o <operation> -v|--vm <domain name> -t <storage type> -s <storage address> -m <mount options> -p <backup path> -b <FULL|INCREMENTAL> -c <checkpoint name> -r <parent backup path> -i <parent checkpoint name> -j <parent checkpoint path> -f <backup files> -d <disks path> -q|--quiesce <true|false> -x|--forced <true|false>"
  echo ""
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    -o|--operation)
      OP="$2"
      shift
      shift
      ;;
    -v|--vm)
      VM="$2"
      shift
      shift
      ;;
    -t|--type)
      NAS_TYPE="$2"
      shift
      shift
      ;;
    -s|--storage)
      NAS_ADDRESS="$2"
      shift
      shift
      ;;
    -m|--mount)
      MOUNT_OPTS="$2"
      shift
      shift
      ;;
    -p|--path)
      BACKUP_DIR="$2"
      shift
      shift
      ;;
    -b|--backuptype)
      BACKUP_TYPE="$2"
      shift
      shift
      ;;
    -c|--checkpoint)
      CHECKPOINT_NAME="$2"
      shift
      shift
      ;;
    -r|--parentpath)
      PARENT_BACKUP_DIR="$2"
      shift
      shift
      ;;
    -i|--parentcheckpoint)
      PARENT_CHECKPOINT_NAME="$2"
      shift
      shift
      ;;
    -j|--parentcheckpointpath)
      PARENT_CHECKPOINT_PATH="$2"
      shift
      shift
      ;;
    -f|--backupfiles)
      BACKUP_FILES="$2"
      shift
      shift
      ;;
    -q|--quiesce)
      QUIESCE="$2"
      shift
      shift
      ;;
    -x|--forced)
      FORCED="$2"
      shift
      shift
      ;;
    -d|--diskpaths)
      DISK_PATHS="$2"
      shift
      shift
      ;;
    -h|--help)
      usage
      shift
      ;;
    *)
      echo "Invalid option: $1"
      usage
      ;;
  esac
done

# Perform Initial sanity checks
sanity_checks

log -ne "nasbackup.sh start op=[$OP] vm=[$VM] backupDir=[$BACKUP_DIR] backupType=[$BACKUP_TYPE] checkpoint=[$CHECKPOINT_NAME] parentBackup=[$PARENT_BACKUP_DIR] parentCheckpoint=[$PARENT_CHECKPOINT_NAME] diskPaths=[$DISK_PATHS] backupFiles=[$BACKUP_FILES]"

if [ "$OP" = "backup-running" ]; then
  backup_running_vm
elif [ "$OP" = "backup-rbd" ]; then
  backup_rbd_volumes
elif [ "$OP" = "delete" ]; then
  delete_backup
elif [ "$OP" = "stats" ]; then
  get_backup_stats
fi
