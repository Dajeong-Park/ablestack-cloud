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

# 실제 검증과 한계

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 수정 전 재현 | 31 Public·32 Internal 읽기 전용 버튼 활성, 클릭 없이 상태 재확인 | `*-before-readonly-*.json`, before 캡처 |
| 읽기 전용 최종 UI | 31 Public·32 Public/Internal 비활성, 실제 포인터 좌표가 viewport 안임을 확인, Tab이 버튼을 건너뛰고 Enter/포인터 변경 POST0 | `*-final-readonly-*-result.json`, `*-mutation-requests.json` |
| API 보안 정책 | 5역할×3대상 조회15, 읽기 전용/비회원 해제·할당 거부12 =27기록. 기존 권한/멤버십 동일 | `*-role-api.json`, `*-security-before.json`, `*-security-after.json` |
| 허용 역할 실제 UI | 관리자·멤버·도메인 관리자×31 Public/32 Public/Internal 해제→같은 VM/IP 재연결. job1·연결0→1·최종 매핑1 | `*-remove-response.json`, `*-assign-response.json`, `*-remove-api.json`, `*-assign-api.json` |
| HTTP401 UI 분기 | 통제한 commandDenied401에서 단일 인라인 오류1·global 알림0·spinner0·기존 행1 유지 | `*-401-result.json` |
| 비동기 실패 UI 분기 | 통제 job2/530에서 단일 오류·spinner 종료·행/매핑 유지 | `*-job2-result.json` |
| job 조회 복구 | Internal의 통제503×3 후 unknown/spinner0, 같은 job 재조회 성공, POST는 최초 통제1회/서버 전달0 | `32-internal-query-retry-*.json` |
| 목록 조회 실패 | 세 화면 통제503 뒤 마지막 정상 행1 유지·해제 비활성·spinner0, 업데이트로 실제 조회 복구 | `*-list503-result.json`, stale/recovered 캡처 |
| 프로젝트 시작/늦은 응답 | 이전 요청을 보류한 채 기본 보기로 문맥 전환, 응답 해제 후 이전 job 조회0, 복귀 시 실제 매핑 유지 | `31-public-project-pending-result.json`, `32-internal-project-pending-result.json` |
| AutoScale/보호 | 실제 양쪽 AutoScale 해제 비활성/POST0, 관리 태그·busy·stale/이전 핸들러는 단위 검증 | `*-autoscale-guard-result.json`, `LbBackendRemoval.spec.js` |
| UI 표준 | 3화면×3폭×2테마18배치·고정 작업 열/페이지 overflow·즉시 테마 timeOrigin 동일·breadcrumb/목록/상세/탭 왕복 | `layout.json`, `*-button.json`, `*-instant-theme.json`, `*-navigation-result.json` |
| 배포/보존 | 활성665정적파일·해시·HTTP200, 서버 디렉터리/설정/JAR/PID 보존, 기존 LB62 매핑 유지 | `*-deployment.json`, `*-preservation-summary.json` |

HTTP401/job2/조회503은 **브라우저 XHR 응답을 통제한 시험**이다. 실제 서버 장애·실제 실패 job으로 집계하지 않는다. 해당 해제 POST는 서버로 전달하지 않았다. 실제 권한 거부는 직접 API12건과 native 읽기 전용 UI0건으로 구분한다. 실제 허용 역할의 해제/할당 job과 API 매핑 검증은 통제하지 않았다. 최종 가로채기·viewport 에뮬레이션은 해제했다.

첫31 관리자 해제는 UI job 완료/규칙 Add·백엔드 빈 행을 확인한 뒤 재연결했다. 자동화의 초기 locator 대기 시간 제한으로 당시 Network 영수증을 놓쳤으나, 실패/중복 요청으로 세지 않았다. 나머지 실제 해제/재연결 영수증과 직접 API0→1을 보존했다. 멤버 재연결 중 메뉴 애니메이션/비활성 탭 및 준비 전 API 검사는 자동화 경로를 수정해 재확인했고, 잘못 연 세션 고정 창은 저장 없이 취소했다.

기능 검증의 첫 배포는 `0023fe99da4`, 최종은 `4643d1e7047`이다. 후자는 Zone 조회의 이전 열 참조만 정리한 버전이며 백엔드 가드 로직은 같다. 최종 배포본에서 역할 가드·실패 복구·전환·18배치·표준·재조회 검증을 수행했다. 최종 안정 검토 창의 콘솔 오류는0이다. 계정 전환 시점의 기존 공통 GUI theme 조회/축약 i 로그7건도 `*-final-console.json`에 남겨 전체 시험 구간 무오류로 확대하지 않는다.

31 Shared-reg 프로젝트에는 Internal Tier가 없고 두 기존 VPC CIDR 전체가 NoLB Tier에 사용 중이다. 신규 VPC는 기존 공인IP 풀 고갈 조건이므로 확인 자원을 해제하거나 CIDR/오퍼링/역할을 변경하지 않았다. 실제 UI3대상과 공통 Internal 코드의 양쪽 배포/단위 검증을 구분한다. **31 Internal 실제 양성 경로는 #1569 환경 준비 후 잔여 조건**이다. LB 백엔드 분산·성능 측정은 제외한다.

이번에 바꾼 목록/상태 UI는 VM 표준을 적용했다. 기존 Internal 생성·가상머신 할당 legacy 대화상자 전체의 재설계/실패 입력 보존은 다음 #1612에서 검토한다. 세션만료401의 기존 인증 정책이나 API 권한은 바꾸지 않았다.
