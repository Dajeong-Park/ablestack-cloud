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

상위 Epic #1554 · 통합 회귀 #1569 · 기존 Draft PR #1577 / `dhslove/epic-1554-guest-networks`에서 관리한다. 위 Public Tier 적합성 수정 다음 순서다.

### 문제와 실제 재현
32 VPC Tier → Internal 전용 Tier → 내부 LB 추가에서 이름/설명/포트와 범위 밖 Source IP `10.236.32.20`을 입력해 제출했다(실제 내부 범위 `10.236.32.64/26`). 실제 `createLoadBalancer` API 431 `The requested IP is not in the network's CIDR subnet.` 이후 창이 닫혔다. 다시 열면 초안이 비어 있다. Source IP를 비워 정상 생성한 `qa-gn1569-32-ilb-review`는 보관 중이다.

`VpcTiersTab.vue.handleAddInternalLBSubmit`은 job poll을 등록한 뒤 `.finally`에서 창을 닫는다. 실제 비동기 job2/접수 유실은 이번 실행에서 재현하지 않았으며, 이 코드를 근거로 설계/후속 검증에 포함한다. 기존 창은 520px legacy a-modal/본문 작업 버튼이고 VM 연결창의 MoldDialog/고정 footer와 다르다. 모바일 가로 넘침은 이번 관측에서 없었다.

[제출 전](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1554-guest-networks/docs/validation/guest-network-1569-vpn-roles-lb-20261110/screenshots/32-internal-lb-invalid-before.jpg) · [실패 후 닫힘](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1554-guest-networks/docs/validation/guest-network-1569-vpn-roles-lb-20261110/screenshots/32-internal-lb-invalid-closed.jpg) · [재개 시 빈 입력](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1554-guest-networks/docs/validation/guest-network-1569-vpn-roles-lb-20261110/screenshots/32-internal-lb-reopened-empty.jpg) · [390px 다크](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1554-guest-networks/docs/validation/guest-network-1569-vpn-roles-lb-20261110/screenshots/32-internal-legacy-modal-390-dark.jpg).

### UI 설계
- **API/Java/DB 수정 없이** #1610의 조회/검증/제출/job 진행/성공/확정 실패/불확실 상태 흐름을 적용한다. job1을 확인한 뒤에만 닫고 목록을 갱신한다. API 거부·job2는 창·사용자 입력·읽을 수 있는 오류를 보존한다.
- 접수 응답/조회 실패는 성공/실패로 단정하지 않는다. 비밀값 없는 영수증과 작업 ID로 같은 job 재조회를 제공하고 재제출·중복 클릭/Ctrl+Enter를 막는다. 진행 중 닫기 정책도 VM 표준과 맞춘다.
- 소유 VPC·프로젝트·Internal Tier·CIDR/포트·오퍼링 적합성을 명시하고 재검증한다. 전환/취소/재개 시 초안 및 오래된 콜백을 정확히 정리한다. 기존 API 보안 가드는 유지한다.
- MoldDialog md720, 세로/의미별 폼, 본문 스크롤·고정 footer 취소/확인, 아이콘+텍스트 업데이트를 적용한다. VM NIC 연결창의 목록·상세·탭·breadcrumb/모바일 테마와 비교한다.

### 완료 기준
- [ ] 31·32 준비된 조건에서 실제 431 → 창/필드 보존 → 보정/재시도 → job1 종료/목록 1개를 확인한다.
- [ ] 실제/통제 job2와 응답 유실을 구분해 상태·동일 job 복구·중복 생성 0을 검증한다.
- [ ] 생성/할당된 NIC·기존 서비스/역할 보존. LB 분산 측정 제외, 공인 IP 없는 31 조건은 환경 차단과 구분한다.
- [ ] 프로젝트 즉시 전환·화면 왕복·390/768/1280 라이트/다크·키보드/가독성을 양쪽 실제 UI와 캡처로 남긴다.
