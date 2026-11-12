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

별도 삭제 지시 전까지 보관한다. 각 프로젝트를 먼저 선택한다. 새 S2S와 기존 VPN/VM을 재사용할 수 있다.

| 클러스터 | 직접 UI 링크 | 보관 상태 |
| --- | --- | --- |
| 31 | [원격 VPN](http://10.10.31.10:8080/client/#/publicip/ea568ffa-ed12-4d07-b174-f12f3fe80bd2?tab=vpn) | 10.10.31.148 / Running / 사용자 qa-gn1569-31-vpn / 기본 PSK 마스킹 |
| 31 | [VPC VPN GW](http://10.10.31.10:8080/client/#/vpc/86950275-e6b6-4790-8bc9-bee82ab173c7?tab=vpngw) | qa-gn1569-31-svc-review / 10.10.31.146 |
| 31 | [S2S 연결](http://10.10.31.10:8080/client/#/s2svpnconn/84f5597c-c4f8-4a3d-ad60-05e2ff02b76b) | Connected / Passive=True / IKEv2 AES256-SHA256 |
| 31 | [고객 GW](http://10.10.31.10:8080/client/#/vpncustomergateway/00e7cd48-749a-47cc-88fd-f8658c3f0779) | qa-gn1569-31-s2s-peer-32 |
| 31 | [시험 VM NIC](http://10.10.31.10:8080/client/#/vm/4d8dc91e-db04-4d4a-b53b-0275fe680e67?tab=nics) | qa-gn1569-31-shared-reg-vm24 / Running / 라우터와 같은 호스트 10.10.31.3 |
| 32 | [원격 VPN](http://10.10.32.10:8080/client/#/publicip/d286ca9d-1d48-42e7-8dac-ff2e73fe3c46?tab=vpn) | 10.10.32.150 / Running / 사용자 qa-gn1569-32-vpn / 기본 PSK 마스킹 |
| 32 | [VPC VPN GW](http://10.10.32.10:8080/client/#/vpc/545de2b6-04d7-4815-b8d2-8a29e96d94f1?tab=vpngw) | qa-gn1569-32-svc-review / 10.10.32.151 |
| 32 | [S2S 연결](http://10.10.32.10:8080/client/#/s2svpnconn/89e9cb02-102d-4db2-81e1-014744f38675) | Connected / Passive=False / IKEv2 AES256-SHA256 |
| 32 | [고객 GW](http://10.10.32.10:8080/client/#/vpncustomergateway/7ef8f752-4744-4085-b016-11e159c0ff72) | qa-gn1569-32-s2s-peer-31 |
| 32 | [시험 VM NIC](http://10.10.32.10:8080/client/#/vm/dc8437d4-834a-4120-8958-d501fb96895a?tab=nics) | qa-gn1569-32-shared-reg-vm24 / Running / 라우터와 같은 호스트 10.10.32.2 |

S2S/고객 GW 목록·상세의 기본 PSK 노출은 #1609 미해결이다. 공개 증적은 해당 열을 제외했다. 실제 PSK/사용자 암호는 게시하지 않는다. 시험 ACL은 상대 VM /32의 ICMP·TCP22만 추가했고 기존 규칙/기본 경로를 보존했다. WSL 임시 클라이언트/호스트 제어 IP는 정리했으며 Mold 시험 자원은 유지한다.
