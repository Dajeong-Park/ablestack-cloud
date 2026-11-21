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

# Epic #1792 Mold 역할 메뉴 개선 구현 준비

2026-11-21 KST 기준 `ablestack-europa`의 `3d14ed40689bef2ec958d29663f93903cde422b1`에서 구현 통합 브랜치 `dhslove/epic-1792-role-management`를 분기했다. 범위는 Mold 전역 역할 메뉴다. 재현 절차와 실제 화면·API 확인 결과는 Epic에 기록했다. [Epic #1792](https://github.com/ablecloud-team/ablestack-cloud/issues/1792)

## 구현 순서

| 순서 | 하위 이슈 | 선행 이슈 |
| --- | --- | --- |
| 1 | [#1793](https://github.com/ablecloud-team/ablestack-cloud/issues/1793) ROLE-01 · 규칙 검색·재정렬·실패 복구 | 없음 |
| 2 | [#1794](https://github.com/ablecloud-team/ablestack-cloud/issues/1794) ROLE-02 · 규칙 CSV 왕복 | #1793 |
| 병행 | [#1795](https://github.com/ablecloud-team/ablestack-cloud/issues/1795) ROLE-03 · 역할 유형과 목록 조회 | 없음 |
| 3 | [#1796](https://github.com/ablecloud-team/ablestack-cloud/issues/1796) ROLE-04 · 기본 역할과 작업 가용성 | #1793, #1794 |
| 4 | [#1797](https://github.com/ablecloud-team/ablestack-cloud/issues/1797) ROLE-05 · 가상머신 UI 표준과 통합 회귀 | #1795, #1796 |

이슈 #1793에서 전체 규칙·검색 결과와 저장 실패 처리를 먼저 정리한다. #1794의 내보내기는 이 목록을 사용하고, #1796은 규칙 변경 가드와 CSV 강제 가져오기 확인을 앞선 작업에 적용한다. #1795는 조회 계약과 유형 UI를 독립적으로 진행할 수 있다. #1797에서 목록·규칙 탭·작업 대화상자를 통합하고 전체 흐름을 검증한다.

## 13번 클러스터 완료 기준

- 시험 역할에서 전체와 필터 목록을 비교한다. 실제 순서, 검색어, 규칙 편집 상태와 실패 후 초안을 확인한다. 재정렬 시 서버의 전체 순서·동시 변경 검증을 확인한다.
- CSV에서 한글, 쉼표, 인용 부호, 개행을 포함한 설명과 허용/거부·규칙 순서를 내보낸 후 다시 가져온다. 범위와 오류를 표시하고 강제 가져오기에는 대상과 영향을 보여 준다.
- `ResourceAdmin` 선택, 이름·유형·상태·UUID 조회와 총건수, 검색에서 상세로 이동한 뒤의 복귀 문맥을 확인한다. 관리자와 제한 권한에서 기본/사용자 정의 역할의 읽기·쓰기 작업 가용성을 대조한다.
- VM 목록·상세·볼륨·편집 창을 표준으로 삼아 역할 목록·상세·규칙·이벤트와 작업 대화상자를 390/768/1280px 라이트·다크에서 대조한다. 키보드 포커스, 긴 값, 빈 상태와 오류가 있는 경우를 확인한다.
- 프로젝트 역할 권한 및 네트워크 권한은 기존 결과를 참조한다. 시험 역할을 사용하고 완료 후 삭제와 목록 복구를 확인한다. [프로젝트 #1767](https://github.com/ablecloud-team/ablestack-cloud/issues/1767) · [VM 탭 표준 #1201](https://github.com/ablecloud-team/ablestack-cloud/issues/1201) · [모달 표준 #1213](https://github.com/ablecloud-team/ablestack-cloud/issues/1213)
