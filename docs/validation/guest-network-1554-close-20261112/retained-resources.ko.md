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

# 확인용 최신 회귀 자원

[기계 판독 전체 명세](evidence/retained-resources.json). 31 VM/VNF/AS14·망16·VPC3, 32 VM/VNF/AS15·망16·VPC3이다. 기능별 최신 fixture의 기본 NIC·유효 보조 NIC와 참조 중 project/template/offering/ACL/LB/VPN/인증서/역할을 함께 남겼다. 생성 시각만으로 최신 VM 하나만 남기면 서로 다른 기능 회귀를 수행할 수 없어 기능별로 선택했다.

## 31번 VM·VNF·AutoScale

| 이름 | 상태/유형 | UUID |
| --- | --- | --- |
| qa-gn1569-31-nosnat-vm | Running | cae707e9-1851-4ce1-a63c-ecd5173a64f7 |
| qa-gn1597-31-project-vnf | Running | b1a6c573-8c82-4fe8-9537-07e2cd96c1fc |
| qa-gn1569-31-cond-vm11 | Running | 1cdd7204-2b82-4b88-9b39-7e3d9b318117 |
| qa-gn1569-31-cond-vm12 | Running | 2670be1a-f4a0-4d03-b15c-e10a81e3d358 |
| qa-gn1569-31-shared-reg-vm21 | Running | bc8ec9c0-6cdb-4091-afcf-1bd289019fc6 |
| qa-gn1569-31-shared-reg-vm24 | Running | 4d8dc91e-db04-4d4a-b53b-0275fe680e67 |
| qa-gn1569-31-scope-owner-vm | Running | ecdb6b5b-3675-4878-af3b-04252f17a7ea |
| qa-gn1569-31-scope-child-vm | Running | 5adc4475-fc07-403d-ad2a-8e6f95595e47 |
| qa-gn1569-31-scope-outsider-vm | Running | 1f6adf08-ba15-4afb-9f10-69fba5d18bd4 |
| qa-gn1569-31-vpn-lb-vm | Running | 551067c6-fbfb-40df-8313-037e21de78cf |
| qa-gn1616-31-allocated-vm | Running | 95f9dac8-920a-475d-91ff-5bc015c15d0e |
| qa-gn1628-31-subnet-vm26 | Running | 17c683ba-1798-44b0-a4fb-f40572a4b207 |
| qa-gn1569-31-final-functional-vm | Running | f5c1c0a6-6658-4d96-96fc-6324703e2b9e |
| autoScaleVm-qa-gn1607-31-default-1-dsqime | Running | 23f01208-cacd-4ac2-bdf9-39235325e923 |

## 31번 네트워크

| 이름 | 상태/유형 | UUID |
| --- | --- | --- |
| qa-gn1612-31-warm-internal-tier | Isolated | ad1a8462-ed3d-46f6-894e-e630f0484c13 |
| qa-gn1569-31-vpn-lb | Isolated | 43c8f6f5-8893-4a1c-bfaa-a569acaf44bb |
| qa-gn1569-31-svc-review-tier | Isolated | 5a3960c8-ddca-441d-977f-0ff0fa4f6f0a |
| qa-gn1569-31-scope-account | Shared | 6a09e40c-0585-4e08-bc3c-c5003f178cd9 |
| qa-gn1569-31-scope-subdomains | Shared | 2de83b57-a297-4bae-868e-cd31d1292f12 |
| qa-gn1569-31-scope-domain | Shared | b92b3567-2b70-47db-8c62-89bec746b5fd |
| qa-gn1569-31-scope-all | Shared | b55e3a03-25f0-4790-b576-71d736b5995b |
| qa-gn1569-31-shared-reg-control | L2 | a803353e-3992-47fd-b9d5-df789b264f73 |
| qa-gn1569-31-shared-reg | Shared | 87601b32-f211-4609-819f-6d0f4810b788 |
| qa-gn1569-31-cond-basic-l2 | L2 | 970f42a1-5570-4872-8faf-3c88ca9a0d3a |
| qa-gn1569-31-cond-tier-b | Isolated | b80539e9-306a-4b76-933f-b1f48399627f |
| qa-gn1569-31-cond-tier-a | Isolated | 4dc9dd9e-8b5a-451d-9112-1602b7a0ece1 |
| qa-gn1569-31-cond-configdrive | L2 | 92be2db0-3837-4e3f-8c5b-987cb9d5054b |
| qa-gn1597-31-project-nat | Isolated | e186f3a9-a763-400b-b936-4fa4d1e5e7ca |
| qa-gn1569-31-reg-tier | Isolated | 4a5ac294-90e7-418c-9755-b17f4a9b78f3 |
| qa-gn1569-31-nosnat | Isolated | b056b626-fe5e-4b75-ba17-78e421162dd7 |

## 31번 VPC

| 이름 | 상태/유형 | UUID |
| --- | --- | --- |
| qa-gn1569-31-svc-review | Enabled | 86950275-e6b6-4790-8bc9-bee82ab173c7 |
| qa-gn1569-31-cond-vpc | Enabled | c87ad78b-fc90-4a8d-9c45-c50e8f5b16fc |
| qa-gn1569-31-reg-vpc | Enabled | 876d40cb-64e6-42a8-a5d4-1122c7c0f1b8 |

## 32번 VM·VNF·AutoScale

