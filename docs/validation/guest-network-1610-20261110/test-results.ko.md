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

# #1610 검증 결과와 범위

제품 `730c638c2537c71ce92739e4ade8fa22edcb4377`. UI/Vue/번역/프런트엔드 테스트만 변경했다. API/Java/DB/권한 정책 수정 없음.

| 검증 | 31 GFS2 | 32 Glue RBD | 증적 |
|---|---|---|---|
| 실제 GW 생성 | Ctrl+Enter로 POST1·job1·창 닫힘·목록1 | 실제 접수 응답 유실 후 동일job 재조회·POST1·job1·창 닫힘·목록1 | *-gateway-real-success-requests.json / *-job.json |
| 실제 VPN 접속 생성 | 실제 접수 응답 유실 후 동일job 재조회·POST1·job1·창 닫힘·목록1 | 통제 실패 뒤 Passive true→false 수정·실제POST1·job1·창 닫힘·목록1 | *-connection-real-success-requests.json / *-job.json |
| 확정 비동기 실패 | GW job2/431 통제 응답, IP/창/오류 보존 후 실제 재시도 성공 | 접속 job2/431 통제 응답, 고객GW·Passive/창/오류 보존 후 수정 성공 | 31-gateway-job2.json / 32-connection-job2.json |
| 불확실 | 접속 실제HTTP200 영수증503 대체+조회503 3회 → 입력 잠금/작업ID 보존 → 같은ID 복구 | GW 동일 절차 | 31-connection-loss.json / 32-gateway-loss.json |
| 중복/닫기 | 작업 중 확인 클릭 거부·Ctrl+Enter 무추가 요청·Escape 닫힘 차단 | 동일 | pending 캡처 및 requests |
| 후보 조회 | IP/고객GW 각각503 통제, 선택 유지/제출 차단/재조회 복구 | 동일 | *-lookup-failure.json |
| 프로젝트/즉시 테마 | 기본 보기↔프로젝트, 초안 초기화·timeOrigin 동일 | 동일 | *-instant-theme-project.json |
| 반응형/VM 표준 | 생성창2종×390/768/1280×라이트/다크, VM NIC/연결창과 비교 | 동일 | ui-matrix.json / *proof.json |

- 로컬 WSL ext4 lint·11 suites/183 tests·UI production 빌드 통과. 단위 회귀는 두 종류의 성공/실패/중복/조회 장애/후보 변경, 사용자·역할·권한·VPC·프로젝트·세션·경로 변경, 프로젝트 전환 시작, 저장 실패/복원, 소유 범위, provider IP 계약, Ctrl+Enter 직접 처리를 포함한다.
- 양쪽 정적664파일 해시 일치, HTTP200, WEB-INF/META-INF·설정·관리 JAR·Mold PID 보존. [31](evidence/31-deployment.json) / [32](evidence/32-deployment.json). 전체 Cloud 빌드나 수동 Actions 실행은 하지 않았다.
- 원본 JPEG 85장, 24개 기본 생성창 폭/테마 조합. 페이지/대화상자 본문 가로 넘침0, footer와 breadcrumb 범위를 확인했다. VM NIC 표준은 양쪽1280라이트/390다크의 화면·연결창으로 비교했다.
- 24개 기본 배치와 실제 생성·복구는 제품10459652b72에서 검증했다. 최종 가독성 보완은 불확실 상태의 중복 안내를 단일 warning으로 줄인 변경이며, 재배포 후 양쪽 통제 불확실/실패·입력 보존/기본 화면과 단축키를 재검증했다. 실제 job1/동일ID 복구의 서버 동작과 UI 상태 처리 로직은 그대로다.
- 양쪽 UI→VPC 목록→상세→VPN GW/접속 탭과 breadcrumb를 왕복했다. 프로젝트·테마 전환 시 document를 새로 만들지 않았으며 이전 Passive 초안이 재등장하지 않았다.
- 기존 네트워크115/98·VM158/85 전체 식별자/비교 필드·NIC·호스트·AS6/7·LB8/8과 기존 VPN 키·Connected/Running 상태를 보존했다. 전용 tier 추가 후 네트워크116/100이며 새 VM0·삭제0. [보존31](evidence/31-preserved.json) / [보존32](evidence/32-preserved.json).

## 실제 실행과 통제 시험의 구분

job2/431은 UI에 한정한 통제 응답이며 실제 서버 job 실패로 집계하지 않는다. 응답 유실 시험은 실제 서버가 HTTP200으로 접수한 POST 응답만503으로 바꿨다. 실제 생성/정상 job1은 서버 API로 재확인했고 재조회에서는 POST를 추가하지 않았다. 마지막 단일 warning 검증은 서버에 생성하지 않는 통제 영수증·503 조회·동일ID job2 복구로 수행했다.

첫32 GW 응답 유실 시험 중 브라우저 제어 시간이 초과돼 관찰을 완료하지 못했다. 생성된 GW는 보존하고 성공 증적으로 계산하지 않았다. 새32 recovery-review VPC에서 실제 접수/유실/조회3회/동일ID job1/자동닫힘/목록1까지 다시 완료했다. 중간 자동화의 미완료 프레임/포커스 오류를 제품 성공이나 실패로 계산하지 않았다. Ctrl+Enter의 공통 지시자 의존성은 새 창의 직접 키 처리로 바꾸고 회귀/실UI로 검증했다.

이번 이슈는 생성 작업과 창 수명/실패 입력 보존을 검증한다. 신규 빈 VPC의 터널 Connected·실제 패킷, 역할별 VPN 사용자 철회·다중 제공자/오퍼링 통합은 #1569의 후속이다. 기존 S2S/Remote VPN의 정상 상태는 보존 검사했다. Health Monitor는 별도 제공자 없음 사용자 확인에 따라 환경 차단을 유지하며 LB 백엔드 부하분산 측정은 제외한다.
