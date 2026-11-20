<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# KM-01: KMS 회전 길이·메타데이터 원자성

상위 Epic #1727, 구현 과제 #1728. 기존 API 이름·인자·async 형태를 유지한다.

## 현재 길이의 의미

`KMSKeyResponse.keybits`와 `cloud.kms_keys.key_bits`는 현재 Active KEK의 비트 길이다.
DEK 길이 또는 최초 생성 길이가 아니다. 생성은 128/192/256(생략 256), 회전 생략은
현재 영속 길이를 사용한다. 회전은 기존 DEK를 바꾸거나 볼륨을 재포맷하는 작업이 아니다.

기존 구현은 요청 길이로 KEK를 생성하고 라벨/HSM만 갱신했다. 256→128 회전 후 응답이
256으로 남고 다음 길이 생략 회전도 잘못된 길이를 사용할 수 있었다.

## 구현 계약

1. 키의 기존 클러스터 잠금을 유지한다. 키 접근/활성 상태 및 대상 HSM의 접근·소유 범위·
   활성 상태를 검사한다. HSM 인자를 생략해도 현재 프로파일 검사를 우회하지 않는다.
2. 길이는 provider 호출 전에 128/192/256으로 검증한다.
   이전 상태를 복구하기 위한 메타데이터 조회도 provider 생성 전에 수행한다.
3. 기존 트랜잭션에서 이전 버전의 Previous 전환, 새 Active 버전,
   `kms_keys.kek_label`·`hsm_profile_id`·`key_bits`를 함께 갱신한다.
4. 이전 버전/키 DAO update=false, 새 버전 persist=null도 실패다.
   checked KMS 예외 외 런타임 DB 예외도 보상 정리를 수행한다.
5. 트랜잭션 실패 시 DB rollback과 함께 호출자가 가진 VO의 이전 값/상태도 복원한다.
   provider가 반환한 새 KEK ID를 이용해 고아 KEK 삭제를 시도한다.
   삭제 실패는 경고 이벤트로 남기고 원래 회전 실패를 성공으로 바꾸지 않는다.
6. 트랜잭션 성공 뒤의 로그 처리를 보상 삭제 범위에 넣지 않는다.
   이미 커밋한 Active KEK를 후속 로그 실패 때문에 삭제하지 않는다.
7. list/create/update 응답은 같은 영속 메타데이터를 사용한다.
   과거 버전의 HSM 참조·복호화·background rewrap 계약은 유지한다.

새 table/column/API 필드는 추가하지 않는다. 변경 대상 DB 열은 기존
`cloud.kms_keys.key_bits`이며, 새 회전의 기존 트랜잭션 안에서 값을 갱신한다.
신규 DDL 또는 기존 완료 migration의 재실행은 없다.

## 과거 불일치의 조회·보정·복구

이번 수정이 이미 잘못 기록된 모든 과거 키를 자동 복구하는 것은 아니다.
13번의 적용 전 활성 KMS 키는 0개였으므로 기존 운영 키에 대한 보정 DML은 실행하지 않았다.

### 비밀 없는 사전 조회

운영자가 승인한 자원 UUID를 지정하고 현재 Active 버전이 정확히 하나인지 먼저 확인한다.
다음 조회에는 KEK/DEK 원문·암호화 blob·PIN을 포함하지 않는다.

```sql
SET @key_uuid = '<확인할 키 UUID>';
SELECT k.id, k.uuid, k.key_bits, k.kek_label, k.hsm_profile_id,
       v.id AS active_version_id, v.version_number,
       v.kek_label AS active_label, v.hsm_profile_id AS active_profile_id,
       p.protocol, d.key_bits AS database_provider_bits
FROM cloud.kms_keys k
LEFT JOIN cloud.kms_kek_versions v
       ON v.kms_key_id = k.id AND v.status = 'Active' AND v.removed IS NULL
LEFT JOIN cloud.kms_hsm_profiles p ON p.id = v.hsm_profile_id
LEFT JOIN cloud.kms_database_kek_objects d
       ON d.label = v.kek_label AND d.removed IS NULL
WHERE k.uuid = @key_uuid AND k.removed IS NULL;
```

