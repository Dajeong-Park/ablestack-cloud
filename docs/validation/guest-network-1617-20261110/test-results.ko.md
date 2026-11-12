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

|클러스터|경로|실제 job|결과|
|---|---|---|---|
|31|UI 생성19018|e96ec6bc-93bf-4943-beb4-fd2f86f1862c|1|
|31|UI VM 할당19018|dd839a9b-e675-4633-beb4-61e10d6d2cee|1|
|31|직접 API 생성19019|297ea681-3570-4d71-b5ec-639e5b2e43fe|1|
|31|직접 API VM 할당19019|8c47a840-4835-4230-a6b4-6bf88fc4b0dc|1|
|32|UI 생성19018|ae7d7f08-eadb-4f32-a0c2-a0b065356bcf|1|
|32|UI VM 할당19018|e9df052e-2fa7-45f7-8be3-0f028d778d2e|1|
|32|직접 API 생성19019|63914521-2213-4b14-b704-70b8d100a3bd|1|
|32|직접 API VM 할당19019|5128a577-1af9-4f26-a603-26f2c7abbab1|1|

양쪽 UI의 생성·할당은 각각POST1이며 최종 job1 XHR·자동 종료/목록·실제 API와 대조했다. 중복 포트의 오류 창에서 Source 포트만 바꿔 성공했고 이름·설명·VIP·VM port를 유지했다. 이전에는 같은 조건 자체가 different network537이었다. 수정 후 API/실제 UI의 중복19016은 range specified537, 실제 다른 backend network는 different network537로 계속 거부된다. 생성 실패마다 규칙 잔류0을 API로 확인했다.

## 실제 런타임과 NIC

|클러스터|기존 controller|같은 VIP listener|backend|
|---|---|---|---|
|31|b-1010-VM|10.210.31.188:19016/19018/19019|10.210.31.173:22|
|32|b-484-VM|10.211.32.150:19016/19018/19019|10.211.32.181:22|

각 LB 게스트에 호스트의 기존 관리 SSH 경로로 접속해 eth0 IP·ss listener·HAProxy server 행을 대조했다. 전후 virsh domiflist의 인터페이스/bridge/MAC가 같고 전체 controller ID·개수와 대상 host가 동일하다. JSON 저장의 말미 newline 정규화 차이는 정규화 후 비교했다. 물리 NIC 변화로 판정하지 않는다. backend QGA의 실제 IP/MAC와 API NIC도 일치하며 VPC router와 같은 호스트31.1/32.1 배치다. 이번에는 LB backend 분산·성능 측정과 별도 데이터 평면 부하 시험을 하지 않았다.

[31 실제 guest](evidence/31-same-vip-guest-runtime.json) · [32 실제 guest](evidence/32-same-vip-guest-runtime.json) · [31 controller/NIC](evidence/31-controller-host-nics-after.json) · [32 controller/NIC](evidence/32-controller-host-nics-after.json) · [31 backend QGA](evidence/31-backend-actual-nics.json) · [32 backend QGA](evidence/32-backend-actual-nics.json).

## UI·역할·로컬 검증 범위

생성/할당×31·32×390/768/1280×light/dark24배치에 VM 모바일2배치를 더했다. 모달/페이지 overflow·breadcrumb 경계, 새로고침 없는 즉시 테마(timeOrigin 동일), 기본 보기↔Shared 프로젝트 왕복을 확인했다. 실제 VM 목록·상세·NIC·기존 네트워크 연결창/취소·breadcrumb 이동을 비교했다. 기존 상세의 규칙 raw JSON은 값이 맞지만 가독성이 부족해#1618로 분리했고 표현 개선 완료로 주장하지 않는다.

읽기 전용 계정의 직접 생성/할당 API4건은31 각각432·32 각각401로 거부됐고 역할/멤버십은 전후 동일하다. 이번에 읽기 전용 계정으로 UI 세션 전체를 재실행한 것은 아니며 관리자 UI/직접 제한 API·정책 전후 감사를 구분한다. 기존#1616의 읽기 전용 native UI 가드는 변경하지 않았다.

WSL ext4 변경 server 모듈의614개 제품 소스/352개 테스트 소스를 컴파일하고 관련2 suite/23검사·package·Checkstyle0을 통과했다. 수정 전 회귀1건 실패를 별도로 보존했다. 기존 duplicate org.json/SLF4J 경고는 있었으며 최종 오류/실패0이다. RAT는 명령에서 skip했고 자동 License Check는 별도 판정한다. full server tests·전체 Cloud 빌드·수동 Actions·UI 빌드는 실행하지 않았다.

활성 UI670파일·WEB-INF/설정·기존 backend와 NIC/VM/망/VPC·권한을 보존했다. 시험 규칙4개만 추가했고 기존68개 규칙 연결은 동일하다. 보호 Native8 worktree/12,383파일과 WSL14/107파일의 HEAD·staged/unstaged·파일 경로/내용 대조 결과는 보호 요약에 기록한다. FT dirty main을 변경하지 않았다.

[최종 집중 검사](evidence/module-build-selected.json) · [31 보존](evidence/31-resource-preservation.json) · [32 보존](evidence/32-resource-preservation.json) · [이미지 검사](evidence/capture-audit.json).
