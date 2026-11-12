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

개인 Shared의 소유자는 `qa-gn1569-<클러스터>-owner`, 프로젝트 이름은 `qa-gn1569-<클러스터>-shared-reg`이다. admin으로 해당 프로젝트를 선택해 VM NIC를 확인할 수 있다. 두 브라우저 탭에 VM24 NIC를 남겼다.

| 클러스터 | Shared 네트워크 | 새 라우터 / 호스트 | 새 VM24 |
| --- | --- | --- | --- |
| 31 | [qa-gn1569-31-shared-reg](http://10.10.31.10:8080/client/#/guestnetwork/87601b32-f211-4609-819f-6d0f4810b788) | r-984-VM / ablecube31-3 | [qa-gn1569-31-shared-reg-vm24](http://10.10.31.10:8080/client/#/vm/4d8dc91e-db04-4d4a-b53b-0275fe680e67?tab=nics) |
| 32 | [qa-gn1569-32-shared-reg](http://10.10.32.10:8080/client/#/guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd) | r-459-VM / ablecube32-2 | [qa-gn1569-32-shared-reg-vm24](http://10.10.32.10:8080/client/#/vm/dc8437d4-834a-4120-8958-d501fb96895a?tab=nics) |

31번 프로젝트 ID `59614883-4085-4a76-99da-b8a1e3a78eed`. VM21 `.58`, VM22 `.57`, VM23 `.55`, VM24 `.54`를 유지한다. 네 VM의 원래 L2 제어 NIC가 기본 NIC이며 Shared NIC는 보조다. ConfigDrive VM `c7f40539-4192-424d-8186-256e58b78318`는 Running이다. 실패 보존 VPC `aec68c28-9274-41be-95cf-7f833f93811c`, Tier `8a0a36db-c7a9-44b1-92a6-8038fdaf50f6`와 `qa1569-delete=preserve-on-failure` 태그를 유지한다. [전체 ID·NIC·권한·템플릿](evidence/31-review-resources.json).

32번 프로젝트 ID `cf5ec6b5-b522-4c18-ab90-a395012607c1`. VM21 `.58`, VM22 `.57`, VM23 `.55`, VM24 `.54`를 유지한다. 네 VM의 원래 L2 제어 NIC가 기본 NIC이며 Shared NIC는 보조다. ConfigDrive VM `c6f2ad48-bd55-4620-a579-331316025e68`는 Running이다. 실패 보존 VPC `6b0803d7-b8a6-4116-851d-725da7b22c91`, Tier `71304082-3485-46a4-b3f3-75a383d36563`와 `qa1569-delete=preserve-on-failure` 태그를 유지한다. [전체 ID·NIC·권한·템플릿](evidence/32-review-resources.json).

최종 ROUTING 템플릿은 양쪽 `SystemVM-gn1569-dnsfix-20261109-KVM-r2`이며 Zone 기본 라우터 템플릿으로 설정했다. 기존 SYSTEM 템플릿과 다른 실행 중 라우터는 그대로다. 임시 호스트 주소 `172.26.31.254/24`, `172.26.32.254/24`만 제거했다. 시험 계정의 비밀번호·SSH 개인 키는 보고서나 Git에 포함하지 않는다.
