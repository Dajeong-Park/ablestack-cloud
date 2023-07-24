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

# Integrity Verification
# Management Server의 주요 파일의 무결성을 검증하는 스크립트
# 항목 :
#/etc/cloudstack/management/config.json
#/etc/cloudstack/management/db.properties
#/etc/cloudstack/management/environment.properties
#/etc/cloudstack/management/java.security.ciphers
#/etc/cloudstack/management/log4j-cloud.xml
#/etc/cloudstack/management/server.properties
#/etc/cloudstack/management/key
#/etc/cloudstack/usage/log4j-cloud.xml
#/etc/cloudstack/ui/config.json
# return : 파일 경로, 결과(boolean)

# MySQL database configuration
DB_USER="root"
DB_PASSWORD="Ablecloud1!"
DB_NAME="cloud"
TABLE_NAME="integrity_verify_initial_hash"


paths=(
    "/Users/hongwookryu/repository/GitHub/stardom3645/ablestack-cloud/INSTALL.md"
    "/Users/hongwookryu/repository/GitHub/stardom3645/ablestack-cloud/ISSUE_TEMPLATE.md"
    "/Users/hongwookryu/repository/GitHub/stardom3645/ablestack-cloud/LICENSE"
)

calculate_hash() {
    file_path="$1"
    hash=$(sha512sum "$file_path" | awk '{print $1}')
    echo "$hash"
}

let con1=$(mysql -u"$DB_USER" -p"$DB_PASSWORD" -D"$DB_NAME" -e "SELECT COUNT(*) AS count FROM $TABLE_NAME" --batch --skip-column-names | awk '{print $1}')


## 초기 해시값 추출
if [ "$con1" = 0 ]; then
    for path in "${paths[@]}"; do
        for file in $(find "$path" -type f); do
            hash_value=$(calculate_hash "$file")
            mysql -u"$DB_USER" -p"$DB_PASSWORD" -D"$DB_NAME" -e "INSERT INTO $TABLE_NAME (file_path, initial_hash_value) VALUES ('$file', '$hash_value')"
        done
    done

## 자동, 수동 무결성 검사 위한 비교 해시값 추출 및 비교
elif [ "$con1" -gt 0 ];then
    for path in "${paths[@]}"; do
        for file in $(find "$path" -type f); do
            hash_value=$(calculate_hash "$file")
            result=$(mysql -u"$DB_USER" -p"$DB_PASSWORD" -D"$DB_NAME" -N -B -e "SELECT id FROM $TABLE_NAME WHERE file_path = '$file'")
            mysql -u"$DB_USER" -p"$DB_PASSWORD" -D"$DB_NAME" -e "UPDATE $TABLE_NAME SET comparison_hash_value = '$hash_value' WHERE id = '$result'"
            mysql -u"$DB_USER" -p"$DB_PASSWORD" -D"$DB_NAME" -e "UPDATE $TABLE_NAME SET verification_result = (CASE WHEN initial_hash_value = comparison_hash_value THEN 1 ELSE 0 END);"
        done
    done

## 에러 처리
else
    echo 'ERROR'
fi