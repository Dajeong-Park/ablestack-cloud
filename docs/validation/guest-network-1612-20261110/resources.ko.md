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

# 남겨둔 확인용 자원

모든 기존 자원과 아래 신규 시험 자원을 보존했다. 관리자 브라우저 탭도 남겼다. 역할/프로젝트 멤버십 변경은 없다.

| 클러스터 | 대상 | 상태/주소 |
| --- | --- | --- |
| 31 | qa-gn1612-31-review / `37debda7-24fa-4211-a95f-ee838bf7cbd1` | 10.248.31.39:19012→10.248.31.42:22, **할당 job0·시스템 VM Starting, 활성 성공 아님** |
| 31 | qa-gn1612-31-internal-tier / `459ddffd-f321-4d21-9be4-f090db569830` | 10.248.31.32/28, 프로젝트 qa-gn1569-31-conditional, 이후 Shutdown 관측 |
| 31 | qa-gn1612-31-internal-vm / `a8e17702-a4e4-4d6d-a581-432d130e50c6` | Stopped, 10.248.31.42; 기존 VM을 바꾸지 않고 새로 준비 |
| 31 | b-1006-VM / 4cef6e54-085d-4e5e-9927-38e5d29b2d79 | Starting/ablecube31-1, libvirt 도메인 없음. #1616 조사 대상, 강제 정리하지 않음 |
| 31 | qa-gn1612-31-warm-internal-tier / `ad1a8462-ed3d-46f6-894e-e630f0484c13` | 10.210.31.128/26, 기존 QA 계정 VPC의 별도 시험 Tier |
| 31 | qa-gn1612-31-warm-vm / 149f3103-b75c-48e7-b8bc-68af1d6a43f4 | 배치 job2/530, Error; 실패 증적 보존, warm 대조 미완료 |
| 32 | qa-gn1612-32-review / `3bd46f18-2ab3-446d-99b9-05119ef78fc9` | 10.236.32.76:19012→10.236.32.79:22, 실제 할당 job1/backend1 |
| 32 | b-482-VM / d88d975e-c497-4b16-a978-9e6ff5161ce1 | Running/ablecube32-1, 기존 시험 backend VM과 같은 호스트 |
| 32 | qa-gn1612-32-dialog-review / `3b8d6f02-2801-4fe2-a5eb-b80b0040947b` | 10.236.32.67:19014→22, 생성 완료·미할당. VM 할당 대화상자 확인용 |

31은 **qa-gn1569-31-conditional**,32는 **qa-gn1569-32-shared-reg** 프로젝트를 선택해 검토한다. 31 warm Tier는 기본 보기에서 QA 계정 VPC qa-gn1569-31-reg-vpc에 있다. 31 실패 자원은 정상 활성 자원으로 소개하지 않는다.

- [31 Internal LB](http://10.10.31.10:8080/client/#/ilb/37debda7-24fa-4211-a95f-ee838bf7cbd1?tab=loadbalancerinstance)
- [31 프로젝트 VPC 네트워크](http://10.10.31.10:8080/client/#/vpc/874d72f2-55f9-4fcc-925d-89fb2294b0d4?tab=tier)
- [32 연결된 Internal LB](http://10.10.32.10:8080/client/#/ilb/3bd46f18-2ab3-446d-99b9-05119ef78fc9?tab=loadbalancerinstance)
- [32 대화상자 확인용 LB](http://10.10.32.10:8080/client/#/ilb/3b8d6f02-2801-4fe2-a5eb-b80b0040947b?tab=loadbalancerinstance)

32 확인용 LB의 작업→가상머신 할당에서 새 레이아웃을 확인할 수 있다. 현재 검토 탭에서는 VM/IP가 선택됐지만 확인 버튼은 실행하지 않았다. 31 진행 중 작업은 재제출하지 말고 동일 작업 조회로 확인한다. 자원 삭제는 사용자 지시 후 수행한다.
