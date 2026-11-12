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

# 후속 순서와 남은 항목

1. **[완료] #1616 → #1617:** Internal LB 최초 시작/실패 복구에 이어 같은 VIP의 다른 포트 생성537을 수정했다. 양쪽 UI/API job8·기존 controller/NIC/HAProxy 재사용과 충돌 거부를 확인했다.
2. **[다음] #1569 준비된 잔여 통합 회귀:** owner 전용 VPN 사용자/서비스 철회의 미실행 역할 조합, LB SSL/오퍼링·다중 NIC/IP 조건부터 진행한다. 시험 자원은 보존한다.
3. **#1618 UI 가독성:** Internal LB 상세 ‘부하 분산 규칙’의 원시 JSON을 VM 표준의 포트/상태 값으로 표현한다. 현재 값/기능은 맞으며 이번 서버 수정과 분리한 비차단 개선이다. [31 실제 화면](screenshots/31-final-same-vip-rule-details.jpg) · [32 실제 화면](screenshots/32-final-same-vip-rule-details.jpg).
4. **환경 준비 후 조건부/63행 통합:** 제공자 없는 Health Monitor 정상·복구는 사용자 답변에 따라 환경 차단, LB backend 분산·성능 측정은 제외한다. 미구성 제공자/IPv6·BGP 등의 조건을 완료로 확대하지 않는다.

P05의31 생성537 실패를 해소해 양쪽 부분으로 갱신했다. 현재 양쪽 실패0·부분54·환경차단6·적용제외3·완료0. Epic #1554/#1569와 Draft PR #1577은 Open을 유지한다. 이전 UI 동기화에서 기록한5 suite/9검사의 기존 테스트 계약 정비는 이번23검사/2 suite 통과와 별개다.
