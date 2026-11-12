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

# 남은 항목과 해결 순서

1. **#1611 완료**: Public 후보·오퍼링 적합성·기존 NIC 선택 초기화·전환/늦은 응답·VM 표준 UI. 31 신규 VPC 생성의 환경 제한은 명시했다.
2. **#1614 다음**: 읽기 전용 Public/Internal backend 해제 버튼 비활성/핸들러/오류 종료를 기존 API 보안 정책과 일치시킨다. 현재 로컬 권한 검사/실제 POST0·직접 API 거부가 유지되므로 보안 우회로 집계하지 않는다.
3. **#1612**: Internal LB 실제431 실패의 입력 보존·비동기 상태·VM MoldDialog/고정 footer 적용.
4. **#1613**: ACL ID/name 없는 Tier의 빈 링크를 대시로 표시하고 유효 ACL 이동은 유지.
5. **#1569 준비된 잔여 조건**: owner/VPN 서비스 자체 철회, LB SSL·오퍼링 조합 등 미실행 역할/서비스 조건을 증적으로 통합한다. LB 백엔드 분산 측정은 사용자 제외 범위다.
6. **환경 준비 후**: 31 신규 VPC/Internal 공인IP, 제공자 없는 Health 정상/복구, PVLAN OvS·IPv6/Routed·BGP/외부 DNS 조건. 없는 환경을 성공으로 집계하지 않는다.
7. 63행의 상세 조건을 모두 판정한 뒤 #1569/Epic 완료를 결정한다. 현재 #1554·#1569와 Draft PR #1577은 Open 유지다.

P05의32 후보 결함만 실패→부분으로 갱신한다. 31은 실패2(C06/P06)·부분52·환경차단6·적용제외3, 32는 실패3(C06/I03/P06)·부분51·환경차단6·적용제외3이다. 전체 완료 행은0이다. C06/P06에는 #1614, I03에는 #1613이 남아 있다.
