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

# 확인용 시험 자원

각 프로젝트를 먼저 선택한다. 기존 네트워크·VM·VPN·AutoScale 그룹과 아래 새 LB5개를 양쪽 모두 보관했다. 사용자 삭제 지시 전까지 정리하지 않는다.

| 클러스터 | 화면 | 자원 |
| --- | --- | --- |
| 31 | [부하 분산 탭](http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing) | 프로젝트 `qa-gn1569-31-shared-reg` · IP 10.10.31.149 |
| 31 | `qa-gn1606-31-default` | af2b39fa-8654-4652-a738-4ea1d899a259 · 18876→22 · Add · backend 0 |
| 31 | `qa-gn1606-31-switch` | 175e86ab-42f3-4d68-ab84-ae24f50ca9ad · 18877→22 · Add · backend 0 |
| 31 | `qa-gn1606-31-manual` | 96ac0cc4-620e-444a-add8-8d8fdf85e7c2 · 18878→22 · Active · backend 1 |
| 31 | `qa-gn1606-31-later` | 996d5302-e08a-44b7-974c-ecf8013c7fac · 18879→22 · Add · backend 0 |
| 31 | `qa-gn1606-31-retry` | a9450fb1-2203-4336-ae04-ee029eea8327 · 18880→22 · Add · backend 0 |
| 31 | [기존 시험 VM NIC](http://10.10.31.10:8080/client/#/vm/551067c6-fbfb-40df-8313-037e21de78cf?tab=nics) | qa-gn1569-31-vpn-lb-vm · Running · ablecube31-3 |
| 32 | [부하 분산 탭](http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing) | 프로젝트 `qa-gn1569-32-shared-reg` · IP 10.10.32.177 |
| 32 | `qa-gn1606-32-default` | d337c44d-bce7-4c6a-af70-e2ff1a06e170 · 18876→22 · Add · backend 0 |
| 32 | `qa-gn1606-32-switch` | 4dca1289-7751-49ab-9a91-a26c06dbf6af · 18877→22 · Add · backend 0 |
| 32 | `qa-gn1606-32-manual` | 0bcd8fa5-04b8-40ff-84b8-dd6c705f9ae0 · 18878→22 · Active · backend 1 |
| 32 | `qa-gn1606-32-later` | 3b076f53-ed54-46a6-83b1-a69f2aaffd89 · 18879→22 · Add · backend 0 |
| 32 | `qa-gn1606-32-retry` | 00a8861d-0db4-465e-a656-ebdc376f82d5 · 18880→22 · Add · backend 0 |
| 32 | [기존 시험 VM NIC](http://10.10.32.10:8080/client/#/vm/e3ddbdd1-ccd7-4299-9461-a33d25d6b645?tab=nics) | qa-gn1569-32-vpn-lb-vm · Running · ablecube32-2 |

공통 Source CIDR 10.10.0.0/16, TCP/roundrobin. 새 AutoScale VM 그룹을 만들지 않았으며18876·18877·18880은 backend0인 빈 규칙이다. 수동18878만 기존 VM1개 연결,18879는 나중에 연결이다. 최종 리뷰 창의18881은 캡처용 미제출 입력이며 생성된 자원이 아니다. 기존 AS그룹은 DISABLED/Running 멤버1, VPN은 Running, 기존18871/18873/18874도 유지한다. [31 최종 API/VR](evidence/31-final-verification.json) · [32 최종](evidence/32-final-verification.json).
