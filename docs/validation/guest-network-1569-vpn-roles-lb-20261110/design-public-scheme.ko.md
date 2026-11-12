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

상위 Epic #1554 · 통합 회귀 #1569 · 기존 Draft PR #1577 / `dhslove/epic-1554-guest-networks`에서 관리한다.

### 문제와 실제 재현
32번 `qa-gn1569-32-lb-int-reg`의 Public IP `10.10.32.178` → 부하 분산 → 규칙 추가에서 Internal 전용 Tier가 기본 선택/후보로 노출된다. Internal NIC `10.236.32.79`를 선택해 제출하면 실제 API 431 `Scheme Public is not supported by the network offering`으로 거부된다. 생성된 규칙은 없고 입력은 보존된다. Public Tier와 그 NIC로 보정하면 job 성공·Active·단일 SSH 응답을 확인했다. API의 거부는 정상이며 UI 후보 검증 문제다. 31 추가 VPC는 공인 IP 풀 고갈로 환경 차단되었으므로 양쪽 실제 재현으로 확대하지 않는다.

[후보 캡처](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1554-guest-networks/docs/validation/guest-network-1569-vpn-roles-lb-20261110/screenshots/32-vpc-public-lb-internal-tier-candidate.jpg) · [실제 431](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1554-guest-networks/docs/validation/guest-network-1569-vpn-roles-lb-20261110/screenshots/32-vpc-public-lb-invalid-tier-rejected.jpg) · [보정 성공](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1554-guest-networks/docs/validation/guest-network-1569-vpn-roles-lb-20261110/screenshots/32-vpc-public-lb-created.jpg).

### UI 설계
- `LoadBalancing.vue.fetchNetworks`의 `supportedservices=Lb`만으로 허용하지 않는다. 실제 `listNetworks.service`의 Lb capability `LbSchemes`에 `Public`이 포함되고 연결 오퍼링의 Lb provider가 일치하는 Tier만 후보/기본값으로 허용한다. 현재 API에 없는 `supportspubliclb`나 의미가 다른 `supportspublicaccess`를 Public LB 판정으로 사용하지 않는다. `VpcTiersTab.showIlb`의 Internal 가드와 기준을 맞춘다. **API/Java/DB/권한 정책 변경 없음**.
- 페이지별 필터 후 잘못된 총계·빈 페이지가 생기지 않게 적합 후보 조회/페이지 수를 함께 관리한다. 후보 없음·오퍼링 조회 실패를 구분하고 제출을 차단하며 재조회 아이콘+텍스트 버튼을 제공한다.
- Tier 변경 시 그 Tier와 다른 NIC 선택을 해제한다. 기존 이름/포트/CIDR 입력은 보존한다. 제출 직전 VPC·프로젝트·Tier·NIC·역할의 최신 문맥을 다시 검사한다. 전환 시작/늦은 응답에서 이전 후보와 콜백을 폐기한다.
- 기존 VM 표준 MoldDialog·세로 폼·고정 footer·본문 스크롤을 유지한다. 390/768/1280, 즉시 테마, breadcrumb/탭 이동, 프로젝트 왕복을 검증한다.

### 완료 기준
- [ ] 32 실제 UI에서 Internal 전용 Tier가 Public LB 후보/기본값에 없고 Public Tier의 새 규칙/NIC 연결이 성공한다.
- [ ] 누락/조회 실패/전환/오래된 응답 시 잘못된 제출 0, 입력 보존 및 재조회 복구.
- [ ] 31은 준비된 기존 자원/공인 IP 확보 조건을 구분해 검증한다. 보관 자원을 임의 해제하지 않는다.
- [ ] 일반 구성원·도메인 관리자·읽기 전용·비회원의 UI/API 권한을 유지한다. LB 백엔드 부하분산 측정은 제외한다.
- [ ] 기존 Epic 브랜치/PR에 구현·31/32 배포 증거·실제 UI 캡처·잔여 범위를 반영한다.
