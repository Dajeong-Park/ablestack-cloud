<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this work
for additional information regarding copyright ownership. The ASF licenses this
file to you under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy at
http://www.apache.org/licenses/LICENSE-2.0 . Unless required by applicable law or
agreed to in writing, software distributed under the License is distributed on
an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
or implied. See the License for the specific language governing permissions and
limitations under the License. -->

# KM-02 볼륨 전환 후보 및 결과 계약

Epic #1727 / 하위 #1729 / PR #1739. 기존 공개 키 목록의 삭제용 volumeids 번역은 변경하지 않는다.

## 후보 조회

listVolumes의 kmsmigrationkeyid는 전환할 대상 키이며 기존 kmskeyid(현재 연결 키)와 구분한다.
kmsmigrationeligible은 대상 키가 있을 때만 true/false를 받을 수 있다. 생략하면 범위 내 전체에
kmsmigrationeligible과 kmsmigrationreason을 주석으로 제공한다. 신규 인자를 생략한 기존 요청에는
새 필드를 직렬화하지 않는다.

관리자 여부, 현재 사용자와 제한된 API 키의 migrateVolumesToKMS 권한, 대상 키 ACL·활성 상태·존·용도와 HSM 활성 상태,
Active KEK 존재를 확인한다. 키의 account_id는 프로젝트의 경우 프로젝트 전용 계정이다.
일반 listVolumes ACL에 소유 계정과 존 제한을 추가하므로 다른 소유자 자원은 반환하지 않는다.

대상 계정·존의 Ready 볼륨 중 encrypt_format이 있고 kms_key_id/kms_wrapped_key_id가 없으며,
passphrase_id가 실제 passphrase 행에 연결되는 볼륨 ID를 DB INNER JOIN으로 조회한다.
그 ID 집합의 IN/NIN을 원래 listVolumes 검색에 결합한 후 검색·count·pagination을 적용한다.
화면에서 페이지를 받아 필터링하는 방식은 사용하지 않는다. 기존 테이블을 읽으며 DDL/view 변경은 없다.
현재 구현은 범위 내 적격 ID 집합을 메모리에 보관한다. 매우 큰 단일 소유자 범위의 성능 측정은 후속 대상이며,
전역 볼륨이나 비밀 문자열을 수집하지 않는다.

판정은 ELIGIBLE_LEGACY, ALREADY_KMS, NOT_ENCRYPTED, LEGACY_KEY_UNAVAILABLE,
UNSUPPORTED_STATE이며 실행 중 소실·범위 변경은 NOT_FOUND/SCOPE_MISMATCH로 차단한다.
Ready만 지원해 resize/snapshot/copy 및 아직 할당되지 않은 볼륨과 겹치지 않게 한다.

## 실행

키별 GlobalLock, 볼륨 행별 transaction/lock, ACL·소유자·존·최신 상태 검사를 적용한다.
사전 검증에서 없는 UUID, 암호화되지 않은 볼륨, 다른 KMS 키, 실제 legacy 참조가 없는 볼륨을 거부한다.
같은 대상 키와 wrapped 참조가 이미 있는 경우에만 멱등 skip으로 처리한다.
DEK 값과 실제 디스크 데이터는 변경하지 않고 기존 DEK를 wrap하여 두 KMS 참조를 같이 저장한다.
passphrase_id를 해제하지만 기존 passphrase 행은 삭제하지 않는다.

정상 응답은 기존 success=true를 유지하고 distinct requested / migrated / skipped 수를 추가한다.
부분 실패는 async 실패를 유지한다. 문자열에서 실패 수를 추측하거나 전체를 자동 재시도하지 않는다.

## 화면

가상머신의 공통 MoldDialog xl, 고정 footer, focus guard, 작은 표와 수평 스크롤을 재사용한다.
전환할 볼륨이라는 전용 라벨을 쓰며 UUID·이름·VM·크기·암호화·현재 키·상태·판정을 표시한다.
페이지 간 UUID 선택을 보존하되 실제 확인한 적격 행만 선택한다. 미조회 전체 페이지 선택은 없다.
대상 키의 UUID/계정/도메인/프로젝트/존/HSM 및 로그인/라우트 범위 변경 시 선택을 폐기한다.

실행 직전 키와 선택 UUID들을 서버에서 다시 조회해 하나라도 소실/불가/오류면 POST하지 않는다.
이전 서버의 스키마/판정 필드가 없거나 알 수 없는 판정이면 전환을 차단한다.
실행 후 성공·실패·응답 유실 모두 UUID별로 재조회해 대상 연결 확인 / 미전환 / 확인 불가를 표시한다.
작업 성공이면서 migrated=0인 경우 성공 색상을 사용하지 않는다. 재확인은 읽기만 수행한다.

## 검증 범위

WSL의 KMS 회귀와 UI 경계·지연·부분 실패·응답 유실 테스트 및 13번 실제 UI 후보/차단 검증을 수행한다.
실제 암호화 볼륨 전환과 데이터 I/O는 서로 구분한다. 2026-11-20 사용자 확정에 따라 현재 13번
HCI(RBD) 환경에서는 암호화 볼륨 작업이 불가능하면 UI 검증으로 이번 과제를 완료한다.
실전환은 NOT_RUN으로 기록하며 UI/단위 테스트 통과로 대체 표시하지 않는다.
실물 HSM/재부팅/게스트 데이터 보존은 기존 #1025 최종 통합 검증 범위다.
