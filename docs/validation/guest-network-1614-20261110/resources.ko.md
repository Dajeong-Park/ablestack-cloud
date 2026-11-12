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

관리자로 로그인 후 `qa-gn1569-31-shared-reg` / `qa-gn1569-32-shared-reg` 프로젝트를 선택한다. 아래 규칙은 실제 VM/IP1개가 연결된 상태로 보관했다. 읽기 전용 역할은 같은 연결을 조회하지만 해제 버튼이 비활성이다. 기존 계정/역할/멤버십은 유지했다.

| 대상 | 직접 UI | 규칙 ID | 백엔드 |
| --- | --- | --- | --- |
| 31 public | [qa-gn1614-31-public-review](http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing) | `3d478d60-a422-440d-88c9-fc9ce82a0393` | 10.234.31.6 →22 |
| 32 public | [qa-gn1614-32-public-review](http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing) | `3f83549d-c2d5-4233-bc7e-dc434b5f3180` | 10.236.32.36 →22 |
| 32 internal | [qa-gn1614-32-internal-review](http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance) | `b984694c-2c8d-4398-879a-c01f11531ee1` | 10.236.32.79 →22 |

31 Public IP10.10.31.149·32 Public IP10.10.32.146의 새 규칙 포트는18991이다. 32 Internal source IP10.236.32.103:18991을 사용한다. 시험용 source IP에 대한 새 외부 방화벽이나 분산 성능 시험은 구성하지 않았다.

기존 네트워크 31:116/32:103, 사용자 VM31:159/32:86, VPC12/13·AutoScale6/7·VPN 사용자4/4를 유지했다. 신규 Public 규칙 각1개·32 Internal1개만 추가했고, 기존62개 LB 규칙의 적용 VM/IP 매핑은 동일하다. 새 시험 네트워크·VM/NIC는 만들지 않았다. 범위 밖 GFS-TEST-VM의 상태/호스트 변경은 별도 관측이며 이 작업에서 VM 정지·마이그레이션·NIC 변경을 실행하지 않았다.

[31 최종 매핑](evidence/31-retained-review-backends.json) · [32 최종 매핑](evidence/32-retained-review-backends.json) · [31 보존](evidence/31-preservation-summary.json) · [32 보존](evidence/32-preservation-summary.json).

브라우저의 두 관리자 검토 탭과 모든 기존 확인용 자원을 남겼다. 비밀번호/PSK/API키는 공개 문서와 캡처에서 제외했다.
