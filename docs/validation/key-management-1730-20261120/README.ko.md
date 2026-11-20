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

# KM-03 #1730 구현·13번 UI 검증

## 결과

HSM 생성 전용 폼, 실제 provider 발견, 소유/존 범위 정규화와 PIN 처리·진단 로그 마스킹을 구현했다.
WSL **181 tests / 15 suites**, UI 단위 **56 tests / 2 suites**, 실패·오류·skip 0.
변경 Java 10개 Checkstyle 0, UI 6개 ESLint 0. backend/UI의 기존 KM-01·KM-02와 provider 회귀를 포함한다.
UI 신규 HSM 시험은 36건이며, 기존 볼륨 전환 20건을 함께 검증했다.

## 실제 UI

| 시나리오 | 관측 |
| --- | --- |
| provider | 실제 Database/PKCS#11만 제공, PKCS#11 기본. KMIP를 임의 추가하지 않음 |
| Database 계정 | admin/ROOT, global. PKCS 전용 입력 없음 |
| 프로젝트/존 | qa-km1730-project, 13-Zone. 다른 소유 인자 없음 |
| 도메인 공유 | ROOT, global, PKCS#11 index=0/max_sessions=2, PIN 생략 허용 |
| 전체 공개 | 상단 프로젝트 문맥에서도 global public으로 생성, 프로젝트 소유로 섞이지 않음 |
| scope 목록 | 프로젝트 보기는 프로젝트 프로파일 1건만 표시; 계정/도메인 프로파일 혼입 없음 |
| PIN 표시 | password/autocomplete off, 명시 표시→blur 재마스킹 |
| PIN 폐기 | protocol 왕복·scope 변경·취소/재열기·프로젝트 문맥 변경에서 초기화/제출 차단 |
| 실패 | 선택한 빈 프로젝트를 다른 UI 탭에서 삭제 후 생성 실패. 이름 등 유지/PIN 폐기/원시 오류 미표시 |
| 상세/수정 | 저장 PIN은 *****. 수정 폼은 name/enabled만 있고 PIN/details 수정 없음 |
| 저장 요약 | UUID/실제 전송 범위만 표시. 저장과 실제 연결·인증을 구분 |
| 정리 | 시험 프로파일 7개(초기 재검증 2개 포함), 프로젝트 2개 삭제. 기본 HSM Disabled 보존 |

주요 화면:
[Database 폼](01-database-account-form.jpg) · [계정 저장](02-account-save-result.jpg) ·
[프로젝트/존](03-project-zone-result.jpg) · [도메인/PIN 생략](04-domain-no-pin-result.jpg) ·
[마스킹 입력](05-pin-masked-field.jpg) · [문맥 변경](06-project-context-clears-pin.jpg) ·
[프로젝트 격리](07-project-list-isolation.jpg) · [공개 저장](08-public-save-result.jpg) ·
[저장 PIN 마스킹](09-stored-pin-masked-detail.jpg) · [실패 안내](10-create-failure-safe-message.jpg) ·
[실패 후 PIN 폐기](11-create-failure-pin-cleared.jpg) · [기본 HSM 보존](12-hsm-cleanup-default-preserved.jpg) ·
[프로젝트 정리](13-project-cleanup.jpg)

## 저장·로그 대조

비연결 프로파일의 가짜 PIN만 사용했다. 실제 HSM PIN/실물 인증/암호화 볼륨 I/O는 사용하지 않았다.
입력값은 파일에 쓰지 않고 일회성 digest로 DB 복호화 결과가 같은지 확인했다.
저장값은 평문과 다르며 복호화 결과가 입력과 일치했다.

추가 시험에서 ApiServlet 진단 payload의 합성 PIN 분류 누락을 확인해 POST body/GET query와 중첩 PIN 분류를 보완했다.
수정 후 **새 시험값**과 실패 요청의 시험값 모두 현재 management-server.log의 최근 64 MiB에서 발견되지 않았다.
이전 합성 시험값의 기존 운영 로그는 편집/삭제하지 않았다. 원시 값은 보고서에 기록하지 않았다.

