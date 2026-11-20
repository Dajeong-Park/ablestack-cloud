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

# KM-02 #1729 구현·13번 UI 검증

## 인수 결과

사용자 확정 범위에 따라 구현과 13번 UI 검증을 완료했다. 실제 암호화 볼륨 전환은 **NOT_RUN**이다.
현재 HCI(RBD) 환경에 암호화 볼륨이 없고, UI가 Europa 암호화 배포를 비활성화한다.
2026-11-20 사용자가 이 경우 UI 검증으로 이번 과제를 완료하도록 확정했다.
소프트웨어 시험을 실제 전환·HSM·게스트 데이터 보존 통과로 확대하지 않는다. 기존 #1025 인수를 유지한다.

## 변경 동작

일반 볼륨 목록을 그대로 보여 주던 전환 작업을 전용 대화상자로 바꿨다.
대상 UUID/계정/도메인/프로젝트/존을 고정하고 서버가 실제 legacy 참조·암호화·Ready·현재 KMS 여부를 판정한다.
서버가 검색과 적격 필터를 적용한 뒤 count/page를 계산한다. 이전 `kmskeyid`는 현재 연결 키라는 뜻을 유지한다.
전환 문맥의 현재 사용자/API 키 권한을 추가 확인한다. 신규 DB 컬럼·view 변경은 없다.

실행 직전 UUID별 재조회와 키/HSM 활성 상태 검사를 수행한다.
같은 대상 키의 기존 연결만 skip하며 다른 키·없는 UUID·부적격 볼륨은 거부한다.
정상 응답의 success를 유지하며 requested/migrated/skipped를 추가하고 부분 실패는 async 실패를 유지한다.
화면은 UUID별 재관측으로 연결 확인/미전환/확인 불가를 구분하며 전환 POST를 자동 재시도하지 않는다.

가상머신 공통 `MoldDialog` xl, 고정 footer, focus guard와 작은 표를 사용한다.
필터의 입력 라벨과 선택지 너비를 보완했다. 전체 breadcrumb·목록·상세·탭·탭 콘텐츠·대화상자 통일은
마지막 #1737에서 앞 9개 변경을 모아 전수 검증한다.

## WSL 집중 검증

- backend: 119 tests / 9 suites, 실패·오류·skip 0. 기존 108건에 이번 11건을 추가했다.
- UI: 20 tests / 1 suite. 페이지 간 UUID 선택, scope 변경, 지연 응답, 사전 삭제/변경/오류,
  전체·부분 실패, 응답 유실, 0개 전환, 구 서버, 정상 빈 목록, 상세 작업 진입 경로를 포함한다.
- 변경 Java 9개 Checkstyle 0, 변경 UI 5개 ESLint 0.
- Maven: `mvn -B -ntp -pl server -am -Pdeveloper,disablecheckstyle -Dcheckstyle.skip=true '-Dtest=KMSManagerImpl*Test,QueryManagerKMSMigrationPermissionTest' -Dsurefire.failIfNoSpecifiedTests=false -DfailIfNoTests=false package`
- 기존 reactor API 46/schema 15 스타일 baseline 때문에 전체 reactor 스타일을 건너뛰고 변경 Java를
  동일 규칙으로 별도 검사했다. 전체 저장소 CI 통과라는 뜻이 아니다.
- UI는 WSL의 production 모드에서 압축·source map을 생략한 비릴리즈 시험 번들을 빌드했다.
  실행기는 [build-ui-focused.cjs.txt](build-ui-focused.cjs.txt), 조건과 checksum은 [ui-build.json](ui-build.json)에 있다.
  릴리즈 빌드의 GitHub Actions 필수 정책은 유지한다.

## 실제 UI 관측