- Database는 해당 Active 라벨의 provider metadata와 대조한다. Active 버전 중복/부재,
  라벨·프로파일 불일치 또는 provider metadata 누락이면 보정을 중단한다.
- PKCS#11은 운영자의 기존 인증 경로로 해당 Active KEK의 CKA_VALUE_LEN 등
  비밀을 추출하지 않는 길이 속성을 확인한다. bytes 단위는 bits로 환산한다.
  속성 읽기가 거부되거나 backend를 확인할 수 없으면 미확정으로 보고한다.
- 최초 기본값, 라벨 문자열, wrapped blob 길이, 최근 이벤트의 요청만으로 길이를 추정하지 않는다.
  확인을 위해 키를 재생성·강제 회전하거나 평문 키를 내보내지 않는다.

### 보정 및 복원 순서

1. 승인된 정비 범위에서 해당 키를 사용하는 모든 관리 서버의 키 생성·회전·rewrap와
   관련 Usage 작업을 정지한다. 단일 SQL row lock만으로 클러스터 키 작업을 대체하지 않는다.
2. UUID/ID/기존 key_bits/라벨/HSM/Active 버전 ID와 확인한 provider 길이를 보호된
   메타데이터 백업에 기록한다. 인증정보나 키 blob은 보고서에 기록하지 않는다.
3. DB transaction과 해당 키 row lock을 획득한 후 같은 Active 버전·라벨·프로파일인지
   다시 확인한다. 확인한 128/192/256 중 하나로 **key_bits 열만** 조건부 갱신한다.
   UUID뿐 아니라 백업한 기존 값과 Active 버전 ID를 조건에 넣어 오래된 관측의 덮어쓰기를 막는다.
4. 변경 수가 예상과 다르거나 provider 확인이 불완전하면 rollback한다.
   변경 후 라벨/프로파일/버전/참조/키 material을 바꾸지 않았는지 확인하고 commit한다.
5. 실패 시 같은 정비 범위·조건부 갱신으로 백업한 key_bits만 복원한다.
   변경 이후 새 회전이 발생했다면 과거 메타데이터를 덮지 않고 재조회한다.
6. 서비스를 재개한 뒤 UI/API와 provider metadata, 필요한 기존 볼륨 접근을 대조한다.
   실제 HSM·게스트 I/O/체크섬 인수는 기존 #1025와 연결한다.

이 절차는 조회·백업·확정된 메타데이터 보정을 위한 운영 절차이며 자동 migration이 아니다.
미확정 키는 원인/영향/추가 확인 필요 사항을 남기고 그대로 보존한다.

## 빌드·배포·검증 경계

2026-11-20 사용자 확정 [빌드 정책](../../developer/build-release-policy.ko.md)에 따라
비릴리즈 개발 검증은 WSL ext4의 집중 테스트·클래스 빌드를 사용한다.
정식/릴리즈 후보 빌드는 여전히 GitHub Actions가 필수다.

13번에는 기존 통합 관리 서버 JAR를 백업하고 지정 KMS 클래스만 반영한다.
기존 다른 JAR 항목의 hash, 실행 Java와 기존 KMSKeyVO setter 호환성을 확인한다.
host agent/전체 Cloud/UI/SystemVM은 이 과제의 배포 대상이 아니다.

집중 회귀는 provider 호출 길이/응답, 연속·생략 회전, 접근/범위/활성 상태,
잠금 경합 거부, provider 실패, DAO false/null/런타임 실패와 보상 정리를 검증한다.
실제 UI와 비밀 없는 DB 관측은 [검증 보고](../validation/key-management-1728-20261120/README.ko.md)에 기록한다.
UI 입력 보존·후보 안내·위험 작업 스타일 등 후속 과제의 범위는 이 수정에 섞지 않는다.
