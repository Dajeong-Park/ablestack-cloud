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

상위 Epic #1554 · 통합 회귀 #1569 · 기존 Draft PR #1577 / `dhslove/epic-1554-guest-networks`에서 관리한다. 해결 순서는 #1611 → 이 이슈 → #1612 → #1613이다.

### 실제 재현
전용 프로젝트 읽기 전용 역할에 `removeFromLoadBalancerRule` 등 32개 변경 명령 deny를 적용한 상태다. 기존 network 9개 제한 역할은 바꾸지 않았다.

- 31 Public IP10.10.31.149의 새 `qa-gn1569-31-role-lb-review`를 펼치면 `LB 규칙에서 VM 삭제` 버튼이 활성이다. 클릭하면 공통 postAPI의 사용 가능 명령 검사에서 거부되고 오류 알림이 중복 표시된다.
- 32 `qa-gn1569-32-ilb-review`의 할당된 VM 탭에서도 같은 버튼이 활성이다. 클릭하면 같은 로컬 권한 검사에서 거부된다. 코드상 이 거부를 처리하는 catch/finally가 없어 spinner 복구도 보완해야 한다.
- 양쪽 Network 영수증에서 해당 변경 POST는 **0건**이다. 별도 직접 API는 deny401을 확인했고, API 재조회에서 기존 backend/NIC가 보존된다. **권한 우회/실제 연결 해제 결함으로 보고하지 않는다.**

[31 활성 버튼](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1554-guest-networks/docs/validation/guest-network-1569-vpn-roles-lb-20261110/screenshots/31-readonly-backend-remove-enabled.jpg) · [31 거부 알림](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1554-guest-networks/docs/validation/guest-network-1569-vpn-roles-lb-20261110/screenshots/31-readonly-backend-remove-rejected.jpg) · [32 활성 버튼](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1554-guest-networks/docs/validation/guest-network-1569-vpn-roles-lb-20261110/screenshots/32-readonly-internal-remove-enabled.jpg) · [32 거부](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1554-guest-networks/docs/validation/guest-network-1569-vpn-roles-lb-20261110/screenshots/32-readonly-internal-remove-rejected.jpg).

### UI 설계
- **API/Java/DB/권한 정책 변경 없이** `LoadBalancing.vue`의 expanded backend 해제와 `InternalLBAssignedVmTab.vue`의 해제 버튼에 `removeFromLoadBalancerRule` 사용 가능 여부를 반영한다. 기존 AutoScale/보호 규칙/busy 가드와 결합한다.
- 핸들러 시작에서도 최신 사용자·역할·프로젝트·대상/권한을 검사한다. 허용되지 않으면 loading 변경·변경 요청을 시작하지 않는다. 보이는 버튼과 실제 실행 가드를 일치시킨다.
- 로컬 reject/실제 API reject/job 실패에도 단일 읽을 수 있는 오류와 기존 목록 보존·spinner 해제를 보장한다. 이전 문맥의 늦은 콜백을 폐기하고 권한/프로젝트 전환 후 갱신한다.
- VM NIC 탭의 작업 버튼/disabled/모바일 고정 작업 열·다크 가독성을 기준으로 적용한다. 새 전역 관리자 우회나 API 허용 확대는 하지 않는다.

### 완료 기준
- [ ] 양쪽 읽기 전용 Public/Internal backend 해제 버튼이 비활성/숨김이고 클릭·키보드/이전 핸들러 경로에서도 요청0/연결 유지다.
- [ ] 관리자·허용 구성원은 전용 새 규칙/NIC의 해제→재연결이 성공하고, AutoScale 보호 가드가 유지된다. LB 분산 측정은 제외한다.
- [ ] 로컬 권한 변화/401/비동기 실패/조회 실패에서 spinner 종료·중복 알림 방지·목록 보존을 검증한다.
- [ ] 31/32 프로젝트 즉시 전환·화면 왕복·390/768/1280 라이트/다크·breadcrumb와 VM UI 표준을 실제 UI/API로 확인한다.
- [ ] 기존 Epic 브랜치/PR에 구현·배포·캡처를 반영하고 시험 자원을 남긴다.
