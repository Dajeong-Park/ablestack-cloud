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

# upstream 통합·검증 및 종료 범위

upstream 239d2d243f6bd2fb713e7e0cc404385209e9a086을 검증된 Epic 8aa09ec46d02c72f0cde0adabd4fe4ddef3dc271에 병합한 소스 커밋은 a2d86317cbc47cc0bd7cd66ae1e8c8f06c22f01a다. 충돌 없는 Epic 파일16,268개를 유지한 [감사](evidence/source-preservation-audit.json)를 남겼다.

| 충돌 파일 | 처리 |
| --- | --- |
| en.json·ko_KR.json | base 대비 Epic 수정 값 유지, upstream 단독 변경/신규 키 수용 |
| InfoCard.vue | 네트워크와 SharedFS Capacity/Boot Recovery 함께 등록 |
| ListView.vue | VpnPsk 마스킹과 SharedFS cell 분기 함께 유지 |
| listRefreshMixin.js | detailTabRouteKey와 upstream requestScope 결합 |
| AutogenView.vue | 공통 content-breadcrumb 스크롤·네트워크 UI/권한/정렬 유지, SharedFS toolbar/runtime catalog/loading 결합 |

fixture5개는 현재 실제 컴포넌트 훅·속성·설정 보존 및 SharedFS static guard 의존성에 맞게 보정했다. 테스트를 위해 production 동작을 바꾸지 않았다. 기존 로그/CRLF의 전체 whitespace 경고를 없애는 대규모 정규화는 하지 않고 충돌 해결·fixture 변경 파일의 diff 검사를 통과했다.

| 로컬 WSL ext4 확인 | 결과 | 근거 |
| --- | --- | --- |
| UI unit | 106 suite·1,630개 검증 | [최종](evidence/merge-ui-final-checks.json) |
| ESLint | production4·fixture4개 통과 | [최종](evidence/merge-ui-final-checks.json) |
| UI production build | exit0·12GiB heap·661초 | [빌드](evidence/merge-ui-build-final.json) |
| Java focused regression | 226개 통과 | [기존125개/초기 실행](evidence/merge-java-tests.json)·[최종 orchestration101개](evidence/merge-orchestration-tests.json) |
| api/schema/orchestration/server install | 4모듈 BUILD SUCCESS | [모듈 빌드](evidence/merge-module-build.json) |

UI는105 suite/1,617개 통과 후 마지막 bucket fixture 추출 실패를 수정해13개를 재실행했다. 그 사이 production hash가 동일함을 확인했다. Java는 최초 orchestration fixture 실패를 수정해101개를 재실행했고 나머지125개는 앞선 통과 결과다. 처음부터 단일 실행에서 모두 통과했다고 표시하지 않는다. UI6GiB build는 heap 예산 조정을 위해 중단하고12GiB로 성공했다. 전체 Cloud 빌드·수동 Actions는 실행하지 않았다. GitHub 등록 checks와 로컬 검사는 구분한다.

31·32 활성 배포본은 backend f7097be4d98bd94258120694d3a1fcbaf549209e, UI22ba7f5eab604aa4840fb7decc686d3e3192ba22 / app.e01a5204.js다. 이번 병합·자원 정리에서 재배포/서비스 재시작을 하지 않았다. 양쪽675 static asset·JAR class hash·PID·WEB-INF·HTTP200을 확인했다. 병합 소스의 로컬 검사와 기존 배포본의 실제 통신 검증을 구분한다.

## 범위와 독립 후속

준비된 기능·보안 결함의 수정/검증이 종료 대상이다. 원래63행의 모든 제공자·프로토콜·역할·배치 조합을 전부 실행한 것으로 바꾸지 않는다. [기존 행별 근거](../guest-network-1569-role-conditional-20261112/coverage.ko.md)와 [미실행 범위](../guest-network-1569-role-conditional-20261112/closure-preparation.ko.md)를 보존한다.

조건부 검증 #1636은 IPv6/DualStack, BGP/routed, 외부 DNS, Netscaler/Tungsten Health Monitor, 명시적 OvS PVLAN, 독립 외부 VPN client2대, switch guest VLAN trunk, live redundant VR, 폐기 가능한 Kubernetes 소유 fixture를 추적한다. Linux Bridge의 PVLAN 거부를 OvS 격리 성공으로 바꾸지 않는다. 별도 Health Monitor 제공자와 외부 client가 없다는 사용자 답변을 반영했다. 동일 호스트 패킷 결과를 cross-host trunk 검증으로 확대하지 않는다.

UI 후속 #1634·#1635는 독립 P3 UI로 남기며 중요 결함/종료 차단으로 분류하지 않는다. #1586은 별도 자원 정리 결함으로 유지한다. 원래 설계와 증거를 보존했다. 자원 부족·정상 참조 보호·잘못된 시험 입력은 선행 조건/시험 절차로 관리하고 실제 제품 결함이 재현될 때만 수정 이슈로 등록한다. LB backend 부하분산/부하 측정은 사용자 요청대로 제외했다.
