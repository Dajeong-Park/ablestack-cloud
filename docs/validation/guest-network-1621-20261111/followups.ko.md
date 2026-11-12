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

1. **완료 #1621:** 동일 VPN 설정의 불필요한 xl2tpd 재시작을 제거했다. 31·32 API/UI·실제 PPP/통신·철회/복구·실제 키/범위 변경·새 VR 부팅을 확인했다. #1620 권한 수정도 유지된다.
2. **다음 #1619:** SSL 버튼의 실제 역할 가드와401/비동기 실패 후 복구, VM 표준 대화상자·모바일 폭/다크 가독성을 개선한다.
3. **#1622:** 커스텀 프로젝트 역할의 서명 SSL 조회가 projectid 지정 때401인 문맥 순서를 조사·개선한다. 기존 보안 정책을 확대하지 않는다.
4. **#1624:** VR 내장 HAProxy 건강 검사의 SSL bind 옵션 오판정을 개선한다. 실제 문법/TLS/endpoint 오류를 구분하고 경고 이력을 삭제하지 않는다. 외부 제공자 기반 LB Health Monitor와 별개다.
5. **#1569 준비된 잔여:** 역할·CA/체인/만료·TLS/오퍼링 조합·동시 VPN 클라이언트/철회 조합을 검증한다. LB 분산/성능 측정은 제외한다.
6. **환경 조건과63행 통합:** 별도 제공자가 없는 Health Monitor 정상/복구는 환경 차단을 유지한다. 실제 준비된 조건부터 수행한다.

P09는 #1621 완료로 실패→부분이다. C06/P07은 #1619, C07은 #1622가 남아 실패를 유지하며 P07에는 #1624를 추가한다. 전체 실패3·부분51·환경차단6·적용제외3·완료0이다. Epic/#1569/Draft PR #1577은 유지하고 시험 자원은 별도 삭제 지시 전까지 보관한다.
