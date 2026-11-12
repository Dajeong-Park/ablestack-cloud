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

# 확인용 시험 자원

관리자로 로그인한 뒤 아래 프로젝트를 선택한다. 이번 시험에서 기존 자원과 새 자원을 삭제하지 않았다. 새 빈 VPC의 접속 생성 성공과 VPN 터널 통신 성공은 별도 판정이다.

| 클러스터 | 프로젝트 | VPC | 고객 GW / 접속 |
|---|---|---|---|
| 31 | qa-gn1569-31-shared-reg | [qa-gn1610-31-review](http://10.10.31.10:8080/client/#/vpc/a2b8d28d-5e89-4056-ac77-573d88b14503?tab=vpnc), 10.238.31.0/24, GW 10.10.31.150 | [qa-gn1610-31-peer-32](http://10.10.31.10:8080/client/#/vpncustomergateway/be5dabcd-5e6c-44c7-80f9-865ae7b31d98) / [접속](http://10.10.31.10:8080/client/#/s2svpnconn/a2222e04-c9d8-4526-8954-a93bbc988949), Passive=True |
| 32 | qa-gn1569-32-shared-reg | [qa-gn1610-32-review](http://10.10.32.10:8080/client/#/vpc/8f2df5ac-af30-4633-b663-aae8e8cab356?tab=vpnc), 10.238.32.0/24, GW 10.10.32.149 | [qa-gn1610-32-peer-31](http://10.10.32.10:8080/client/#/vpncustomergateway/bc651b18-0ffb-45c7-b24c-45f53047d9a0) / [접속](http://10.10.32.10:8080/client/#/s2svpnconn/8b069d60-b00c-495e-8952-8f2f12823c35), Passive=False |
| 32 | qa-gn1569-32-shared-reg | [qa-gn1610-32-recovery-review](http://10.10.32.10:8080/client/#/vpc/1468145f-80bd-4682-a2d3-715381a5ba21?tab=vpngw), 10.237.32.0/24, GW 10.10.32.148 | 실제 응답 유실·동일 job 복구 검증 전용 |

31의 qa-gn1610-31-review와 32의 qa-gn1610-32-review는 고객 GW와 VPN 접속을 각1개 보관한다. 32 recovery-review는 GW1개만 보관한다. 각 VPC에 전용 tier/라우터가 있으며 새 VM은 생성하지 않았다.

기존 #1569 S2S Connected / Remote VPN Running과 VM/NIC, AS/LB 및 VPN 키를 보존했다. 신규 VPC의 터널 상태는 [31](evidence/31-preserved.json) / [32](evidence/32-preserved.json)에 기록하며 새 터널의 실제 통신 정상은 이번 이슈 완료 범위로 계산하지 않는다.