| 시나리오 | 실제 결과 |
| --- | --- |
| 대상 고정 | `c5fafd0f-c395-4237-bba1-083eb74e8ec5`, admin / ROOT / 13-Zone 표시; 독립 소유자 입력 없음 |
| 일반 후보 | 176건, 10건씩 1·2 페이지; UUID 중복 0; 비암호화 10행과 전체 선택 모두 비활성 |
| 검색 | ROOT-241: 1건, UUID 6254ef33-9adb-497f-89fc-46428a923167 |
| 적격 필터 | 0건; 정상 빈 목록; 오류 alert 0; 제출 비활성 |
| 불가 필터+검색 | 1건; NOT_ENCRYPTED를 ‘암호화되지 않음’으로 표시 |
| HSM 상태 변경 | 열린 대화상자에서 갱신하면 HTTP 431과 사전 확인 오류, 제출 차단 |
| 키 비활성 | 최신 키 조회의 enabled=false에서 후보 조회/제출 차단 |
| 취소·재진입 | 상세 URL 유지, 검색 값 초기화, 대상 UUID 보존 |
| 표·대화상자 | 원래 dark 테마/브라우저 크기 유지; footer 고정; 가로 스크롤로 판정 열 접근 |
| 전환 제출 | 관측한 검증 구간에서 migrateVolumesToKMS POST 0건 |

UI가 발생시킨 요청 20건은 [ui-api-evidence.json](ui-api-evidence.json)에 필요한 필드만 남겼다.
로그인/sessionkey/API 키/PIN/키 바이트를 기록하지 않았다.
페이지·계정/프로젝트 경계의 합성 시험, 모의 async 실패와 실제 13번 관측은 [ui-results.json](ui-results.json)에서 구분한다.

- [환경의 암호화 배포 비활성](01-encryption-deployment-disabled.jpg)
- [전용 대화상자와 176건](02-dialog-dark-default.jpg)
- [정상 적격 0건](03-eligible-empty.jpg)
- [비활성 HSM 차단](04-disabled-hsm-blocked.jpg)
- [가로 스크롤의 불가 사유](05-ineligible-reason-scroll.jpg)
- [비활성 키 차단](06-disabled-key-blocked.jpg)
- [시험 키 삭제 후 목록](07-test-key-cleanup.jpg)

## 적용·정리·복구

관리 서버의 기존 통합 JAR에서 클래스 8개를 변경하고 새 응답 클래스 1개만 추가했다.
92,931개 기존 항목의 hash를 보존했다. 빌드 클래스 10개와 실행 JAR의 hash가 일치한다.
`mold.service`만 재시작했으며 host agent/SystemVM/RPM/DB schema는 교체하지 않았다.

- JAR: `ab4d2490066a93e00ae4de454d492ca797872e54f0398d651c672791ec5672cb` → `9a08a406e369ef14be9ce23e97eb9a0ed6cf4181973311895767babc0cd12430`
- UI: 690개 정적 파일 hash 확인, index `fddf3888552f9f0fb8d0bbe1308330592b4cf313ae9515d1d717f2ba59844d64`.
- 기존 config.json hash `71c175523a2e251faf574bd5d977c37e81d21c9cc0b8a98dfb1642c6b8a448d7` 보존.
- 시험 키 1개 삭제, 활성 시험 provider 키/키·볼륨 wrapped 참조 0, API job 0.
- 기본 Database HSM Disabled 복원. 기존 볼륨·VM을 전환/포맷하지 않았다.

최초 백업은 `/var/lib/cloudstack/management/key-management-1729-backup-20261120/`다.
필요 시 원본 JAR hash를 확인한 뒤 그 파일을 복원하고 Mold를 재시작한다.
UI는 백업 `ui/`의 기존 파일만 원래 상대 경로에 복원한다. 새 hash 파일은 참조가 사라진 뒤에도 남겨도 된다.
공유 webapp 전체를 삭제하거나 전체 Cloud를 재배포하는 복구 절차를 사용하지 않는다.

[실행 환경·클래스 검증](final-runtime.json) · [최종 비밀 없는 DB 관측](final-db-runtime.json) ·
[빌드·테스트 receipt](build-receipt.json) · [최종 소스 파일 hash](source-files.json)

이번 PR에서 앞선 #1728 증거 JSON 3개의 EOF lint 진단도 내용 변경 없이 정리했다.
전체 저장소 License/Lint baseline 실패와 이 기능의 집중 검증 결과를 구분한다.

다음 구현은 **#1730 KM-03 HSM 프로토콜별 생성 폼과 PIN 마스킹**이다.
