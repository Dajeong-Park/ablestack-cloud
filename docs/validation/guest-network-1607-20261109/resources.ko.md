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

# 보관한 확인용 시험 자원

프로젝트 `qa-gn1569-31-shared-reg` 또는 `qa-gn1569-32-shared-reg`를 선택한다. 그룹은 DISABLED, 각 멤버1은 Running이며 LB에 연결돼 있다. 별도 삭제 지시 전까지 보관한다.

| 클러스터 | 화면/자원 | 보관 상태 |
| --- | --- | --- |
| 31 | [qa-gn1607-31-saved](http://10.10.31.10:8080/client/#/autoscalevmgroup/e57c966d-865c-44f1-9f77-429539b58ae6?tab=autoscale.operations) | DISABLED / 최소1·최대1 / 멤버1 / LB 18877→22 |
| 31 | [VM 프로필](http://10.10.31.10:8080/client/#/autoscalevmgroup/e57c966d-865c-44f1-9f77-429539b58ae6?tab=autoscale.vm.profile) | 0f1ef02c-c362-4ab4-99f2-928f667d0693 / User Data 전용 저장 데이터 |
| 31 | [멤버 VM](http://10.10.31.10:8080/client/#/vm/582e270c-5fbd-42fc-8c5c-f632f1212910?tab=nics) | autoScaleVm-qa-gn1607-31-saved-1-bdsotd / Running / i-440-1000-VM |
| 31 | [qa-gn1607-31-default](http://10.10.31.10:8080/client/#/autoscalevmgroup/d16e2a69-50d4-43ca-bbde-3af3c4cbeddf?tab=autoscale.operations) | DISABLED / 최소1·최대1 / 멤버1 / LB 18876→22 |
| 31 | [VM 프로필](http://10.10.31.10:8080/client/#/autoscalevmgroup/d16e2a69-50d4-43ca-bbde-3af3c4cbeddf?tab=autoscale.vm.profile) | 813f3038-5b2b-4dbd-a9b9-bae1d576b589 / User Data 설정 안함 |
| 31 | [멤버 VM](http://10.10.31.10:8080/client/#/vm/23f01208-cacd-4ac2-bdf9-39235325e923?tab=nics) | autoScaleVm-qa-gn1607-31-default-1-dsqime / Running / i-440-999-VM |
| 31 | [시험 User Data](http://10.10.31.10:8080/client/#/userdata/51ebae5a-f779-4803-ae14-9e6f4dc17ff3) | qa-gn1607-31-init / REVIEW 변수 / 프로젝트 전용 |
| 32 | [qa-gn1607-32-saved](http://10.10.32.10:8080/client/#/autoscalevmgroup/d3faaa7f-ba0b-428d-833a-6617aae49018?tab=autoscale.operations) | DISABLED / 최소1·최대1 / 멤버1 / LB 18877→22 |
| 32 | [VM 프로필](http://10.10.32.10:8080/client/#/autoscalevmgroup/d3faaa7f-ba0b-428d-833a-6617aae49018?tab=autoscale.vm.profile) | e8f3ab01-8b93-4d3f-9c86-9e00b7162127 / User Data 전용 저장 데이터 |
| 32 | [멤버 VM](http://10.10.32.10:8080/client/#/vm/4f65cea9-4265-4937-aac2-08bbffc6ff68?tab=nics) | autoScaleVm-qa-gn1607-32-saved-1-wcfeqs / Running / i-252-475-VM |
| 32 | [qa-gn1607-32-default](http://10.10.32.10:8080/client/#/autoscalevmgroup/e9c4882a-f921-4a44-a7bc-4843fadf5cb9?tab=autoscale.operations) | DISABLED / 최소1·최대1 / 멤버1 / LB 18876→22 |
| 32 | [VM 프로필](http://10.10.32.10:8080/client/#/autoscalevmgroup/e9c4882a-f921-4a44-a7bc-4843fadf5cb9?tab=autoscale.vm.profile) | c7971d3c-a12a-4218-94eb-b24f027524e5 / User Data 설정 안함 |
| 32 | [멤버 VM](http://10.10.32.10:8080/client/#/vm/f28c0cb6-8c43-4ad8-9356-dacb99bdf996?tab=nics) | autoScaleVm-qa-gn1607-32-default-1-aqmcvp / Running / i-252-474-VM |
| 32 | [시험 User Data](http://10.10.32.10:8080/client/#/userdata/ab499850-75d6-40d2-80da-a8748e3b36b6) | qa-gn1607-32-init / REVIEW 변수 / 프로젝트 전용 |

기존 VPN·수동 VM·네트워크·AutoScale/SSL/TCP 규칙도 유지한다. [31 최종 API·실제 호스트](evidence/31-final-verification.json) · [32 최종](evidence/32-final-verification.json). LB 부하분산 측정은 하지 않았다. 그룹 API 생성 성공과 최소 VM 배포 성공/32 초기 오퍼링 보정은 본문에서 구분한다.
