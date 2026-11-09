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

# 유지한 확인용 자원

네트워크/VM/NIC/공유 권한은 API 전후 대조에서 동일하다. 관리자 로그인 후 프로젝트 `qa-gn1569-31-shared-reg` 또는 `qa-gn1569-32-shared-reg`를 선택한다. 접속 자격 증명은 게시하지 않는다.

| 클러스터 | 확인 화면 | 자원 |
| --- | --- | --- |
| 31 | [svc-review VPC](http://10.10.31.10:8080/client/#/vpc/86950275-e6b6-4790-8bc9-bee82ab173c7) | VPC·Tier·ACL·PF·VM24 NIC 유지 |
| 32 | [Shared account IP](http://10.10.32.10:8080/client/#/guestnetwork/eb4285c4-9de2-4881-89c6-0f890e549ed5?tab=public.ip.addresses) | IP 탭 2페이지에서 .214/.215의 VM 연결 확인 |
| 31 | [NIC 6개 VM22](http://10.10.31.10:8080/client/#/vm/36fa510b-3746-419c-91bf-3f58f457a8ae?tab=nics) | 기존 2개+범위별 Shared 4개 |
| 32 | [NIC 6개 VM22](http://10.10.32.10:8080/client/#/vm/655a666a-c0fa-4edc-ad2b-3f9393a7c744?tab=nics) | 기존 2개+범위별 Shared 4개 |

전체 ID·계정·개인 역할 VM·오퍼링/VR/PF 목록은 [직전 자원표](../guest-network-1569-vpc-shared-20261109/resources.ko.md)를 따른다. 이번에 해당 자원들을 정리하지 않았다. 읽기 전용 프로젝트 역할은 기존 네트워크 관련 9개 API deny 정의를 그대로 유지했다.
