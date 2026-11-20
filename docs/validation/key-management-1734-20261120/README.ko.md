<!--
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this work
for additional information regarding copyright ownership. The ASF licenses this
file to you under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
either express or implied. See the License for the specific language governing
permissions and limitations under the License.
-->

# KM-07 위험 작업 대상·참조 확인과 대화상자 검증

2026-11-20 KST에 13번 개발 클러스터의 Mold 웹 UI에서 [#1734](https://github.com/ablecloud-team/ablestack-cloud/issues/1734)를 검증했다. UI에서 만든 개체로 실제 키 작업을 검증했으며, 기록에는 요청 명령과 대상·소유 범위·건수만 포함했다.

삭제 창은 KM-09의 서버 참조 집계를 열 때와 제출 직전에 읽는다. KMS 볼륨·래핑 키, HSM 연결 키·KEK 버전 경유 래핑 키가 모두 0이며 보호 정책을 충족할 때 제출할 수 있다. 서버가 삭제 시 다시 참조를 확인한다. 권한이 없거나 조회에 실패한 건수는 확인할 수 없다고 표시한다.

회전 창은 현재 버전·길이·HSM과 요청한 길이·HSM을 표시하며, 새 버전 활성화 후 기존 래핑 키가 백그라운드에서 전환됨을 안내한다. 비활성화는 암호화 데이터 접근 영향과 재활성화 경로를 안내한다. 전환 창은 선택한 개수·이름·UUID와 대상 키의 소유 범위를 표시한다. 모든 창은 공통 MoldDialog와 고정 footer를 사용한다.

| 13번 UI 시나리오 | 관찰 결과 |
| --- | --- |
| 기본 및 실제 참조 보호 | 시스템 기본 Database HSM의 삭제 동작이 비활성화됐다. 연결 키 1건인 시험 HSM은 삭제 창에서 참조 건수와 이유를 표시하고 제출을 막았다. |
| 이전 KEK와 래핑 키 보호 | 브라우저 통제 응답에서 HSM 현재 키 0건과 버전 경유 참조 2건, KMS 사용 볼륨 0건과 래핑 키 3건을 확인했다. 삭제 POST는 0건이었다. |
| 조회 실패·미확정·제출 직전 변경 | 403·503·usage 누락을 통제해 건수가 미확정으로 표시되는 것을 확인했다. 정상 재조회 후 제출이 복구됐다. 창을 연 뒤 참조가 증가한 경우 제출 전 GET에서 차단됐다. |
| 키 회전과 실패 복구 | Database HSM A에서 B로 256→128비트 회전을 요청했다. 통제한 431 응답 뒤 입력이 유지됐고 다시 제출한 실제 작업의 버전·길이·HSM 반영을 확인했다. |
| 비활성화와 재활성화 | 시험 키와 HSM을 비활성화한 뒤 실제 UI에서 재활성화했다. 경고와 활성화 경로를 확인했다. |
| 전환 요약과 제출 | HCI/RBD 실제 UI에서는 후보가 0건으로 제출이 비활성화됐다. 두 볼륨 후보를 통제해 선택한 UUID 1개만 표시·전송되는지와 범위가 바뀌면 POST가 0건인지 확인했다. 성공 응답과 재조회도 브라우저에서 통제했다. 실제 암호화 볼륨 전환·데이터 I/O는 #1025에서 다룬다. |
| 키보드·중복·상태·스타일 | 초기 취소 포커스와 Enter/Escape 취소, 제출 중 버튼·닫기 차단, 중복 클릭의 실제 삭제 1건을 확인했다. 390×480 light와 dark에서 본문을 스크롤해도 footer 위치가 유지됐다. |
| 동명 키와 삭제 후 복귀 | 기본 범위와 프로젝트에 같은 이름의 서로 다른 키를 생성했다. 대상·범위 요약과 실제 삭제 요청의 UUID·프로젝트가 일치했고 삭제가 확인된 뒤 해당 목록으로 복귀했다. |

시험 개체를 UI에서 삭제했고 읽기 전용 점검에서 활성 시험 자원이 0건이었다. 전체 VM UI 보이는 형태 비교와 접근성 조합은 [#1737](https://github.com/ablecloud-team/ablestack-cloud/issues/1737)에서 이어간다.

## WSL 테스트와 개발 적용

- 로컬 베이스·upstream `a050d30bcedf81b95396748ab21b2f00c74171f1`. 차이는 `0 0`.
- 기능 커밋 `b58ac47a491bddf7f78e91d77c612d21326b7f44`.
- WSL 집중 테스트 12개 묶음 186건, 변경 파일 ESLint 통과. 개발 UI 빌드 성공.
- UI 정적 파일 700개 검증. 적용한 `index.html` SHA-256 `c6b0c0001cd565ca3e3b6ad42331dc72b2a9d45fecf24a5f5f1a5491d3b93627`.
- 배포 백업 `/var/lib/cloudstack/management/key-management-1734-backup-20261120/ui`. 기존 UI 설정 및 관리 서버 JAR SHA-256 `8686477f19fbba963e7b757162dba8ea6c608ad7a6b58982f25e7322a6320b28`를 확인했다.
- 13번 `mold.service` 활성, 웹 클라이언트 HTTP 200. KMS 키, HSM 프로파일, 계정·프로젝트 시험 자원 0건.

### 대표 검증 대상 UUID

| 자원 | UUID |
| --- | --- |
| 키 회전·비활성화·전환·삭제 시험 키 | `74f1debe-a096-48c8-88ce-913d9a8e8a77` |
| 회전 전 HSM | `1ee85bac-8205-4cdf-a933-1f492e103754` |
| 회전 후 HSM | `133d747a-b9de-4675-a1f6-2836b78831f1` |
| 동명 키 시험 프로젝트 | `dd649d69-f9d5-43a4-92fc-2069f0fe66f1` |
| 프로젝트 키 | `85723025-408d-4300-9c5c-5898e2214470` |
| 기본 범위 키 | `4a71b2a6-56a4-4c69-b15e-f616169f4668` |
