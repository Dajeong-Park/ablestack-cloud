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

# #1590 확인용 자원

기존 #1569 자원을 보존했다. 아래는 이번 변경분과 현재 상태다. 관리자 로그인 후 상단 프로젝트 선택을 링크의 소속과 일치시키면 된다. 별도 삭제 지시 전까지 유지한다. LB 데이터 평면 시험은 수행하지 않았다.

| 클러스터 | 컨텍스트 | 확인 화면 | 규칙 | 상태 |
| --- | --- | --- | --- | --- |
| 31 | 기본 보기 · 개인망 | [Public IP 10.10.31.110](http://10.10.31.10:8080/client/#/publicip/f9eda3b4-2655-453b-837a-28e46eb9c3f5?tab=loadbalancing) | qa-gn1569-31-reg-lb · 739c314f-a5a9-418c-bc6c-6040a77f9046 · 18569/18569 · leastconn/tcp | Active |
| 31 | 기본 보기 · 개인망 | [Public IP 10.10.31.110](http://10.10.31.10:8080/client/#/publicip/f9eda3b4-2655-453b-837a-28e46eb9c3f5?tab=loadbalancing) | qa-gn1569-31-reg-lb-tcp · 46b0048d-e3e9-48df-8df9-eebbcf465404 · 18572/18572 · leastconn/tcp | Active |
| 31 | 기본 보기 · 개인망 | [Public IP 10.10.31.110](http://10.10.31.10:8080/client/#/publicip/f9eda3b4-2655-453b-837a-28e46eb9c3f5?tab=loadbalancing) | qa-gn1569-31-1590-default · e753dfe9-7e93-4c6a-8cb8-c19682c68de5 · 18590/18590 · source/tcp | Active |
| 31 | 기본 보기 · 개인망 | [Public IP 10.10.31.110](http://10.10.31.10:8080/client/#/publicip/f9eda3b4-2655-453b-837a-28e46eb9c3f5?tab=loadbalancing) | qa-gn1569-31-1590-ssl · c83d253b-07c6-4a19-a5ac-94f73ab7133e · 18591/18591 · roundrobin/ssl | Active |
| 31 | qa-gn1569-31-project | [Public IP 10.10.31.113](http://10.10.31.10:8080/client/#/publicip/3aab3764-2ead-49a8-9289-b758bb2490ec?tab=loadbalancing) | qa-gn1569-31-1590-project-lb-reviewed · 1adbfeed-85a5-4851-95e9-00a4561a9709 · 18592/TCP | Active |

| 32 | 기본 보기 · 개인망 | [Public IP 10.10.32.170](http://10.10.32.10:8080/client/#/publicip/d670d49c-497f-46fe-940a-45c83202a1d7?tab=loadbalancing) | qa-gn1569-32-reg-lb · 3cc2a1c8-4362-44fd-9bd7-aeddd77c6f5e · 18569/18569 · leastconn/tcp | Active |
| 32 | 기본 보기 · 개인망 | [Public IP 10.10.32.170](http://10.10.32.10:8080/client/#/publicip/d670d49c-497f-46fe-940a-45c83202a1d7?tab=loadbalancing) | qa-gn1569-32-reg-lb-tcp · 4b4dda8c-78e2-4dc8-b241-9362f92d02ce · 18572/18572 · leastconn/tcp | Active |
| 32 | 기본 보기 · 개인망 | [Public IP 10.10.32.170](http://10.10.32.10:8080/client/#/publicip/d670d49c-497f-46fe-940a-45c83202a1d7?tab=loadbalancing) | qa-gn1569-32-1590-default · 27c713e0-5619-4005-9e60-8fb042a08ccf · 18590/18590 · source/tcp | Active |
| 32 | 기본 보기 · 개인망 | [Public IP 10.10.32.170](http://10.10.32.10:8080/client/#/publicip/d670d49c-497f-46fe-940a-45c83202a1d7?tab=loadbalancing) | qa-gn1569-32-1590-ssl · 06c83112-50b4-4db4-a7ef-9ab18da4f6ba · 18591/18591 · roundrobin/ssl | Active |
| 32 | qa-gn1569-32-project | [Public IP 10.10.32.162](http://10.10.32.10:8080/client/#/publicip/6db281fa-f2c0-4c70-9f35-48b79ced6581?tab=loadbalancing) | qa-gn1569-32-1590-project-lb-review · 7f2c0153-c4e0-4c3f-bf15-cb1a9587cf6f · 18592/TCP | Active |

31번 프로젝트 VM [qa-gn1569-31-prj-vm](http://10.10.31.10:8080/client/#/vm/625141be-7145-4557-9d8f-731500c61cb0)은 Running이며 원래 7개 NIC의 UUID/MAC/IP/default와 호스트를 보존했다. 기존 전용 NAT망 728ab627-0aff-4d39-a63f-3f0eae3777a2에 확인용 비기본 NIC 1개를 추가해 총 8개다. 프로젝트망 수는 27개로 유지했다. 추가 Public IP와 LB 1개, 개인망 TCP·SSL LB 각 1개 및 전용 시험 인증서 qa-gn1569-31-1590-cert(c2794d81-c386-4ea8-9875-4d6071a0abf9)를 유지한다. 인증서 개인 키는 게시하지 않는다.

32번 프로젝트 VM [qa-gn1569-32-prj-vm](http://10.10.32.10:8080/client/#/vm/da7f69ed-1948-4927-b377-55beb9c4620d)은 Running이며 원래 7개 NIC의 UUID/MAC/IP/default와 호스트를 보존했다. 기존 전용 NAT망 520b13f5-966b-4ee9-af3a-e5e6339e11ca에 확인용 비기본 NIC 1개를 추가해 총 8개다. 프로젝트망 수는 28개로 유지했다. 추가 Public IP와 LB 1개, 개인망 TCP·SSL LB 각 1개 및 전용 시험 인증서 qa-gn1569-32-1590-cert(ca82ecee-57e3-43a5-814c-be15d49324a8)를 유지한다. 인증서 개인 키는 게시하지 않는다.


개인망의 18569 규칙은 기존 NULL 결함 규칙을 복구한 것이고, 18572는 기존 비교 규칙이다. 둘 다 원래 UUID를 보존했다. 기존 FW/포트 포워딩·공유·멤버십·역할 규칙과 QA 프로젝트 네트워크 한도 30을 유지했다. 정리 시 전용 자원만 제거하고 이전에 기록한 QA 한도 20 복구를 함께 수행한다. [기존 전체 자원](../guest-network-1569-regression-20261107/resources.ko.md).
