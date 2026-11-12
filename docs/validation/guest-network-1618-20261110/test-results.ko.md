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

# 검사·실제 UI와 통제 분기

## 소스 검사

263검사/11 suite와 변경 파일 lint·WSL ext4 UI 빌드가 통과했다. 신규30검사는 단일/복수·포트 경계와 잘못된 값·안전한 상태 문자열·교체/진행/실패/권한/프로젝트/route 문맥을 다룬다. 기존 Status/PSK/공통 상세/연결 링크/Internal LB/프로젝트 회귀를 포함한다.

초기에는 새 테스트의 포맷 lint와 Status 대역의 Boolean 타입 누락이 실패했다. 실제 공통 Status의 Boolean 계약에 맞게 대역을 수정해 같은 주장을 유지하고 최종 전체 관련 suite를 재실행했다. 기존 Vue 아이콘 중복 등록·Browserslist/자산 크기 경고가 있었고 최종 오류는0이다. 전체 UI suite나 전체 Cloud CI 녹색을 주장하지 않는다. 자동 checks는 별도로 보고한다.

[최종 검사/빌드 선별](evidence/tests-build-selected.json) · [소스 해시](evidence/product-build-attestation.json).

## 실제 서버 데이터와 통제 읽기

실제31/32 API의 규칙19018→22/Active를 상세의 포트·정상 배지와 대조했다. 실제 여러 LB 항목의19016/19018/19019도 목록에서 읽힌다. 기존 네트워크 링크의 실제 진입/브라우저 뒤로 복귀와 관리자 프로젝트 기본 보기↔Shared 왕복을 확인했다.

현재 API는 LB 항목당1개 규칙을 반환한다. 한 항목의2행 배열과 Add 상태/가상머신443은 **브라우저 XHR 읽기 응답만** 통제한 표시 검사다. 서버 생성 API/DB·실제 LB/HAProxy를 바꾸거나 복수 배열이 서버에 배포됐다고 표현하지 않는다. 빈 배열·필드 자체 누락·부분 규칙·503도 통제 읽기이며 각각 실제 업데이트로19018/22/정상을 복구했다.

프로젝트 경합은 실제 응답을 잡아둔 뒤 기존 프로젝트 전환을 수행하고 늦은 응답을 전달했다. 양쪽 requestCancelled=false로 전달됐지만 새 프로젝트 dashboard에 이전 규칙0이다. 초기에 통제 읽기와 같은 주소 재조회가 겹쳐 자동화 대기가 끝난 시점을 맞추지 못했다. 조회/통제/정리를 분리하고 기존 검증의 응답 정리 순서를 적용해 최종 양쪽 경로를 통과했다. 제품 실패나 브라우저가 지원하지 않는 제어 방법의 성공으로 집계하지 않는다.

[31 실제 API](evidence/31-actual-rule-api.json) · [32 실제 API](evidence/32-actual-rule-api.json) · [31 복수 통제](evidence/31-multi-read-proof.json) · [32 복수 통제](evidence/32-multi-read-proof.json) · [31 프로젝트 경합](evidence/31-late-project-state.json) · [32 프로젝트 경합](evidence/32-late-project-state.json).

## 표준·반응형·역할

40배치의 페이지 overflow/모달·breadcrumb 경계를 확인했다. 기본36은 상세/목록/통제 복수×양쪽×3폭×2테마다. 추가4는 실제 VM NIC 모바일2개와 스크롤 후 새 규칙을 직접 읽는 모바일2개다. 즉시 테마에서 performance.timeOrigin은 동일하며 Source 포트/VM 포트/상태가 세로 배치된다. 실제 색상 대비는 라이트 레이블7.56:1·값14.68:1, 다크9.18:1·13.35:1이다.

VM 목록·상세·NIC·기존 네트워크 연결창/취소·breadcrumb 실제 이동과 기존 네트워크 링크를 비교했다. 변경 화면에 새 대화상자나 작업 버튼은 없다. 32 읽기 전용 프로젝트는4개 규칙을 표시하고31 해당 범위에는 Internal LB가 없다. 제한 API 생성/할당4건 거부와 기존 역할·멤버십 동일을 확인했다. 읽기 전용31 로그인은 첫 대기 시점에 완료되지 않아 정상 로그인 완료 후 범위/빈 목록을 다시 캡처했으며 새 제품 결함으로 판정하지 않았다.

[40배치](evidence/layout.json) · [색상 대비](evidence/text-contrast.json) · [읽기 전용31](evidence/31-readonly-ui.json) · [읽기 전용32 캡처](screenshots/32-readonly-project-list-rules.jpg).

## 배포·보존·검증 한계

양쪽670개 활성 정적 파일 해시·HTTP200·WEB-INF/설정·관리 JAR/PID가 일치했다. JAR은 이전#1617의59eee902…를 그대로 유지했다. 기존72규칙의backend/IP 매핑·VM/망/VPC/controller ID·User NIC·전원·권한이 동일하며 시험 자원 생성/삭제/변경0이다. 이전 Internal LB controller/실제 NIC/HAProxy 동작을 바꾸는 배포는 하지 않았다. 이번에는 LB 데이터 평면·부하/성능이나 서버 기능을 다시 구현/시험하지 않았다.

보호 Native8 worktree/12,421파일과 WSL14/107파일의 HEAD·staged/unstaged/status·파일 내용은 전후 동일하다. FT dirty main을 수정하지 않았다. 공개 자료는 UTF8/JSON/링크/비밀값과 원본 JPEG의 실제 viewport·signature·decoded 치수/해시를 검사한다.

[31 최종 감사](evidence/31-final-deployment-audit.json) · [32 최종 감사](evidence/32-final-deployment-audit.json) · [31 자원 보존](evidence/31-resource-preservation.json) · [32 자원 보존](evidence/32-resource-preservation.json) · [작업 트리 보존](evidence/protected-worktrees-summary.json).
