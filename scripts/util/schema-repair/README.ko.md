<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.
-->

# MOLD SQL 재실행 도구

실행 시점의 SQL을 파일 버전 순서·문장 순서로 처리하고, 완료 이력으로 중복 적용을 막습니다.
패키지 빌드 시 원본 SQL과 `procedures/`를 도구의 `sql/` 폴더에 포함합니다.
새 SQL을 배포하면 쉘을 다시 생성하지 않고 읽을 수 있습니다.

필요 환경: Bash, Python 3.8 이상, MySQL 8.0, `mysql`·`mysqldump`, InnoDB 테이블.

## 1. 대상과 실행 계획 확인

```bash
# SQL 파일 목록·순서 확인 (DB 접속 없음)
bash /usr/share/cloudstack-common/scripts/util/schema-repair/mold-schema-repair.sh --list

# 미처리 문장 확인 (DB 변경 없음)
bash /usr/share/cloudstack-common/scripts/util/schema-repair/mold-schema-repair.sh --plan
```

MySQL root 비밀번호는 실행 중 입력합니다.
`PENDING`은 완료 이력이 없다는 뜻이며, DB에 반드시 누락됐다는 뜻은 아닙니다.

## 2. 서비스 정지

모든 관리 노드에서 해당 MOLD·Usage 서비스를 정지합니다.

```bash
systemctl stop mold mold-usage
```

서비스명이 `cloudstack-management`·`cloudstack-usage`인 환경은 해당 이름을 사용합니다.

## 3. 적용

CCVM 한 곳에서 실행합니다. 미처리 작업이 있으면 `cloud`·`cloud_usage` 전체 백업 후 반영합니다.

```bash
bash /usr/share/cloudstack-common/scripts/util/schema-repair/mold-schema-repair.sh --apply
```

결과는 root 실행 기준 `/root/mold-schema-replay-*`에 저장합니다.
`summary.json`·`actions.jsonl`에서 오류를 확인하고, 확인을 마친 뒤 정지했던 서비스를 시작합니다.

```bash
systemctl start mold
systemctl start mold-usage
```

백업 파일은 같은 폴더의 `backup.sql.gz`입니다. 재시작 후 UI/API 정상 동작을 확인합니다.

## 처리 기준

- INSERT는 업무 키로 중복을 확인합니다. 키는 `insert-keys.json`에서 관리합니다.
- 프로시저는 기존 애플리케이션 계정의 소유자를 유지합니다. 새 소유자를 판단할 수 없으면 `--routine-definer user@host`로 명시합니다.
- **원본 UPDATE·DELETE·DROP은 실제 변경·삭제를 수행합니다.** 최초 실행에서는 과거 적용 여부를 확정할 수 없습니다.
- 완료된 내용은 건너뛰고 새로운 SQL 내용을 처리합니다. 이전 작업의 효과를 자동으로 되돌리지는 않습니다.
- 실패하면 중단합니다. DML은 이력과 함께 롤백하지만, 자동 커밋된 DDL은 남으므로 원인 확인 후 재실행합니다.
- 미지원 구문이나 중복을 판별할 수 없는 INSERT는 오류로 중단합니다.
- 기본 대상은 시작 버전 `41810` 이상인 `schema-숫자to숫자.sql`입니다. cleanup·Java·뷰 후처리는 별도입니다.

다른 원본 폴더는 `--sql-dir 경로`로 지정합니다. 수동 배포 시 SQL을 포함한 도구 폴더 전체를 복사합니다.
종료 코드: `0` 완료, `2` 조회 모드에서 미처리 문장 있음, `1` 오류. 추가 옵션은 `--help`로 확인합니다.
