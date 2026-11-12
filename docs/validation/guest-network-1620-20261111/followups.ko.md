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

1. **완료 #1620**: 실제 LB 소속 기반 SSL assign/remove 권한 검사. 31·32 API/UI·활성 JAR/최종 TLS 검증. 구현 범위 종료.
2. **다음 #1621**: LB SSL 적용 때 동일 VPN 설정도 다시 쓰며 xl2tpd를 재시작하는 원인을 수정하고 지속 VPN 통신·DHCP/DNS·실제 서비스 변경을 구분해 재검증한다. 이번 작업의 거부 요청은 설정/PID를 바꾸지 않았지만 허용 요청의 VPN 연속성은 별도다.
3. **#1619**: SSL 변경 버튼을 실제 프로젝트 역할에 맞게 가드하고401/비동기 실패 후 재시도 가능하게 복구한다. VM 표준 대화상자와 모바일 폭/다크 가독성으로 재배치한다.
4. **#1622**: 커스텀 프로젝트 역할의 서명 listSslCerts가 projectid 지정 때만401인 문맥 순서를 조사한다. 세션/서명·생략/일치·기본/커스텀 역할·키 제한을 분리하고 전역 정책 확대 없이 개선한다. 이번에 발견한 증상이며 원인과 수정 전 발생 여부는 미확정이다.
5. **#1569 잔여**: 준비된 역할·TLS 인증서 CA/체인/만료·오퍼링 서비스 조합과 동시 클라이언트/철회 조합을 순서대로 확인한다. LB 분산/성능 측정은 제외한다.
6. **환경 조건과63행 통합**: Health Monitor 정상/복구는 별도 제공자가 없다는 사용자 답변에 따라 환경 차단을 유지한다. 다른 조건부 항목도 실제 환경이 갖춰진 것부터 실행한다.

C06/P07은 #1619, P09는 #1621, C07은 #1622가 남아 실패4·부분50·환경차단6·적용제외3·완료0이다. #1620 완료를 Epic/#1569 전체 완료로 확대하지 않는다. 기존 Epic 브랜치와 Draft PR #1577을 유지하며 확인용 자원은 삭제 지시 전까지 남긴다.
