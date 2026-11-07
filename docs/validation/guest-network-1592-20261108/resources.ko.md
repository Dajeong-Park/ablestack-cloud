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

# #1592 확인용 자원

기존 시험 자원을 유지했다. 관리자 로그인 후 상단에서 해당 QA 프로젝트를 선택하고 VM → NIC 탭을 열면 된다. **eth6/장치 ID 6**이 공유 회수·재부여 확인 대상이다. 현재 프로젝트 공유를 복원했으므로 요약과 NIC 표 모두 링크로 표시된다. 기존 계정 공유(peer)도 유지한다. 캡처에서 회수 중 일반 텍스트 상태와 비교할 수 있다.

| 클러스터 | 프로젝트 | VM | 개인 L2 공유망 | 현재 상태 |
| --- | --- | --- | --- | --- |
| 31 | [qa-gn1569-31-project](http://10.10.31.10:8080/client/#/project/4dff5213-ca2c-4ee7-8b2b-16c6a0baa6fe) | [qa-gn1569-31-prj-vm](http://10.10.31.10:8080/client/#/vm/625141be-7145-4557-9d8f-731500c61cb0?tab=nics) | [qa-gn1569-31-reg-personal-share](http://10.10.31.10:8080/client/#/guestnetwork/0bb7a305-e2c0-4fd6-af30-5f8aec0b720d) | Running · NIC 8개 · 프로젝트/peer 공유 2행 · 요약/NIC 링크 1/1 |
| 32 | [qa-gn1569-32-project](http://10.10.32.10:8080/client/#/project/0db180fc-4a19-4f9a-b387-00599ffa86c0) | [qa-gn1569-32-prj-vm](http://10.10.32.10:8080/client/#/vm/da7f69ed-1948-4927-b377-55beb9c4620d?tab=nics) | [qa-gn1569-32-reg-personal-share](http://10.10.32.10:8080/client/#/guestnetwork/d5ebfabd-d845-4411-9266-d6d16efe7587) | Running · NIC 8개 · 프로젝트/peer 공유 2행 · 요약/NIC 링크 1/1 |

프로젝트망은 31번 27개·32번 28개다. 이번에는 새 망·VM·NIC를 만들거나 삭제하지 않았다. 기존 8개 NIC의 UUID/MAC/IP/default, VM 호스트·상태, 멤버십·역할·QA 망 한도 30을 보존했다. 공유 회수는 해당 프로젝트 행만 대상으로 실행해 peer 계정 행을 유지했고 최종적으로 프로젝트 공유를 재부여했다. 권한 행 재생성의 UUID는 달라질 수 있으며 공유 대상과 의미를 대조했다.

이전 LB 확인 자원은 양쪽 각 5개 Active, SSL 인증서·FW/PF도 유지한다. [기존 전체 자원과 직접 링크](../guest-network-1590-20261108/resources.ko.md). 별도 삭제 지시 전까지 남겨둔다.
