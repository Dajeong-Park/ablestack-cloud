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

# 후속 순서와 미완료 범위

1. **[완료] #1611 → [완료] #1614 → [완료] #1612(UI 범위)**. 기존 Epic 브랜치/ Draft PR #1577을 유지한다.
2. **[다음 구현] #1613**: 양쪽에서 ACL 식별자가 없는 Tier의 빈 `#/acllist/undefined` 링크를 대시로 표시하고, 유효 ACL 링크는 유지한다. 이번 신규31 Tier에서도 같은 빈 링크를 관측했다. ACL 패킷 정책 실패로 확대하지 않는다.
3. **#1616**: 31 최초 Internal LB 시작 대기와 warm 대조의 배치 제약을 조사·복구한 뒤 실제 할당 최종 job/runtime을 재검증한다. UI 수정과 서버 시작 성공을 분리한다. 진행 중 job/자원을 보존한다.
4. **#1569 잔여 통합**: owner/VPN 서비스 철회·LB SSL/오퍼링 등 준비된 조건 → 제공자/환경 준비 후 조건부 → 63행 최종 통합. Health Monitor 정상/복구는 별도 Netscaler/Tungsten 제공자 없음으로 환경 차단이며 LB 분산 측정은 제외한다.

이슈 #1612로 C06의 Internal 생성 UI 결함은 해소돼 양쪽 부분이다. #1613 빈 링크를31에서도 실제 관측해 I03은 양쪽 실패로 기록한다. 현재 **양쪽 실패1(I03)·부분53·환경차단6·적용제외3·완료0**이며, P06의31 서버 미완료 #1616을 별도로 명시한다. Epic #1554/#1569 및 Draft PR은 Open 유지한다.
