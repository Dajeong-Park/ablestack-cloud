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

프로젝트 `qa-gn1569-31-shared-reg` / `qa-gn1569-32-shared-reg`를 선택한다. 기존 #1607 기본 그룹을 재사용하고 이름만 변경했다. 별도 삭제 지시 전까지 보관한다.

| 클러스터 | 직접 UI 링크 | 상태 |
| --- | --- | --- |
| 31 | [qa-gn1608-31-review](http://10.10.31.10:8080/client/#/autoscalevmgroup/d16e2a69-50d4-43ca-bbde-3af3c4cbeddf?tab=autoscale.operations) | DISABLED /1~1/60초/기존 멤버1 |
| 31 | [멤버 VM NIC](http://10.10.31.10:8080/client/#/vm/23f01208-cacd-4ac2-bdf9-39235325e923?tab=nics) | autoScaleVm-qa-gn1607-31-default-1-dsqime / Running / i-440-999-VM / LB18876→22 |
| 32 | [qa-gn1608-32-review](http://10.10.32.10:8080/client/#/autoscalevmgroup/e9c4882a-f921-4a44-a7bc-4843fadf5cb9?tab=autoscale.operations) | DISABLED /1~1/60초/기존 멤버1 |
| 32 | [멤버 VM NIC](http://10.10.32.10:8080/client/#/vm/f28c0cb6-8c43-4ad8-9356-dacb99bdf996?tab=nics) | autoScaleVm-qa-gn1607-32-default-1-aqmcvp / Running / i-252-474-VM / LB18876→22 |

그룹의 **작업 > 오토스케일 VM 그룹 업데이트**에서 이름/1/1/60을 확인한다. interval120 제출 시 정책 duration60 서버 오류431과 입력 보존을 재현할 수 있다. 자동 증감을 막기 위해 그룹은 활성화하지 않았다. 네트워크·NIC·LB·기존 저장 데이터 그룹/시험 자원은 유지한다.
