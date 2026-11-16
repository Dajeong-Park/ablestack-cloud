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

# #1696 URL 등록 설계와 구현 계약

## 범위와 입력

URL 전용 RegisterKubernetesIso를 현재 운영 MoldDialog(md)로 분리합니다. 로컬 AddKubernetesSupportedVersion 경로와 backend/DB/Agent/SystemVM은 변경하지 않습니다.

- 서버 최소 버전은 KubernetesVersionService.MIN_KUBERNETES_VERSION=1.11.0입니다. 현재 Java 파서는 점으로 구분한 숫자3개 이상을 허용하며 각 부분은32비트 정수입니다. UI도 같은 범위를 사용합니다. prerelease/v 접두사/NaN은 허용하지 않습니다.
- CPU≥2, RAM≥2048MB, 정수·최대2147483647을 검증합니다.0/소수/NaN/오버플로를 누락 값으로 바꾸지 않고 해당 필드에서 거절합니다.
- URL 이름은 선택 사항입니다. 공백을 제거한 이름이 없으면 서버가 전역 v<version>, 특정 Zone v<version>-<zonename>으로 생성합니다. 로컬 이름 필수 조건은 유지합니다.
- URL은 기존 ISO URL 구문 검증을 재사용하고 서버 UriUtils의 .iso/압축 ISO/.metalink 경로를 확인합니다. http/https/file 구문을 유지하며 DNS/IP·접근 가능성·리다이렉트·인증서·호스트 정책의 최종 판정은 서버에 둡니다.
- validTemplateChecksum을 재사용하되 DigestHelper.validateChecksumString의6개 알고리즘·정확한 길이를 추가로 제한합니다. 빈 값, 기본 MD5 32hex, {MD5}/{SHA-1}/{SHA-224}/{SHA-256}/{SHA-384}/{SHA-512} 및32/40/56/64/96/128hex를 지원합니다. bare64와 sha256:<hex> 및 알 수 없는 알고리즘은 해당 필드에서 거절합니다.
- CPU 아키텍처는 카탈로그 API가 명시한 x86_64/aarch64/s390x입니다. 기본은 서버와 같은 x86_64입니다. 새 아키텍처 선택이 실제 부팅/CKS 설치 통과를 뜻하지 않습니다.
- payload는 정리한 값만 사용하고 false를 보존합니다. 시스템 소유 전역 카탈로그에 account/domain/project를 보내지 않습니다.

## Zone와 직접 다운로드

UI의 모든 Zone 식별자 all은 API에 보내지 않고 zoneid를 생략합니다. 특정 Zone은 현재 목록의 UUID로 조회하며 배열 인덱스로 해석하지 않습니다.

선택 Edge 또는 모든 Zone에 Edge가 있으면 직접 다운로드를 강제합니다. 그 외 선택으로 돌아오면 사용자의 마지막 true/false 선택을 복원합니다. 목록을 조회할 수 없는 URL 전용 역할은 모든 Zone 경로를 사용할 수 있으며 URL API 권한을 listZones grant로 대신하지 않습니다. 실제 Edge/다중 Zone/비KVM은 환경이 없으면 NOT_RUN으로 기록하고 기능은 보존합니다.

## 접수·관측·중복 전송

검증 시작 전에 busy를 설정해 비동기 검증 중의 중복 제출도 차단합니다. POST는 한 번만 수행하고 유효한 parent UUID가 포함된 응답만 접수로 표시합니다.

접수 화면은 parent/ISO ID·범위·아키텍처·직접 다운로드를 식별할 수 있게 합니다. 접수와 parent isostate=Ready를 파일 준비 완료로 간주하지 않습니다. 결과 확인은 허용된 parent와 listIsos를 읽고 선택 범위의 전체 페이지/행·isready·실패 원인을 확인합니다. 권한·필드·count가 없으면 Ready로 추정하지 않습니다.

다운로드 실패 후에도 결과 확인은 기존 리소스를 관측하며 POST하지 않습니다. URL 등록 재시도 대신 parent/ISO 상세에서 원인 확인과 정리를 할 수 있습니다. 원문 오류 사유는 기존 ISO의 안전한 표시 모델을 사용합니다.

응답이 유실/손상되면 결과 불명 상태로 두고 동일 요청을 자동 재전송하지 않습니다. 후보 조회는 이름·버전·범위·URL 등의 일치를 확인하지만 후보가 이 요청으로 생성됐다는 증거로 취급하지 않습니다.

기존 hash.js로 만든 요청/소유 범위 해시와 불명 상태만 같은 탭의 sessionStorage에 저장해 새로고침 후에도 중복을 차단합니다. URL·체크섬·세션 원문·서명·티켓은 저장하지 않습니다. 확인된 접수는 현재 런타임에서 재사용하고 불명 상태로 영구 재생하지 않습니다. 계정/역할/API/프로젝트/세션이 바뀌면 소유 범위를 갱신합니다.

이 보호는 서버 idempotency key나 트랜잭션의 exactly-once 보장이 아닙니다. 다른 탭·새 로그인·저장소가 차단된 브라우저에서는 기존 목록을 먼저 확인해야 합니다. API가 아직 제공하지 않는 전역 exactly-once 보장을 UI 기능으로 선언하지 않습니다.

읽기 전용 준비 조회 중에는 닫을 수 있고, POST/검증 중에는 닫기·이동·중복 전송을 막습니다. 늦은 응답은 새 사용자나 닫힌 양식에 적용하지 않습니다.

## 검증과 후속

현재 단위/렌더링 검사는 입력 경계·실제 Ant 필드 오류·비동기 검증 중복·새로고침 보호·응답 불명 후보·실패/부분/지연 관측·권한 경계를 확인합니다. 실제13번 결과와 시험 자원 ledger는 검증 보고서에 따로 기록합니다.

4.21/4.23 양 계열 로컬 전송·arch/감사는 #1697, 검색/count #1698, 상세/Zone 표시 #1699, 안전한 상태/삭제 #1700, 최종 스타일 #1701, 전체 ACL 통합 회귀 #1702 범위입니다. CI 부채 #926·#1044는 분리합니다.
