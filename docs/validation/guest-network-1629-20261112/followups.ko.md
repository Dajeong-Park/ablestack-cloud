<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
 -->

# 완료 판정과 후속 순서

이슈 #1629 구현·양쪽 배포·수정 전후 역할 UI/API·실제 통신 회귀를 완료했다. 결과 게시 후 이 이슈만 completed로 닫고 Epic #1554·통합 회귀 #1569 OPEN, PR #1577 Draft를 유지한다.

1. **#1631**: 32번 keepMAC=true 도메인 단독 변경·VR 재구현에서 Public MAC이 바뀌는 문제를 수정하고31/32 API·실제 runtime/NIC·통신으로 확인.
2. **#1632**: 정상 CRL/서명 OCSP가 준비된 기본 SSL 폐기 검사 chain530 경로를 수정하고 실제 문법·정책/TLS·역할 회귀.
3. **#1569**: 위 영향·잔여 지원 조합을 통합하고63행을 재평가. 기존 #1586와 환경 조건은 별도 유지.

이번 C07/S05/M02의 #1629 실패는 양쪽 모두 부분으로 갱신한다. 관련 미실행 유형/역할/조건 전체를 완료로 올리지 않는다. 최신63행 집계는 **31 실패1/부분53/환경6/제외3,32 실패5/부분49/환경6/제외3, 전체 행 완료0**이다. 남은 제품 이슈2개와 조건부 미실행 항목 때문에 #1569를 지금 닫지 않는다.

현재 확인용 시험 자원을 보관하며 추가 사용자 조치는 필요하지 않다. 독립 VPN client2대, 별도 Health Monitor 제공자, IPv6/BGP/외부DNS·스위치 trunk 등 기존 환경 조건을 통과로 바꾸지 않는다. LB 백엔드 부하분산 측정 제외 조건도 유지한다. 이번에는 전체 Epic 병합 요청이 없어 기존 브랜치/PR에 누적한다.