[수정 전 합성 관측 메타데이터](pin-log-before-metadata.json) ·
[수정 후 암호화/로그 검사](pin-check-after.json) · [범위별 DB 대조](db-before-cleanup.json)

## 증거 범위

실제 UI 흐름·saved/detail UUID와 읽기 전용 DB 관측을 대조했다.
[UI 수명주기](ui-lifecycle-checks.json) · [선택 구간 API 관측](ui-api-evidence.json) ·
[검증 요약](verification-summary.json) · [UI 단위 실행 로그](ui-unit-tests.txt)

원시 browser storage 읽기는 UI 도구에서 지원되지 않아 수행하지 않았다.
스토리지 비기록은 컴포넌트의 Storage.setItem/debug-output spy와 소스 검토로 확인했다.
실제 UI 재진입/route·project 변경의 초기화 및 현재 client log buffer에서는 평문을 발견하지 않았다.
민감 입력/탐색 뒤 네트워크 관측 버퍼가 초기화되어 API trace는 완전 수집이 아니다.
위 자동 시험·metadata 검증을 실제 HSM 접속 성공으로 확대하지 않는다. 실물 인수는 기존 #1025에 남는다.

## WSL 빌드·개발 적용

`server,plugins/kms/pkcs11,plugins/kms/database -am`의 필요한 의존 모듈을 빌드했다.
기존 reactor 스타일 baseline 때문에 전체 스타일을 건너뛰고 변경 Java를 동일 규칙으로 따로 검사했다.
[backend receipt](build-receipt.json) · [Checkstyle](checkstyle-result.txt)

UI는 WSL production 모드의 비릴리즈 시험 번들로 압축/source map을 생략했다.
[실행기](build-ui-focused.cjs.txt) · [UI 산출물](ui-build.json).
정식/RC 릴리즈는 GitHub Actions 필수 정책을 유지한다.

기존 통합 JAR의 클래스 6개를 변경하고 응답 클래스 1개를 추가했으며
**92,934개 기존 항목 hash를 보존**했다. 빌드 클래스 7개와 실행본을 대조했다.
UI 정적 파일 692개와 config 보존을 검증했다. Mold만 재시작했고 host agent/SystemVM/RPM/기존 VM·볼륨은 교체하지 않았다.

- JAR `9a08a406e369ef14be9ce23e97eb9a0ed6cf4181973311895767babc0cd12430` → `57db6a6337f225917f0b5e53a1a1381a1a2291263f1f18a4ad74d48c8083170b`
- UI index `844a21f65792d125caa5698bc92b6a13958b0760e90eea88cb90f2bd005b5c50`
- config 보존 hash `71c175523a2e251faf574bd5d977c37e81d21c9cc0b8a98dfb1642c6b8a448d7`
- [실행 검증](final-runtime.json) · [소스 파일 hash](source-files.json)

최초 백업: `/var/lib/cloudstack/management/key-management-1730-backup-20261120/`.
복구 시 검증한 최초 JAR와 `ui/`에 보존한 기존 파일만 복원하고 Mold를 재시작한다.
공유 webapp 전체 삭제/Cloud 전체 재배포는 하지 않는다. 중간 logging 백업도 보존했다.
제품 DB DDL/컬럼/view 변경은 없다. 시험 실패는 삭제된 일회용 프로젝트로 재현했으며 DB 권한/로깅 정책을 완화하지 않았다.

## 최종 상태와 후속

활성 시험 HSM/detail/project/stale project/KMS 참조/API job 0, 기본 Database HSM Disabled/public 유지.
[최종 DB](db-final.json). 기존 비대상 자원과 운영 로그를 보존했다.

다음 구현은 **#1731 KMS·HSM 검색 필터와 운영 메타데이터 표시 정합화**다.
마지막 #1737에서 가상머신 표준의 breadcrumb·목록·상세·탭·탭 콘텐츠·대화상자를 키관리 전체에 통일·전수 검증한다.
전체 CI baseline debt는 이 기능의 집중 검증과 구분한다.
