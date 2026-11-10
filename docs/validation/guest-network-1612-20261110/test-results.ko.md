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

# UI·API 검증과 해석

| 항목 | 실제 결과/범위 | 증거 |
| --- | --- | --- |
| 실제 거부·수정 재시도 | 31/32 실제533 거부·이름/설명/IP/포트/알고리즘 보존 → IP 자동 할당으로 POST1/job1/목록1 | `*-real-533-*`, `*-real-create-*` |
| 원래 범위 밖 IP | 양쪽 실제 UI CIDR 검사/POST0·입력 유지. 31은 Shutdown 된 첫 Tier 대신 같은 코드의 보관 warm Tier에서 검사 | `*-cidr-local-*`, `*-cidr-invalid-local-preserved.jpg` |
| API 응답 형식 | 일반 errorresponse와 명령별 errorcode를 모두 처리. listLoadBalancers에 없는 scheme 필드는 강제 요구하지 않고 실제 Tier/오퍼링/연결망을 검사 | 최종 소스·단위 검사, `31-current-*.json` |
| 생성/할당 비동기 실패 | 양쪽 통제431, job0→job2/530, 접수 유실/조회503×3→동일job 재조회. 오류1·spinner0·값/선택 유지·서버 변경0 | `*-create/assign-431/job2/receipt-loss-*` |
| 후보 조회 실패 | 생성/할당×양쪽 통제503 뒤 입력/선택 유지·제출 잠금, 실제 업데이트로 회복 | `*-lookup503.json`, `*-lookup-recovered.json` |
| 실제32 할당 | Ctrl+Enter POST1/job1·자동 종료·표1행, b-482-VM Running/실제 VM IP 매핑1 | `32-real-assign-*`, `32-review-binding-final.json`, `32-lbvm-current.json` |
| 실제 접수 응답 유실 | 실제 HTTP200 생성 POST 뒤 응답만 비움 → 미리 발급한 같은 customjobid의 실제 job1 조회·목록 추가·POST1 | `32-real-receipt-loss-dispatch/job/post.json` |
| 실제31 장기 대기 | POST1/job0·LBVM Starting/runtime 없음, 120초 후 미확정/spinner0, 닫기/재개에서 같은 job 조회. 매핑1은 저장 상태이며 활성화 성공 아님 | `31-actual-assign-*`, `31-internal-*.json`, #1616 |
| 준비 조건 | 기존 프로젝트 VPC Tier3 제한, 다른 QA VPC의 warm VM 배치 job2/530. 자원/서버 상태 강제 보정 없음 | `31-warm-vm-receipt/current.json`, #1616 |
| 읽기 전용 | 직접 API 생성·할당 4건 거부(31 비회원 프로젝트432/32 제한 API401). 32 UI 생성/할당 작업 숨김/POST0. 31 멤버 읽기 전용 양성은 별도 역할 전 범위 완료로 주장하지 않음 | `*-readonly-api.json`, `32-readonly-*-zero.json`, UI guard |
| 문맥/표준 | 36배치+네이티브 검토2, 즉시 테마 timeOrigin 동일, 프로젝트 왕복, 실제 VM 목록/상세/NIC/연결창·breadcrumb 비교, 모바일 테이블 가로 이동 | `layout.json`, `*-instant-theme.json`, `*-project-*.json`, `*-vm-standard-*` |
| 보존/배포 | 기존65규칙 연결·기존 네트워크/VM/VPC 변경·삭제0, 역할/멤버십 동일, 서버 정적668개/해시·HTTP200/보호 경로 보존 | `*-preservation-summary.json`, `*-old-backends-after.json`, `*-security-*.json`, `*-deployment.json` |

통제 실패는 브라우저 XHR 응답을 바꾼 시험으로, 실제 서버 장애/job 실패와 구분한다. 32 접수 유실은 **정상 서버 요청의 응답만** 비운 실제 복구다. 그에 앞서 기존 VIP 재사용 요청의 실제537 거부를 유실로 바꾼 시도는 `32-invalid-receipt-loss-attempt.json`에 **무효/성공 집계 제외**로 기록했고, 없는 job을 통제 job2로 정리한 뒤 정상 HTTP200 요청으로 다시 검증했다.

31 최초 API533 시험에서 명령별 오류 envelope를 처리하지 못한 초기 구현과, 할당 후보의 없는 scheme 필드를 요구한 초기 구현은 실제 검증 중 수정했다. pre-final 캡처는 발견 기록이며 최종 통과 근거에 포함하지 않는다. 최종 소스 c94767fb0c5의 221검사를 사용한다. 최초 양쪽 생성 성공은 0f48d55fef2에서 확인했고 이후 변경은 할당 응답 적합성 가드다. 최종 배포 후 32 정상 생성/실제 유실 복구와 양쪽 CIDR·후보 복구/할당 가드를 다시 확인했다.

31 서버 성공 및 선기동 대조는 미완료다. 네트워크 Shutdown·시스템 VM Starting과 관련된 정확한 선행 작업/재진입 원인은 아직 확정하지 않았다. 운영 설정이나 DB state를 강제로 바꾸지 않았다. LB 데이터 평면/분산 측정은 제외했다.
