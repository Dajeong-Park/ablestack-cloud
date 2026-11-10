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

관리자 계정으로 각 프로젝트 `qa-gn1569-31-shared-reg` / `qa-gn1569-32-shared-reg`를 먼저 선택한다. 자원은 삭제하지 않았다. 비밀번호·PSK는 이 문서에 보관하지 않는다.

| 클러스터 | 자원 | 직접 UI 링크 / 상태 |
| --- | --- | --- |
| 31 | VPN 사용자 4개(기존1+전용3) | [VPN 사용자](http://10.10.31.10:8080/client/#/vpnuser), 철회용 `qa-gn1569-31-vpn-revoke` 복구 보관 |
| 31 | Isolated LB 새 규칙 `qa-gn1569-31-role-lb-review` | [Public IP 10.10.31.149 LB](http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing), TCP18969→22 |
| 31 | 기존 Remote VPN | [Public IP 10.10.31.148](http://10.10.31.10:8080/client/#/publicip/ea568ffa-ed12-4d07-b174-f12f3fe80bd2), Running·기존 키 보존 |
| 31 | 새 제한 계정/프로젝트 역할 | `qa-gn1569-31-vpn-lb-readonly`, 32개 변경 명령 deny, 기존 역할 그대로 |
| 32 | VPN 사용자 4개(기존1+전용3) | [VPN 사용자](http://10.10.32.10:8080/client/#/vpnuser), 철회용 `qa-gn1569-32-vpn-revoke` 복구 보관 |
| 32 | Isolated LB 새 규칙 `qa-gn1569-32-role-lb-review` | [Public IP 10.10.32.177 LB](http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing), TCP18969→22 |
| 32 | 기존 Remote VPN | [Public IP 10.10.32.150](http://10.10.32.10:8080/client/#/publicip/d286ca9d-1d48-42e7-8dac-ff2e73fe3c46), Running·기존 키 보존 |
| 32 | 새 제한 계정/프로젝트 역할 | `qa-gn1569-32-vpn-lb-readonly`, 32개 변경 명령 deny, 기존 역할 그대로 |
| 32 | 새 VPC·Public/Internal Tier | [qa-gn1569-32-lb-int-reg](http://10.10.32.10:8080/client/#/vpc/91c180fc-6f94-4a64-a875-49697b0f3266?tab=tier), 10.236.32.0/24 |
| 32 | 새 시험 VM / NIC2 | [qa-gn1569-32-lb-int-reg-vm](http://10.10.32.10:8080/client/#/vm/f2f65780-56e0-405e-b471-7a077e3045df?tab=nics), Running·32.1·10.236.32.36/79 |
| 32 | 새 VPC Public LB | [10.10.32.178](http://10.10.32.10:8080/client/#/publicip/0c63eaff-c372-4084-8586-a9a590faf9bb?tab=loadbalancing), TCP18971→22 |
| 32 | 새 Internal LB | [qa-gn1569-32-ilb-review](http://10.10.32.10:8080/client/#/ilb/025c3afd-55ec-4e70-bf2c-339bc7e1ac5c),10.236.32.85:18973→22 |
| 32 | 새 Internal LB VM | [b-480-VM](http://10.10.32.10:8080/client/#/ilbvm/aa36d646-6c13-4bac-b0fd-25067ae6568b), Running·32.1 |

31 새 LB는 선택 NIC1개/Active와 별도 TCP18969 방화벽 규칙을 보관한다. 32 Isolated 새 규칙은 규칙만 생성(Add) 상태이며 VPC Public/Internal은 실제 NIC를 연결했다. 각 VPN member/domainadmin/revoke 사용자3개를 남겼다. 시험 클라이언트의 WSL charon/xl2tpd/PPP69와 임시 VPN 경로만 정리했다.

기존 31 망116/VM158/AS6, 32 망100/VM85/AS7의 ID·NIC·호스트·설정과 기존 LB33/20·VPN/S2S 상태·프로젝트 멤버십은 보존됐다. 최종 31 망116/VM158/VPC12·VPN사용자4·전역PublicLB34, 32 망102/VM86/VPC13·VPN사용자4·전역PublicLB22+InternalLB1이다. 기존 S2S Connected 연결과 별도 #1610 Disconnected 확인 자원을 구분한다.
