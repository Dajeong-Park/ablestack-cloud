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

# 후속 해결 순서

1. [#1611 VPC Public LB 후보 적합성](https://github.com/ablecloud-team/ablestack-cloud/issues/1611): 실제 network.service의 LbSchemes Public과 오퍼링 provider를 기준으로 후보/선택/제출을 검증한다. 현재 API에 없는 supportspubliclb나 의미가 다른 supportspublicaccess에 의존하지 않는다.
2. [#1614 읽기 전용 backend 해제 UI 가드](https://github.com/ablecloud-team/ablestack-cloud/issues/1614): 버튼/핸들러/오류 종료를 기존 API 정책과 맞추고 연결 보존·허용 역할 동작을 확인한다.
3. [#1612 Internal LB 생성 실패 입력 보존·비동기 상태·VM 표준](https://github.com/ablecloud-team/ablestack-cloud/issues/1612): #1610 패턴을 적용한다. 실제431 실패와 비동기job2/불확실 검증을 구분한다.
4. [#1613 VPC Tier ACL 빈 링크](https://github.com/ablecloud-team/ablestack-cloud/issues/1613): id 없음은 대시, 유효 id는 실제 링크를 보존한다.
5. #1569에서 위 수정의 양쪽 역할/UI·기존 NIC/서비스 회귀를 통합한다. 준비된 owner 전용 VPN/LB 변경, VPN 서비스 철회/재활성화의 추가 역할 조합, SSL 인증서 교체/제거·backendssl 등 오퍼링 상세 조건을 우선한다. LB 분산 측정은 제외한다.
6. 31 추가 VPC/Internal LB는 공인 IP가 준비되면 실행한다. Health Monitor 정상 상태/복구는 제공자 준비 후, PVLAN OvS·IPv6·Routed/BGP·외부 DNS 등은 실제 환경 조건이 충족된 항목부터 실행한다.
7. 63행의 미실행 조건을 각각 증적으로 닫은 뒤 #1569/Epic 완료를 판정한다. 지금은 새 결함/환경 조건을 남겨 Open을 유지한다.

네 이슈는 모두 Epic #1554의 실제 하위 이슈로 연결했고 설계·재현·완료 기준을 포함했다. 기존 Epic 브랜치와 Draft PR #1577을 계속 사용한다.
