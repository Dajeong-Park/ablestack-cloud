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

# Epic #1809 Mold 계정 메뉴 개선 구현 준비

2026-11-22 KST 기준 로컬 `ablestack-europa`의 `ed02beb036227531525da0092bf608f5c766e87d`에서 `dhslove/epic-1809-account-management`를 분기했다. 재현 기록과 항목별 완료 기준은 상위 및 하위 이슈에 있다. [Epic #1809](https://github.com/ablecloud-team/ablestack-cloud/issues/1809)

## 구현 순서

| 단계 | 우선순위 | 하위 이슈 | 선행 이슈 |
| --- | --- | --- | --- |
| 1 | P1 | [#1819](https://github.com/ablecloud-team/ablestack-cloud/issues/1819) ACC-01 · 계정 추가의 진입 도메인과 역할 기본값 보존 | 없음 |
| 1 | P1 | [#1820](https://github.com/ablecloud-team/ablestack-cloud/issues/1820) ACC-02 · 계정에서 템플릿·ISO로 이동할 때 소유 범위 보존 | 없음 |
| 1 | P1 | [#1821](https://github.com/ablecloud-team/ablestack-cloud/issues/1821) ACC-03 · 계정 일괄 상태 작업의 대상과 최종 결과 일치 | 없음 |
| 2 | P2 | [#1822](https://github.com/ablecloud-team/ablestack-cloud/issues/1822) ACC-04 · 계정 편집의 현재값·명시적 비우기 및 UUID 요청 적용 | [#1821](https://github.com/ablecloud-team/ablestack-cloud/issues/1821) |
| 2 | P2 | [#1823](https://github.com/ablecloud-team/ablestack-cloud/issues/1823) ACC-05 · 계정 검색·목록 복귀 및 API 노출 기준 개선 | [#1821](https://github.com/ablecloud-team/ablestack-cloud/issues/1821) |
| 병행 | P2 | [#1824](https://github.com/ablecloud-team/ablestack-cloud/issues/1824) ACC-06 · 계정 한도 저장 후 표시 갱신과 태그 조회 검증 | 없음 |
| 3 | P2 | [#1825](https://github.com/ablecloud-team/ablestack-cloud/issues/1825) ACC-07 · 계정 목록·상세·탭·대화상자에 가상머신 UI 표준 적용 | [#1819](https://github.com/ablecloud-team/ablestack-cloud/issues/1819), [#1820](https://github.com/ablecloud-team/ablestack-cloud/issues/1820), [#1822](https://github.com/ablecloud-team/ablestack-cloud/issues/1822), [#1823](https://github.com/ablecloud-team/ablestack-cloud/issues/1823), [#1824](https://github.com/ablecloud-team/ablestack-cloud/issues/1824) |

1단계는 #1819·#1820·#1821이다. 도메인과 역할 기본값, 이미지로 이동할 때 사용하는 계정 범위, 상태 작업의 대상 판정을 각각 수정한다. 먼저 #1819를 착수 대상으로 삼고 세 항목의 구현은 병행할 수 있다.

2단계에서 #1822는 #1821의 상태별 가용성 규칙을 편집에 적용하고, #1823은 상태 변경 후 선택 갱신과 검색 문맥을 목록에 연결한다. #1823의 서버 조회 검증은 먼저 진행할 수 있다. #1824는 계정 한도 갱신과 태그 계약을 독립적으로 확인한다.

3단계의 #1825는 앞서 정리한 계정 화면을 VM 표준에 맞추고 권한별 통합 인수를 진행한다. #1821은 #1822·#1823을 통해 선행 조건에 포함된다.

## 13번 테스트 클러스터 인수 기준

- 하위 도메인에서 새 계정 추가 시 진입 범위와 실제 역할이 일치하는지 확인한다. 계정에서 템플릿·ISO로 이동하는 경로는 대상 계정·도메인, 목록 결과와 복귀 범위를 확인한다.
- 개별·일괄 상태 변경은 기본 계정 보호, 혼합 상태, 작업의 접수·성공·부분 실패 및 목록 재조회를 확인한다. 계정 편집은 UUID와 변경된 필드의 값, 네트워크 도메인 비우기, API 키 정책 상속을 확인한다.
- 목록은 검색 조건·건수·정렬·페이지 복귀와 범위 변경 시 선택 해제를 확인한다. 한도 변경 후 상세와 제한 탭을 새로고침 없이 비교하고, 태그별 저장 및 재조회와 권한을 확인한다.
- 목록·상세·탭·대화상자를 VM 화면 기준으로 390/768/1280px, 라이트·다크에서 확인한다. 키보드 포커스, 긴 이름, 빈 결과, 저장 실패 후 복구를 점검한다. 최고 관리자·도메인 관리자·일반 사용자 세션 및 연동 설정 환경의 결과를 기록한다. [VM UI 표준 #1201](https://github.com/ablecloud-team/ablestack-cloud/issues/1201) · [대화상자 표준 #1213](https://github.com/ablecloud-team/ablestack-cloud/issues/1213)
- 독립된 시험 도메인과 계정을 사용하고 종료 후 시험 리소스와 사용자·계정·도메인의 부재를 확인한다.
