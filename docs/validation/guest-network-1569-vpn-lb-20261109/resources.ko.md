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

# 보관한 확인용 시험 자원

프로젝트 `qa-gn1569-31-shared-reg` 또는 `qa-gn1569-32-shared-reg`를 먼저 선택한다. AutoScale 그룹은 비활성화했고 멤버 VM1대와 수동 시험 VM1대는 Running이다. 로그인/PSK/인증서 개인 키는 게시하지 않는다.

| 클러스터 | 화면 | 보관 상태 |
| --- | --- | --- |
| 31 | [qa-gn1569-31-vpn-lb](http://10.10.31.10:8080/client/#/guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb) | Isolated · 10.234.31.0/24 · ablecube31-3 |
| 31 | [10.10.31.148](http://10.10.31.10:8080/client/#/publicip/ea568ffa-ed12-4d07-b174-f12f3fe80bd2?tab=vpn) | Remote Access VPN Running / PSK 마스킹 |
| 31 | [10.10.31.149](http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing) | TCP18871 / AutoScale18873 / SSL18874, 각 Active |
| 31 | [qa-gn1569-31-autoscale](http://10.10.31.10:8080/client/#/autoscalevmgroup/0e6a737c-b23b-40af-9819-c07598c97bce?tab=autoscale.operations) | DISABLED / Running 멤버1 / 최소1·최대2 |
| 31 | [수동 시험 VM](http://10.10.31.10:8080/client/#/vm/551067c6-fbfb-40df-8313-037e21de78cf?tab=nics) | qa-gn1569-31-vpn-lb-vm · Running · VR과 같은 호스트 |
| 32 | [qa-gn1569-32-vpn-lb](http://10.10.32.10:8080/client/#/guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711) | Isolated · 10.234.32.0/24 · ablecube32-2 |
| 32 | [10.10.32.150](http://10.10.32.10:8080/client/#/publicip/d286ca9d-1d48-42e7-8dac-ff2e73fe3c46?tab=vpn) | Remote Access VPN Running / PSK 마스킹 |
| 32 | [10.10.32.177](http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing) | TCP18871 / AutoScale18873 / SSL18874, 각 Active |
| 32 | [qa-gn1569-32-autoscale](http://10.10.32.10:8080/client/#/autoscalevmgroup/d3d3505b-4b5f-49c0-b4a8-cf6d99353ab8?tab=autoscale.operations) | DISABLED / Running 멤버1 / 최소1·최대2 |
| 32 | [수동 시험 VM](http://10.10.32.10:8080/client/#/vm/e3ddbdd1-ccd7-4299-9461-a33d25d6b645?tab=nics) | qa-gn1569-32-vpn-lb-vm · Running · VR과 같은 호스트 |

전체 UUID와 API 상태는 [31 최종](evidence/31-final-verification.json), [32 최종](evidence/32-final-verification.json)을 참조한다. 기존 VPC/Shared/역할/VNF 시험 자원과 AS-PROD는 보존했다. 정책 조정 중 추가 AutoScale 멤버가 생성·제거된 기록은 CPU 정책 결과/이벤트에 남겼다. 사용자 별도 지시 전까지 최종 보관 자원을 삭제하지 않는다.
