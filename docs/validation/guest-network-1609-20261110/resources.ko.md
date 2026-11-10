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

기존 자원을 재사용했고 생성·삭제·VPN 키 변경 없이 보관했다. 관리자 로그인 후 각 프로젝트를 선택한다.

| 클러스터 | 프로젝트 | 고객 게이트웨이 | VPN 연결 |
|---|---|---|---|
| 31 | qa-gn1569-31-shared-reg | [qa-gn1569-31-s2s-peer-32](http://10.10.31.10:8080/client/#/vpncustomergateway/00e7cd48-749a-47cc-88fd-f8658c3f0779?tab=details) | [S2S 상세](http://10.10.31.10:8080/client/#/s2svpnconn/84f5597c-c4f8-4a3d-ad60-05e2ff02b76b?tab=details) |
| 32 | qa-gn1569-32-shared-reg | [qa-gn1569-32-s2s-peer-31](http://10.10.32.10:8080/client/#/vpncustomergateway/7ef8f752-4744-4085-b016-11e159c0ff72?tab=details) | [S2S 상세](http://10.10.32.10:8080/client/#/s2svpnconn/89e9cb02-102d-4db2-81e1-014744f38675?tab=details) |

- 31: [VPC VPN 표](http://10.10.31.10:8080/client/#/vpc/86950275-e6b6-4790-8bc9-bee82ab173c7?tab=vpnc), [Remote Access VPN](http://10.10.31.10:8080/client/#/publicip/ea568ffa-ed12-4d07-b174-f12f3fe80bd2?tab=vpn). 보관 검사: [JSON](evidence/31-preserved.json).

- 32: [VPC VPN 표](http://10.10.32.10:8080/client/#/vpc/545de2b6-04d7-4815-b8d2-8a29e96d94f1?tab=vpnc), [Remote Access VPN](http://10.10.32.10:8080/client/#/publicip/d286ca9d-1d48-42e7-8dac-ff2e73fe3c46?tab=vpn). 보관 검사: [JSON](evidence/32-preserved.json).

전역 목록은 31번 기존 157대에서 158대로 늘었다. 추가된 rocky-95-airgap-repo-test는 이번 절차에서 생성하지 않았고, 기존 157대와 NIC가 동일함을 확인했다. 추가 VM도 변경하거나 삭제하지 않았다.
