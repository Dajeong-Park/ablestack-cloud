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

# #1591 확인용 자원

새로운 네트워크·VM·Tungsten 제공자를 생성하거나 삭제하지 않았다. 기존 확인용 시험 자원을 유지했다. 관리자 로그인 후 QA 프로젝트를 선택하면 VM의 NIC 8개와 유형별 네트워크를 확인할 수 있다. 제공자 목록은 관리자용이며 현재 설치된 Tungsten 제공자는 0개다.

| 클러스터 | 프로젝트·VM | 유형별 네트워크 | Zone 조회 |
| --- | --- | --- | --- |
| 31 | [qa-gn1569-31-project](http://10.10.31.10:8080/client/#/project/4dff5213-ca2c-4ee7-8b2b-16c6a0baa6fe) · [qa-gn1569-31-prj-vm](http://10.10.31.10:8080/client/#/vm/625141be-7145-4557-9d8f-731500c61cb0?tab=nics) | [qa-gn1569-31-reg-nat](http://10.10.31.10:8080/client/#/guestnetwork/728ab627-0aff-4d39-a63f-3f0eae3777a2) · [qa-gn1569-31-reg-l2](http://10.10.31.10:8080/client/#/guestnetwork/1a7c7bc5-b487-4acb-92d7-391c0198c0dc) · [qa-gn1569-31-reg-shared](http://10.10.31.10:8080/client/#/guestnetwork/776362a9-9943-48d7-aaf1-ca1455a9ae1e) | [빈 제공자 목록](http://10.10.31.10:8080/client/#/tungstenfabric?zoneid=7013f5a1-de59-4cea-a596-f4f58815f31c) |
| 32 | [qa-gn1569-32-project](http://10.10.32.10:8080/client/#/project/0db180fc-4a19-4f9a-b387-00599ffa86c0) · [qa-gn1569-32-prj-vm](http://10.10.32.10:8080/client/#/vm/da7f69ed-1948-4927-b377-55beb9c4620d?tab=nics) | [qa-gn1569-32-reg-nat](http://10.10.32.10:8080/client/#/guestnetwork/520b13f5-966b-4ee9-af3a-e5e6339e11ca) · [qa-gn1569-32-reg-l2](http://10.10.32.10:8080/client/#/guestnetwork/8e90bb7a-8fca-469b-accc-8a33c349b611) · [qa-gn1569-32-reg-shared](http://10.10.32.10:8080/client/#/guestnetwork/92102e11-abf4-464f-9592-b04671c9946a) | [빈 제공자 목록](http://10.10.32.10:8080/client/#/tungstenfabric?zoneid=991d2f57-0f37-4445-b956-09773d064816) |

양쪽 VM은 Running, 기존 NIC UUID/IP/MAC/default와 호스트가 동일하다. 프로젝트망 27/28개·멤버십/역할·프로젝트/peer 공유 2행을 보존했다. 이전 LB 각 5개 Active·인증서·FW/PF도 보존했다. [이전 전체 자원](../guest-network-1590-20261108/resources.ko.md). 별도 삭제 지시 전까지 유지한다. 최종 브라우저는 QA 프로젝트의 VM NIC 탭이며 31 라이트·32 다크와 기본 뷰포트를 복원했다.
