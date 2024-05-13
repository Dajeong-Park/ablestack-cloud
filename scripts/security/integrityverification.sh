#!/bin/bash

# mold 서비스 재시작 시 파일 경로의 해시값을 다시 출력하여 DB에 업데이트

DATABASE_PASSWD=$1

# 주요 파일 초기 해시 값 추출
paths=(
  "/etc/cloudstack/management/config.json"
  "/etc/cloudstack/management/log4j-cloud.xml"
  "/etc/cloudstack/usage/log4j-cloud.xml"
  "/usr/lib/systemd/system/cloudstack-management.service"
  "/usr/lib/systemd/system/cloudstack-usage.service"
  "/usr/lib/systemd/system/mold-monitoring.service"
)
for path in "${paths[@]}"; do
    for file in $(find "$path" -type f); do
        hash_value=$(sha512sum "$file" | awk '{print $1}')
        mysql --user=root --password=$DATABASE_PASSWD -e "use cloud; INSERT INTO integrity_verification_initial_hash (mshost_id, file_path, initial_hash_value, verification_date) VALUES ('1','$file', '$hash_value', DATE_SUB(NOW(), INTERVAL 9 HOUR))" > /dev/null 2>&1
    done
done
# 주요 폴더 하위 파일 초기 해시 값 추출
directories=(
  "/usr/share/cloudstack-usage/"
  "/usr/share/cloudstack-common/"
  "/usr/share/cloudstack-management/"
)
declare -a file_extensions=("jar" "sh" "py")
declare -a file_paths
for directory in "${directories[@]}"; do
    for file_extension in "${file_extensions[@]}"; do
        for files in $(find "$directory" -type f -name "*.$file_extension"); do
            file_paths+=("$files")
        done
    done
done
for file_path in "${file_paths[@]}"; do
    for files in $(find "$file_path" -type f); do
        hash_value=$(sha512sum "$files" | awk '{print $1}')
        mysql --user=root --password=$DATABASE_PASSWD -e "use cloud; INSERT INTO integrity_verification_initial_hash (mshost_id, file_path, initial_hash_value, verification_date) VALUES ('1','$files', '$hash_value', DATE_SUB(NOW(), INTERVAL 9 HOUR))" > /dev/null 2>&1
    done
done