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

# 회귀 설계와 신규 개선 방향

기존 Epic #1554와 Draft PR #1577을 유지한다. 제품 수정 없이 실제 시험 자원만 사용해 API 입력/결과, UI 상태, 작업job, VR/VM runtime, 통신을 서로 대조했다. 기본 VM NIC와 원래 오퍼링·인증서를 보존하고 테스트 후 복구한다. 전용 VPN 서비스 재생성은 PSK 교체가 정상 API 동작이므로 새 값을 비공개 시험 자료에만 갱신했다.

1. VPN: 기준 접속→사용자 철회→기존 세션/신규 인증 차단→owner 복구→서비스 철회→PPP 차단→서비스 재생성/새PSK→실제 통신. 일반 구성원/도메인 관리자의 전용 사용자 삭제/복구와 제한 역할의 거부를 함께 기록한다.
2. TLS: 기존 인증서A→UI 인증서B→실제지문B→UI 연결제거→cert0/TLS실패→UI 인증서A 복구→실제지문A. 단일 backend18443을19111에 연결하고 HTTPS backend 스위치를 껐다 켜서 실제 실패/복구를 확인한다.
3. 오퍼링: 기존 QA NAT 기본 UI복제→19항목 대조→복제본8192/Keepalivetrue 저장→시험망에 API적용→실제HAProxy/HTTPS→원래오퍼링복원→4096/false·VPN/HTTPS 재검증.

신규 [#1619](https://github.com/ablecloud-team/ablestack-cloud/issues/1619)는 SSL 창의 역할별 조회/할당/해제 권한을 각각 가드하고 핸들러도 재검사한다. MoldDialog md·VM 표준 세로 입력·폭100% 선택창·읽을 수 있는 긴 이름·하단 버튼을 적용한다. 동기401/503·job2·응답 유실을 분리하고 초안/재시도/중복 차단/문맥 폐기를 구현한다. 현재30vw는390px에서약117px가 되어 내부 가독성에 실패한다.

신규 [#1620](https://github.com/ablecloud-team/ablestack-cloud/issues/1620)는 대상 LB의 프로젝트를 리소스로부터 해석해 명시projectid 유무와 무관하게 기존 프로젝트 역할deny를 적용한다. 불일치projectid는 거부하고 개인소유/관리자/허용구성원은 보존한다. 변경 전 두 API의 entity lookup·ACL 문맥 설정 순서를 조사하고 관련 없는 전역 정책을 바꾸지 않는다.

이 두 이슈는 이번에 구현하지 않았다. 상세 설계·수용 기준은 각 이슈 본문에 게시했다. 보안 경계를 먼저 보강하고 UI 가드/실패 복구/모바일을 구현한 뒤 이번 재현을 음성 회귀로 전환한다.
