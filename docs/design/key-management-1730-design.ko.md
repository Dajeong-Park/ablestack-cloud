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

# KM-03 HSM 생성 폼·provider 발견·PIN 처리 계약

Epic #1727 / #1730 / 누적 PR #1739. 제품 DDL 없음.

## API

listCapabilities의 선택적 kmsproviders=[{protocol,displayname}]는 주입된 KMSManager.listKMSProviders에서
실제로 로드된 provider 이름만 정규화·중복 제거·정렬해 반환한다. database/PKCS#11의 표시명만 제공하며
library/slot/PIN/config 객체를 읽지 않는다. 실패/미설치 시 빈 목록으로 두어 기존 capability/login을 유지한다.
새 UI는 누락/실패/빈 목록을 임의 provider 목록으로 대체하지 않고 생성을 차단한다.
지원 입력 폼이 없는 사용자 정의 provider는 표시해도 선택하지 못한다.

createHSMProfile의 optional protocol 생략→pkcs11, 관리자 전용 권한, 요청/응답 sensitive 플래그를 유지한다.
응답은 createhsmprofileresponse.hsmprofile 안의 UUID를 읽고 안전한 요약 필드만 보관한다.
updateHSMProfile은 기존 name/enabled만 지원한다. protocol/details/vendor/공유 범위 수정은 추가하지 않는다.

## 폼과 범위

기본값은 실제 제공되는 경우 PKCS#11, 소유 범위는 계정이다. Database는 details/PIN을 전송하지 않는다.
PKCS#11은 library, slot 또는 slot_list_index 또는 token_label, 선택적 max_sessions/PIN을 제공한다.
slot은 32비트 정수, index는 0 이상, max_sessions는 양의 정수다. 실제 provider의 PIN 생략 허용 계약을 유지한다.

소유 범위는 public / domain / account / project 중 하나이며 요청에 호환되는 인자만 넣는다.
public은 ispublic=true만, domain은 domainid, account는 domainid+account, project는 projectid를 보낸다.
global/특정 zone은 독립 축이다. ignoreproject로 상단 ambient 프로젝트가 다른 소유 범위를 섞지 않게 한다.
목록 후보는 서버 API에서 조회하고 UUID/domain 일치를 확인한다. 제출 직전 provider를 다시 확인한다.
서버의 기존 finalizeOwner/ACL/scope 검증을 유지한다.

## PIN과 결과

PIN은 일반 details Map/표의 편집값 대신 별도 컴포넌트 메모리에 둔다.
기본 password/autocomplete off, 명시 표시 중 field/window blur는 숨기고
protocol·owner/zone·route/query·project·role/API permission·logout·pagehide·unmount에서는 폐기한다.
비가시 탭에서도 PIN 입력을 지운다. 이 경우 제출 전에 다시 입력해야 한다.
저장된 마스킹 표시 *****는 새 PIN으로 재전송하지 않는다.
제출 시작 시 화면 PIN을 지우고 함수 지역 변수로만 입력을 잠시 유지한다. provider 재조회 뒤 문맥이 같을 때만 전송한다.
모든 종료 경로에서 지역 변수와 요청용 객체의 PIN 항목을 지우며, 실패해도 PIN이나 원시 오류 객체를 화면 상태에 남기지 않는다.
성공 요약은 실제 전송한 소유 범위를 기준으로 하며 credentials/details를 보관하지 않는다.

명확한 HTTP 4xx 실패는 비밀 아닌 필드를 유지한다. 전송/서버 결과 미확정은 재제출을 차단하고 목록 확인을 안내한다.
어느 경우도 생성 POST를 자동 재시도하지 않는다. 설정 저장/Enabled를 HSM 연결·인증 성공으로 표시하지 않는다.

## 로그와 검증 한계

클라이언트의 원시 실패 response debug 출력을 제거했다.
관리 서버는 createHSMProfile POST body와 GET query를 진단 로그에 출력하지 않으며,
중첩 pin을 공통 민감 필드 분류에 포함한다. ping/pinning 등은 오분류하지 않고 실제 입력값은 바꾸지 않는다.
명령/상태/기존 감사 기록과 로그 수준은 유지한다.

원시 browser storage 읽기는 도구에서 지원되지 않아 수행하지 않았다.
새 경로가 browser storage/debug 출력에 PIN을 쓰지 않는지는 Storage.setItem spy와 소스 검토로 확인했고,
실제 UI 재진입·scope 변경의 초기화와 현재 로그 버퍼·화면·URL을 확인했다.
네트워크 trace는 일부 관측 구간이며 완전 수집을 주장하지 않는다.
실제 HSM 접속/인증/게스트 데이터 인수는 NOT_RUN / #1025다.
