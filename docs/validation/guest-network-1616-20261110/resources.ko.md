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

# 사용자 확인용 자원

확인용 자원은 삭제하지 않았다. 관리자로 로그인하고 지정한 프로젝트/기본 보기에서 확인한다. 자원 ID·runtime은 evidence에 저장했다.

|범위|규칙|VIP:port|UI|
|---|---|---|---|
|31 qa-gn1569-31-conditional|qa-gn1612-31-review|10.248.31.39:19012|[할당 VM](http://10.10.31.10:8080/client/#/ilb/37debda7-24fa-4211-a95f-ee838bf7cbd1?tab=loadbalancerinstance)|
|31 기본 보기|qa-gn1616-31-allocated-lb|10.210.31.188:19016|[할당 VM](http://10.10.31.10:8080/client/#/ilb/6e9cde24-21d1-487e-b429-b1b5f2dbc1db?tab=loadbalancerinstance)|
|31 기본 보기|qa-gn1616-31-implemented-lb|10.210.31.189:19017|[할당 VM](http://10.10.31.10:8080/client/#/ilb/d53859bc-f9d8-4792-b6b7-21a46f0ff161?tab=loadbalancerinstance)|
|32 기본 보기|qa-gn1616-32-allocated-lb|10.211.32.150:19016|[할당 VM](http://10.10.32.10:8080/client/#/ilb/8a1a5541-d184-4069-897a-51bc86d3851a?tab=loadbalancerinstance)|
|32 기본 보기|qa-gn1616-32-implemented-lb|10.211.32.153:19017|[할당 VM](http://10.10.32.10:8080/client/#/ilb/5688aa94-3c2f-4814-b1a8-a7a068948798?tab=loadbalancerinstance)|

31 browser는 원래 conditional 프로젝트 규칙,32 browser는 기본 보기의 새 최초 규칙에 남겼다. 새 backend는 qa-gn1616-31-allocated-vm/qa-gn1616-32-allocated-vm이며 양쪽 Running이다. 원래31 qa-gn1612-31-internal-vm도 Running이다. 생성/할당 창을 열어 모바일/다크를 다시 확인할 수 있다.

## 이번에 승인받아 삭제한 이전 자원

가장 오래된 Public IP 사용 시험망 `qa-gn1569-31-nat`(2026-11-06 08:51:37 UTC,9c79eaa6-e3de-4892-9cb9-fecb6b6f15a0)을 정상 삭제했다. IP106/110/143과 VLAN176을 회수했다. 함께 정리된 LB4개는 이 망에 속한 규칙이다. 연결 VM qa-gn1569-31-nat-vm은 중지→기존 L2 NIC를 기본값으로 전환→NAT NIC 제거→망 삭제→VM 재기동 순서로 보존했다. 디스크와 기존 L2 NIC를 유지하며 현재 Running이다.

새 고정/합성 Public IP 풀이나 호스트/물리 스위치 설정은 추가하지 않았다. 임시 부족 예약은 모두 해제했다. 회수 IP는 정상 SourceNat 수요에 다시 사용될 수 있으므로 최종 상태는 [IP/작업 조회](evidence/31-final-target-jobs-and-ips.json)를 기준으로 한다.

[정리 계획](evidence/31-oldest-cleanup-plan.json) · [실제 정상 작업](evidence/31-oldest-cleanup-actions.json) · [VM 보존](evidence/31-oldest-vm-preserved.json) · [IP 반환](evidence/31-temporary-shortage-released.json).
