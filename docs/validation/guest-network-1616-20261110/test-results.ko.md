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

# 실제 작업·런타임·검사

## 성공 작업

| 조건 | 실제 UI 할당 job | 결과 | 실제 controller |
| --- | --- | --- | --- |
|31 Allocated 첫 할당(v1)|22f495ed-5df0-4cc9-9dec-eb5a604a488f|1|b-1010-VM Running|
|31 Implemented 추가(v1)|75804f8d-1636-47d7-a7fe-c2fd9647d31c|1|b-1012-VM Running|
|32 Allocated 첫 할당(v1)|4c59fde6-ba84-4ea9-baa8-664146945381|1|b-484-VM Running|
|32 Implemented 추가(v1)|c2efacfb-872d-43d8-a500-5c8bc9acad91|1|b-486-VM Running|
|31 Implemented 재할당(최종)|8c65fe64-915f-497e-b59d-5974e50cdba9|1|기존 b1012 재사용|
|32 Implemented 재할당(최종)|4038954e-95a6-4196-bd77-de7e0b401538|1|기존 b486 재사용|
|31 원래 실패 Tier 재시도(최종)|e85c5ae0-2bff-46bf-bfc2-d53105fe1456|1|b-1015-VM Running|

첫4건의 실제 POST/API 최종 job·게스트 런타임을 대조했다. 32 최초 UI poll buffer는 오래된 응답이 잘려 최종 job1 XHR 파일이 없으므로 POST receipt·API job1·UI 자동 닫힘/최종 캡처·게스트 상태로 입증한다. 마지막3건은 실제 UI의 최종 job1 XHR도 남겼다. 최종 배포 후 네 review controller의 Running·매핑·HAProxy를 다시 확인했다.

31 최초 대조는 `10.210.31.188:19016 →10.210.31.173:22`, 추가 대조 `.189:19017 →.173:22`이다.32는 `10.211.32.150:19016 →10.211.32.181:22`, 추가 `.153:19017 →.181:22`이다. 실제 virsh/QGA MAC·브리지 VLAN·게스트 IP·ss listener·HAProxy server 행을 확인했다. backend31 i-424-1009/32 i-236-483과 VPC router는 각각31.1/32.1 같은 호스트다. 원래31 i-439-1005도 r1016과31.1이다. LB controller 자체는 scheduler의 정상 배치를 유지했다.

[31 final bindings](evidence/31-final-target-bindings.json) · [32 final bindings](evidence/32-final-target-bindings.json) · [31 원래 runtime](evidence/31-original-final-runtime.json) · [31 첫 runtime](evidence/31-allocated-final-runtime.json) · [32 첫 runtime](evidence/32-allocated-final-runtime.json) · [31 추가 runtime](evidence/31-implemented-final-runtime.json) · [32 추가 runtime](evidence/32-implemented-final-runtime.json).

## 실패·복구와 검증 한계

v1 실제 shortage UI는2.305초에 job2·선택 보존했지만 Shutdown 잔류를 관측해 추가 수정했다. 최종 a1에서 역사적 Shutdown 복구와 실제 부족 API job `30fbe640…`는5.129초에 job2/530, UI job `6ecd407b…`는3.812초에 실패 안내/선택1/spinner0이었다. 양쪽 UI 실패/프로젝트 테스트와 실제 서버 부족 시험을 구분한다. 최종 shortage는31에서 수행했으며32 실제 Public IP 부족을 별도로 만들지는 않았다.

자원 부족을 만들 때31 회수 Public IP110/143만 전용 QA VPC에 임시 예약했다. 시험 후 두 주소를 모두 반환하고 원래 창에서 정상 재시도했다. 실패 VM1008/1013/1014는 정상 Cloud 정리로 활성 VM/volume/NIC/pending job0이다. 기존 실패 warm VM1007은 Error 상태로 역사적 증거를 남겼고 이 VM 자체가 복구됐다고 표현하지 않는다.

신규#1617의 같은 VIP/다른 포트 생성은31 실제537 동기 오류이며 job2가 아니다. 네트워크 ID Long 객체 비교를 원인으로 확인했다. 이번 성공 행렬의 추가 규칙은 다른 VIP를 사용했으므로 같은 VIP 신규 규칙 성공으로 확대하지 않는다. 32 같은 VIP 재현/수정은 다음 이슈다.

LB backend 분산·성능·여러 backend 부하 측정은 제외한다. 이번에는 배포/할당 job·런타임·NIC·설정 일치를 확인했으며 LB 데이터 평면 전체 회귀로 표현하지 않는다. 제공자 없는 Health Monitor 정상/복구도 환경 차단을 유지한다.

## UI·로컬 검사와 보존

24개 생성/할당 폭·테마와 VM 모바일2개, 실제 기본 보기/프로젝트 왕복·VM 목록/상세/NIC/연결창·breadcrumb를 확인했다. native 읽기 전용 해제 비활성, 실제 생성/할당 API는31 각각432/32 각각401로 거부됐다. 기존 role permissions/membership는 동일하다. 원본 JPEG75장의 live viewport/decoded 치수·해시를 검증했다.

WSL ext4 변경 모듈 package62/62·8 suite·Checkstyle0 통과. Maven 기존 duplicate org.json 경고·테스트 mock의 db.properties/SLF4J 경고는 있었으며 테스트 오류는0이다. full Cloud·수동 Actions·UI 재빌드는 하지 않았다. 자동 GitHub checks는 로컬/런타임 결과와 별도로 보고한다.

Native 보호8 worktree/12,314파일과 WSL14/107파일의 보호 HEAD·tracked diff·파일 경로/내용은 동일하다. Native raw status hash만 새 소유 scratch 디렉터리 필터의 이전1613 이름 때문에 차이가 났으며 모든 보호 파일/HEAD/diff는 같음을 별도 대조했다. 원시 status hash 동일이라고 표현하지 않는다.

[모듈 결과](evidence/module-build-selected.json) · [빌드 attestation](evidence/product-build-attestation.json) · [Native 보호](evidence/protected-native-summary.json) · [31 자원 보존](evidence/31-resource-preservation.json) · [32 자원 보존](evidence/32-resource-preservation.json) · [이미지 검사](evidence/capture-audit.json).
