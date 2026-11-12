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

이번 #1628은 스키마 보정·실제 재시작에서 발견한 CSV 해석 결함 수정·양쪽 배포·UI/API/DHCP/기존 NIC 회귀를 완료했다. 결과 게시 후 completed로 종료한다. Epic #1554와 통합 회귀 #1569는 OPEN, PR #1577은 Draft를 유지한다.

1. **#1629**: 특정 프로젝트에 공유된 Shared IP 조회의 owner/member/readOnly 권한531 정합화·UI/API 역할 회귀.
2. **#1631**:32 keepMAC=true 도메인 단독 변경·VR 재구현 후 Public MAC 보존·실제 통신.
3. **#1632**: 정상 CRL/서명 OCSP 조건에서 기본 SSL 폐기 검사 chain530 수정·정책/TLS 회귀.
4. **#1569**: 위 영향과 잔여 지원 조합·기존 #1586·환경 조건을 통합한63행 최종 재평가.

32 S06은 실패→부분으로 갱신한다. IPv4 다중 서브넷의 CRUD·NIC·DHCP·재시작은 통과했지만 IPv6 등 미구성 조합이 남으므로 전체 행 완료로 올리지 않는다.31은 실패4/부분50/환경6/제외3,32는 실패8/부분46/환경6/제외3, 전체 행 완료0이다. 남은 신규 제품 결함3개와 조건부 범위 때문에 #1569를 지금 닫지 않는다.

확인용 자원은 보관한다. 현재 #1628 완료를 위해 추가 사용자 조치는 필요하지 않다. 독립 VPN client2대·별도 Health Monitor 제공자·IPv6/BGP/외부DNS 등 기존 환경 조건을 통과로 바꾸지 않는다.
