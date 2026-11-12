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

# 확인용 자원과 UI 진입

관리자로 로그인 후 `qa-gn1569-31-shared-reg` / `qa-gn1569-32-shared-reg` 프로젝트를 선택한다. 후보 창은 생성/취소로 확인할 수 있다. 기존 시험 자원을 삭제하지 않았고 이번 새 자원도 보관했다.

| 클러스터 | 용도 | Public IP 직접 UI |
| --- | --- | --- |
| 31 | Isolated 새 규칙 | [10.10.31.149](http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing) |
| 32 | 일반 Public LB/기존 NIC 연결 | [10.10.32.146](http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing) |
| 32 | AutoScale 경로 규칙만 생성 | [10.10.32.179](http://10.10.32.10:8080/client/#/publicip/bb36cd52-5f78-4906-835d-3028eadbae71?tab=loadbalancing) |
| 32 | 미연결 후보 확인용 | [10.10.32.145](http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing) |

32 VPC `qa-gn1569-32-lb-int-reg`의 기존 Public Tier `75743a2a-f020-4f65-9ea2-a65acba1a409`·Internal Tier `258eda56-c559-432d-91cc-1c5224852008`와 신규 `qa-gn1611-32-public-alt` `0243e576-addd-4af2-be33-bd542d225ce4`를 남겼다. 미연결 IP32.145에서 규칙 추가의 Tier 드롭다운을 열면 Public2개만 표시된다. AutoScale=예 → 서브넷 선택에서도 같은 두 개만 표시된다. 해당 IP에는 규칙을 만들지 않아 후보 재검토가 가능하다.

새 규칙은 31 `qa-gn1611-31-isolated-lb`(18981/Add), 32 `qa-gn1611-32-public-lb`(18981/Active/NIC10.236.32.36 연결), `qa-gn1611-32-autoscale-lb`(18982/Add), `qa-gn1611-32-peer-lb`(18983/Add), `qa-gn1611-32-domainadmin-lb`(18984/Add)다. Add는 규칙만 생성한 의도된 상태이며 AutoScale 그룹 생성 성공으로 주장하지 않는다. 전체 ID는 [31 결과](evidence/31-new-lb-api.json)·[32 결과](evidence/32-new-lb-api.json)에 있다.

31 IP31.109/`rt1230-vpc-project-r26`는 준비된 **기존 다른 QA 자원**을 기본 보기 관리자로 열어 읽기·취소만 했다. 본 작업 규칙을 생성하거나 IP를 해제하지 않았다. 31 공인 IP 부족을 해소하기 위해 기존 자원을 임의 정리하지 않았다.

브라우저의 두 관리자 검토 탭과 기존 VM·NIC·VPN·S2S·AutoScale·제한 역할 계정을 유지했다. 비밀번호·PSK·API키는 문서/캡처에 싣지 않았다.
