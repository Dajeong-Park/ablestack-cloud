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

기존 시험 자원을 정리하지 않았다. 소모성 svc-delete만 정상 삭제했으며 아래 svc-review를 대체 확인용으로 남겼다. 프로젝트를 선택하고 관리자 계정으로 확인한다. 자격 증명은 이 문서에 기록하지 않는다.

## 31번

- 프로젝트 `qa-gn1569-31-shared-reg` / `59614883-4085-4a76-99da-b8a1e3a78eed`
- [VPC qa-gn1569-31-svc-review](http://10.10.31.10:8080/client/#/vpc/86950275-e6b6-4790-8bc9-bee82ab173c7) / `86950275-e6b6-4790-8bc9-bee82ab173c7`
- [Tier](http://10.10.31.10:8080/client/#/guestnetwork/5a3960c8-ddca-441d-977f-0ff0fa4f6f0a) / `5a3960c8-ddca-441d-977f-0ff0fa4f6f0a`
- VM24 `qa-gn1569-31-shared-reg-vm24` / `4d8dc91e-db04-4d4a-b53b-0275fe680e67`: 원래 NIC 유지 + VPC `10.239.31.121`
- VR `r-993-VM` / `ablecube31-3`. PF `10.10.31.147:18269 → 10.239.31.121:22`

| Shared 범위 | 이름 | CIDR / VLAN | ID |
| --- | --- | --- | --- |
| all | qa-gn1569-31-scope-all | 10.236.31.0/26 / 2830 | `b55e3a03-25f0-4790-b576-71d736b5995b` |
| domain | qa-gn1569-31-scope-domain | 10.236.31.64/26 / 2831 | `b92b3567-2b70-47db-8c62-89bec746b5fd` |
| subdomains | qa-gn1569-31-scope-subdomains | 10.236.31.128/26 / 2832 | `2de83b57-a297-4bae-868e-cd31d1292f12` |
| account | qa-gn1569-31-scope-account | 10.236.31.192/26 / 2833 | `6a09e40c-0585-4e08-bc3c-c5003f178cd9` |

account 망의 프로젝트 공유 1건을 복원했다. peer 공유는 없음. 기존 `qa-gn1569-31-shared-reg`의 공유 권한은 변경하지 않았다.

| 용도 | VM 이름 | ID | 새 NIC |
| --- | --- | --- | --- |
| projectMember | qa-gn1569-31-shared-reg-vm22 | `36fa510b-3746-419c-91bf-3f58f457a8ae` | 10.236.31.10, 10.236.31.74, 10.236.31.138, 10.236.31.202 |
| projectAdmin | qa-gn1569-31-shared-reg-vm23 | `390e0a4d-2456-485c-8415-8c6f36b8ffc9` | 10.236.31.13, 10.236.31.76, 10.236.31.140, 10.236.31.204 |
| 개인 owner | qa-gn1569-31-scope-owner-vm | `ecdb6b5b-3675-4878-af3b-04252f17a7ea` | ALL 기본 `10.236.31.12`. 추가 NIC는 역할 API 결과 참조 |
| 개인 child | qa-gn1569-31-scope-child-vm | `5adc4475-fc07-403d-ad2a-8e6f95595e47` | ALL 기본 `10.236.31.14`. 추가 NIC는 역할 API 결과 참조 |
| 개인 outsider | qa-gn1569-31-scope-outsider-vm | `1f6adf08-ba15-4afb-9f10-69fba5d18bd4` | ALL 기본 `10.236.31.15`. 추가 NIC는 역할 API 결과 참조 |

읽기 전용 프로젝트 역할 `42157776-66ca-4491-804a-91d0f9256e42` 및 peer/child/domainAdmin/readOnly 시험 계정을 유지했다. 공유 망/게스트 통신은 같은 호스트 범위이며 외부 스위치 VLAN 통신을 검증하지 않았다.

## 32번

- 프로젝트 `qa-gn1569-32-shared-reg` / `cf5ec6b5-b522-4c18-ab90-a395012607c1`
- [VPC qa-gn1569-32-svc-review](http://10.10.32.10:8080/client/#/vpc/545de2b6-04d7-4815-b8d2-8a29e96d94f1) / `545de2b6-04d7-4815-b8d2-8a29e96d94f1`
- [Tier](http://10.10.32.10:8080/client/#/guestnetwork/3e020c34-8209-4336-bf63-5633baef13c4) / `3e020c34-8209-4336-bf63-5633baef13c4`
- VM24 `qa-gn1569-32-shared-reg-vm24` / `dc8437d4-834a-4120-8958-d501fb96895a`: 원래 NIC 유지 + VPC `10.239.32.248`
- VR `r-468-VM` / `ablecube32-2`. PF `10.10.32.176:18269 → 10.239.32.248:22`

| Shared 범위 | 이름 | CIDR / VLAN | ID |
| --- | --- | --- | --- |
| all | qa-gn1569-32-scope-all | 10.236.32.0/26 / 2840 | `60a1d91a-c09a-45c4-9ef1-e6d042520327` |
| domain | qa-gn1569-32-scope-domain | 10.236.32.64/26 / 2841 | `56a62fc2-6bd4-48c4-ad94-bb3618e3d6f2` |
| subdomains | qa-gn1569-32-scope-subdomains | 10.236.32.128/26 / 2842 | `5200fccc-e4f2-47a8-bcff-85e81ab057dd` |
| account | qa-gn1569-32-scope-account | 10.236.32.192/26 / 2843 | `eb4285c4-9de2-4881-89c6-0f890e549ed5` |

account 망의 프로젝트 공유 1건을 복원했다. peer 공유는 없음. 기존 `qa-gn1569-32-shared-reg`의 공유 권한은 변경하지 않았다.

| 용도 | VM 이름 | ID | 새 NIC |
| --- | --- | --- | --- |
| projectMember | qa-gn1569-32-shared-reg-vm22 | `655a666a-c0fa-4edc-ad2b-3f9393a7c744` | 10.236.32.23, 10.236.32.87, 10.236.32.151, 10.236.32.215 |
| projectAdmin | qa-gn1569-32-shared-reg-vm23 | `c74285b6-8f22-4f4c-a396-a2e262ca41f2` | 10.236.32.25, 10.236.32.86, 10.236.32.150, 10.236.32.214 |
| 개인 owner | qa-gn1569-32-scope-owner-vm | `604b6a30-ae4d-4378-9393-00f5b310fcdd` | ALL 기본 `10.236.32.22`. 추가 NIC는 역할 API 결과 참조 |
| 개인 child | qa-gn1569-32-scope-child-vm | `86b6540c-a9b1-49da-8f59-6be0c8a06ce2` | ALL 기본 `10.236.32.24`. 추가 NIC는 역할 API 결과 참조 |
| 개인 outsider | qa-gn1569-32-scope-outsider-vm | `c2773fe8-b7ca-4f0f-a0ed-c6d69f50fbcc` | ALL 기본 `10.236.32.21`. 추가 NIC는 역할 API 결과 참조 |

읽기 전용 프로젝트 역할 `9f8c4c7d-cca9-4a50-888a-85b27c9b30da` 및 peer/child/domainAdmin/readOnly 시험 계정을 유지했다. 공유 망/게스트 통신은 같은 호스트 범위이며 외부 스위치 VLAN 통신을 검증하지 않았다.
