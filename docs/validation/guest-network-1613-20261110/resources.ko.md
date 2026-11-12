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

# 확인용 시험 자원과 화면

기존 자원을 삭제하지 않았다. 이번 작업의 신규 생성/삭제/변경은0이며 관리자 브라우저를 아래 프로젝트 Tier 화면에 남겼다.

| 클러스터 | 프로젝트 | 확인 화면 |
| --- | --- | --- |
| 31 GFS2 | qa-gn1569-31-conditional | [qa-gn1600-31-vpc](http://10.10.31.10:8080/client/#/vpc/874d72f2-55f9-4fcc-925d-89fb2294b0d4?tab=tier), default_allow 링크2·qa-gn1612-31-internal-tier 대시1 |
| 32 Glue RBD | qa-gn1569-32-shared-reg | [qa-gn1569-32-lb-int-reg](http://10.10.32.10:8080/client/#/vpc/91c180fc-6f94-4a64-a875-49697b0f3266?tab=tier), Public/Internal/alt Tier 모두 대시 |
| 31 기본 보기 | QA 계정 VPC | [qa-gn1569-31-reg-vpc](http://10.10.31.10:8080/client/#/vpc/876d40cb-64e6-42a8-a5d4-1122c7c0f1b8?tab=tier), 사용자 지정 ACL 정상 링크 |
| 32 기본 보기 | QA 계정 VPC | [qa-gn1569-32-reg-vpc](http://10.10.32.10:8080/client/#/vpc/8cd96255-8109-41c8-812e-4f9b7107480b?tab=tier), 사용자 지정 ACL 정상 링크 |

읽기 전용/회원용 Shared-reg의 svc-review VPC/ACL과 기존 VM/NIC도 그대로다. 31 #1616 실패 LB/시스템VM/warm 자원을 강제로 복구·삭제하지 않았다. 이전 job은 서버에서530으로 끝나 backend 매핑이 철회된 상태다. 32 기존 qa-gn1612-32-review 및 dialog-review LB를 포함한 확인 자원은 유지한다. 사용자 삭제 지시 전까지 보존한다.

[31 전체 ID 보존](evidence/31-resource-preservation.json) · [32 전체 ID 보존](evidence/32-resource-preservation.json).