| 이름 | 상태/유형 | UUID |
| --- | --- | --- |
| qa-gn1569-32-nosnat-vm | Running | 23dbc3f4-4378-4fef-9420-959d724ae98e |
| qa-gn1569-32-nosnat-peer | Running | ef8ecf84-8508-4bda-b69a-eb1e2914969f |
| qa-gn1597-32-project-vnf | Running | 812c5dcc-a538-4a58-be86-6e3dcbbc773a |
| qa-gn1569-32-cond-vm11 | Running | 2d831a7f-ba81-4c8a-b554-5edc51e66b77 |
| qa-gn1569-32-cond-vm12 | Running | 7b85552e-6134-4e49-92b1-f6b4ebb6ddb8 |
| qa-gn1569-32-shared-reg-vm21 | Running | 30d3760d-98db-46a7-a5c8-cd1c7950cd60 |
| qa-gn1569-32-shared-reg-vm24 | Running | dc8437d4-834a-4120-8958-d501fb96895a |
| qa-gn1569-32-scope-owner-vm | Running | 604b6a30-ae4d-4378-9393-00f5b310fcdd |
| qa-gn1569-32-scope-child-vm | Running | 86b6540c-a9b1-49da-8f59-6be0c8a06ce2 |
| qa-gn1569-32-scope-outsider-vm | Running | c2773fe8-b7ca-4f0f-a0ed-c6d69f50fbcc |
| qa-gn1569-32-vpn-lb-vm | Running | e3ddbdd1-ccd7-4299-9461-a33d25d6b645 |
| qa-gn1569-32-lb-int-reg-vm | Running | f2f65780-56e0-405e-b471-7a077e3045df |
| qa-gn1628-32-subnet-vm26 | Running | b312d970-d11d-48e0-a91e-a1589d646fe6 |
| qa-gn1569-32-final-functional-vm | Running | 27ca6e8a-132e-46a8-9b83-18a136fa6f0f |
| autoScaleVm-qa-gn1607-32-default-1-aqmcvp | Running | f28c0cb6-8c43-4ad8-9356-dacb99bdf996 |

## 32번 네트워크

| 이름 | 상태/유형 | UUID |
| --- | --- | --- |
| qa-gn1569-32-lb-int-reg-internalTier | Isolated | 258eda56-c559-432d-91cc-1c5224852008 |
| qa-gn1569-32-lb-int-reg-publicTier | Isolated | 75743a2a-f020-4f65-9ea2-a65acba1a409 |
| qa-gn1569-32-vpn-lb | Isolated | b7cd0439-ed95-4e7d-8b31-eb0ebacbd711 |
| qa-gn1569-32-svc-review-tier | Isolated | 3e020c34-8209-4336-bf63-5633baef13c4 |
| qa-gn1569-32-scope-account | Shared | eb4285c4-9de2-4881-89c6-0f890e549ed5 |
| qa-gn1569-32-scope-subdomains | Shared | 5200fccc-e4f2-47a8-bcff-85e81ab057dd |
| qa-gn1569-32-scope-domain | Shared | 56a62fc2-6bd4-48c4-ad94-bb3618e3d6f2 |
| qa-gn1569-32-scope-all | Shared | 60a1d91a-c09a-45c4-9ef1-e6d042520327 |
| qa-gn1569-32-shared-reg-control | L2 | 29acfe58-8d90-46f2-906e-ba69311d9e7c |
| qa-gn1569-32-shared-reg | Shared | a57a394e-71a6-4748-9fc3-9bcdc40ed3bd |
| qa-gn1569-32-cond-basic-l2 | L2 | 83fd6736-7daf-47c5-9f60-825f7c75c7ee |
| qa-gn1569-32-cond-tier-b | Isolated | 0ebf7b1a-6383-4060-b317-45a848e91372 |
| qa-gn1569-32-cond-tier-a | Isolated | c61de8f7-8ea7-4d63-a335-a5fd31914826 |
| qa-gn1569-32-cond-configdrive | L2 | 3fda09a1-c105-4614-82cc-2dddfcdfe2f3 |
| qa-gn1597-32-project-nat | Isolated | 0b5ac89f-cddc-4cf3-9934-b13dc2bd4446 |
| qa-gn1569-32-nosnat | Isolated | 28a009ed-333e-4968-8a8e-3f5b2f9ca667 |

## 32번 VPC

| 이름 | 상태/유형 | UUID |
| --- | --- | --- |
| qa-gn1569-32-lb-int-reg | Enabled | 91c180fc-6f94-4a64-a875-49697b0f3266 |
| qa-gn1569-32-svc-review | Enabled | 545de2b6-04d7-4815-b8d2-8a29e96d94f1 |
| qa-gn1569-32-cond-vpc | Enabled | 87964ae1-ca02-4224-aa97-126f63b15620 |

31 QA VLAN3900·Public Tier NIC는 최신 Internal/Public LB 회귀 VM의 참조 때문에 유지했다. 새 Public Tier NIC의 API/libvirt/MAC와 기존 기본 NIC 보존을 확인했으며 guest IP 설정·해당 NIC 실제 패킷까지 확인했다고 확대하지 않는다. switch trunk가 없으므로 실제 backend 시험은 VR과 같은 호스트 조건을 유지한다.

각 qa-gn1597 프로젝트의 Skudonet template은 최신 VNF/NIC 역할 회귀용이다. 외부 원본 qcow2 URL은 삭제하지 않았다. 사이트별 SSL2개·VPN 사용자1개·AutoScale1그룹(DISABLED, member1개)은 최신 회귀용으로 유지했다. 인증 정보·PKI는 게시하지 않는다. 인증서 유효기간과 시험 responder 수명은 다음 시험 전에 확인한다.
