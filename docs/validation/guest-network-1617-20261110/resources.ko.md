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

# 확인용 자원

관리자 기본 보기에서 아래 규칙을 확인할 수 있다. 양쪽 브라우저는 신규 UI 규칙의 할당된 VM 탭에 남겼다. 신규4개 규칙과 기존 VM·NIC·controller를 삭제하지 않았다.

|클러스터|시험 규칙|VIP:port|UI|
|---|---|---|---|
|31|qa-gn1617-31-same-vip-lb|10.210.31.188:19018|[상세](http://10.10.31.10:8080/client/#/ilb/237808a1-e9d2-4401-a5d7-38dc1e73ccf6?tab=details) · [할당 VM](http://10.10.31.10:8080/client/#/ilb/237808a1-e9d2-4401-a5d7-38dc1e73ccf6?tab=loadbalancerinstance)|
|31|qa-gn1617-31-api-same-vip-lb|10.210.31.188:19019|[상세](http://10.10.31.10:8080/client/#/ilb/12844f26-8f83-4c99-8ba5-dd9aa8796534?tab=details) · [할당 VM](http://10.10.31.10:8080/client/#/ilb/12844f26-8f83-4c99-8ba5-dd9aa8796534?tab=loadbalancerinstance)|
|32|qa-gn1617-32-same-vip-lb|10.211.32.150:19018|[상세](http://10.10.32.10:8080/client/#/ilb/87210bec-2e3b-410c-89f6-6e6941f2e1d7?tab=details) · [할당 VM](http://10.10.32.10:8080/client/#/ilb/87210bec-2e3b-410c-89f6-6e6941f2e1d7?tab=loadbalancerinstance)|
|32|qa-gn1617-32-api-same-vip-lb|10.211.32.150:19019|[상세](http://10.10.32.10:8080/client/#/ilb/2f68c7ab-7e94-485d-86d8-817059508144?tab=details) · [할당 VM](http://10.10.32.10:8080/client/#/ilb/2f68c7ab-7e94-485d-86d8-817059508144?tab=loadbalancerinstance)|

기존19016 규칙은 qa-gn1616-31-allocated-lb/qa-gn1616-32-allocated-lb로 유지했다. controller b1010/b484와 backend qa-gn1616-31-allocated-vm/qa-gn1616-32-allocated-vm을 재사용했다. 기존 다른 VIP의19017 규칙과 원래31 conditional 복구 규칙도 보존했다. 이번에 생성/삭제한 VM·네트워크·VPC·NIC는0이고, 새 Public IP 풀이나 물리 스위치/호스트 설정을 만들지 않았다.

계정/프로젝트를 임의로 옮기거나 권한을 추가하지 않았다. 사용자 삭제 지시 전까지 확인용 자원을 보관한다.
