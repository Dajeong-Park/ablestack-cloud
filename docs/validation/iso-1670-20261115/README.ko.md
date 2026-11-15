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

# ISO-05 #1670 목록·검색·복원 구현 및 13번 검증

Epic #1664 · PR #1682 · 개발 순서 5/8 · 2026-11-15 KST.

## 설계

- ISO 전용 query allowlist로 keyword/q, 공유 필터, 고급 조건·tag, page/pagesize, 현재 페이지 정렬을 보존한다. 상세/코멘트/Zone과 breadcrumb·뒤로가기에서 같은 상태를 복원한다.
- URL의 owner 표시는 계정/역할/프로젝트/API 지원 필드의 탐색 경계이며 권한이 아니다. 인증값을 URL에 넣지 않는다. 경계 변경은 행·선택·검색과 이전 응답을 무효화한다.
- bootable/isready/ispublic/hypervisor/userdataid는 현재 listIsos 메타데이터가 지원할 때만 노출한다. 기존 관리자 storageid/imagestoreid, 이름 정확 검색/keyword 부분 검색과 tag 계약을 보존한다.
- 상세 요청에는 목록 조건/페이지/return 표시를 전달하지 않는다. API의 count/page를 유지하고 정렬 값은 서버에 보내지 않는다. 잘못된 UUID/boolean/미지원 조건과 조회 오류를 빈 결과 성공으로 바꾸지 않는다.
- 이름은 남는 폭을 우선 사용한다. 상태/OS/arch 등은 고정 폭·한 줄 ellipsis·hover/focus 전체 값으로 표시한다. 도움말은 필드/열 tooltip에만 둔다.
- 공통 변경은 ISO 조건으로 한정한다. 운영 UI와 canonical의 VPC 등 무관한 차이는 보존하며 전체 소스를 덮어쓰지 않는다.

## 진행 상태

단위/공통 회귀·운영 입력 검증과 빌드를 준비 중이다. 실제 13번 UI 검증·시험 자원 정리 후 결과와 근거를 추가한다. 아직 완료 보고가 아니다.

## CI

기존 #926·#1044를 별도 OPEN 관리한다. 기능 변경의 새 실패를 기존 부채로 분류하지 않는다.
