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

상위 Epic #1554 · 통합 회귀 #1569 · 기존 Draft PR #1577 / `dhslove/epic-1554-guest-networks`에서 관리한다. Public LB 적합성 → Internal LB 생성창 다음 순서다.

### 실제 재현과 범위
32 `qa-gn1569-32-lb-int-reg`의 Public/Internal Tier에서 `listVPCs.network`와 `listNetworks` 모두 `aclid/aclname`이 없다. Tier 탭은 ACL 자리에 텍스트가 없는 `#/acllist/undefined` 링크를 만든다. ACL 패킷 정책 이상을 뜻하는 결과는 아니다. 31 기존 사용자 지정 ACL이 있는 Tier는 유효 UUID/이름을 반환하므로 정상 링크를 보존해야 한다.

[빈 링크 캡처](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1554-guest-networks/docs/validation/guest-network-1569-vpn-roles-lb-20261110/screenshots/32-vpc-tier-empty-acl-links.jpg) · [API 비교](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1554-guest-networks/docs/validation/guest-network-1569-vpn-roles-lb-20261110/evidence/32-tier-acl-payload.json). `VpcTiersTab.vue`의 무조건 router-link가 원인이다.

### UI 설계와 완료 기준
- **API/Java/DB/ACL 정책 변경 없이** 유효 ACL UUID가 있을 때만 링크를 만든다. id가 없으면 대시(—), id가 있고 이름이 없으면 읽을 수 있는 UUID를 표시한다. 암묵 기본 ACL을 임의 추정하지 않는다.
- [ ] 32 두 Tier 모두 빈 링크/undefined URL 0, 대시 표시. 31 사용자 지정 ACL 링크는 실제 정상 이동/복귀한다.
- [ ] 목록 갱신/프로젝트 전환/조회 실패에서 이전 ACL 링크를 재사용하지 않는다. 읽기 전용·비회원의 기존 접근 정책을 유지한다.
- [ ] VM 상세 값/링크·탭/breadcrumb 표준, 390/768/1280·즉시 테마·프로젝트 왕복을 확인한다.
- [ ] Epic 브랜치/PR에 UI 수정·양쪽 배포/검증·캡처를 반영하고 시험 자원을 남긴다.
