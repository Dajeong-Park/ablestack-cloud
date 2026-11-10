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

# 남은 항목과 해결 순서

1. **[#1620](https://github.com/ablecloud-team/ablestack-cloud/issues/1620)** — LB 인증서API의projectid생략시프로젝트역할deny우회차단. 명시/생략/불일치×assign/remove×허용/거부/비구성원과개인소유·관리자경계를우선검증한다.
2. **[#1619](https://github.com/ablecloud-team/ablestack-cloud/issues/1619)** — SSL창역할가드·실패복구·MoldDialog/모바일표준. API정책을완화하지않고거부역할의요청0, 권한별버튼,401/503/job2후복구,390/768/1280과즉시테마·프로젝트응답역전회귀를완료한다.
3. **#1569 준비된잔여** — VPN서비스철회의모든역할/중복·동시접속·다중서비스조합, 인증서체인/만료/잘못된인증서·TLS프로토콜/다른stickiness, 사용자지정clone/다른유형·provider조합, VPC/Public/Internal LB의8192/Keepalive적용과한계·복구를확인한다. 이번Isolated/VirtualRouter의단일요청을다른제공자전체의성공으로확대하지않는다.
4. **환경준비후조건부** — 별도제공자가없다고확인된Health Monitor 정상/장애복구는환경차단유지. Netscaler/Tungsten 등준비후확인한다. 미준비IPv6/Routed·호스트간PVLAN등은각선행조건을따른다. 현재VLAN스위치구성제약때문에backend는VR와같은호스트를사용한다.
5. **63행최종통합** — 위결함과잔여조합해소후행단위전체수용기준을대조하고#1569/Epic종결여부를결정한다. 이번은C06/C07/P07 양쪽실패,부분51/환경차단6/적용제외3/완료0이다. LBbackend분산/성능측정은요청대로제외한다.

확인용자원은별도삭제지시전까지보관한다. Epic브랜치 `dhslove/epic-1554-guest-networks` 및 Draft PR #1577은유지하며이번신규2이슈와#1569/Epic은Open이다.
