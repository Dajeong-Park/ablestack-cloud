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

1. **[완료] #1611 → #1614 → #1612(UI) → #1613(UI) → #1616:**31 자원 부족 원인/재진입/Shutdown 잔류 수정,31·32 실제 할당/런타임/NIC와 실패 재시도 확인.
2. **[다음] #1617:** 같은 Tier·같은 Source IP의 다른 포트 생성537. Long ID 값 비교로 수정하고32에서도 같은 VIP 재현/해소·기존 controller 재사용·충돌 거부를 검증한다. [31 요청/응답](evidence/31-same-ip-different-port-537-api.json) · [배포 bytecode](evidence/same-ip-conflict-bytecode.json) · [입력 보존 캡처](screenshots/31-same-ip-different-port-537-retained-input.jpg).
3. **#1569 준비된 잔여 회귀:** owner 전용 VPN 사용자/서비스 철회의 나머지 역할 조합, LB SSL/오퍼링·잔여 backend/NIC 조건 → 준비된 조건부터 실행 →63행 통합 판정. 제공자 없는 Health Monitor 정상/복구는 사용자 답변에 따라 환경 차단, LB 분산/성능 측정 제외.
4. **기존 UI 테스트 정비:** 동기화 전부터 재현한5 suite/9검사의 owner ready/Modal/프로젝트 이벤트 문맥 계약은 별도 정비 범위다. #1616을 위해 테스트를 약화하지 않았다.

P05는31 신규537로 실패,32 같은 IP 시험 미실행으로 부분을 유지한다. P06의 최초 시작 실패는 해소했지만 모든 역할/다중 NIC/IP 조합 완료는 아니므로 양쪽 부분이다. 최신31 실패1·부분53·환경차단6·적용제외3·완료0,32 실패0·부분54·환경차단6·적용제외3·완료0. Epic #1554/#1569와 Draft PR #1577은 Open 유지한다. 확인용 자원은 사용자 삭제 지시 전까지 보존한다.
