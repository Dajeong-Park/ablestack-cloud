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

# Epic #1827 Mold 도메인 메뉴 개선 구현 준비

2026-11-22 KST 기준 로컬 `ablestack-europa`의 `0f8fe2f808cd797e9404b383b4b46f6701dfdb66`에서 `dhslove/epic-1827-domain-management`를 분기했다. 13번 테스트 클러스터 검증과 항목별 재현 절차는 상위 및 하위 이슈에 기록했다. [Epic #1827](https://github.com/ablecloud-team/ablestack-cloud/issues/1827)

## 구현 순서와 선행 의존성

| 단계 | 우선순위 | 하위 이슈 | 선행 이슈 |
| --- | --- | --- | --- |
| 1 | P1 | [#1838](https://github.com/ablecloud-team/ablestack-cloud/issues/1838) DOM-01 · 도메인 검색 결과와 선택·작업 대상 일치 | 없음 |
| 1 | P1 | [#1839](https://github.com/ablecloud-team/ablestack-cloud/issues/1839) DOM-02 · 도메인에서 템플릿·ISO 조회 범위 보존 | 없음 |
| 2 | P2 | [#1840](https://github.com/ablecloud-team/ablestack-cloud/issues/1840) DOM-03 · 도메인 편집에서 네트워크 도메인값 비우기 | [#1838](https://github.com/ablecloud-team/ablestack-cloud/issues/1838) |
| 2 | P2 | [#1841](https://github.com/ablecloud-team/ablestack-cloud/issues/1841) DOM-04 · 도메인 계층 이동과 고급 계층 탐색 제공 | [#1838](https://github.com/ablecloud-team/ablestack-cloud/issues/1838) |
| 병행 | P2 | [#1842](https://github.com/ablecloud-team/ablestack-cloud/issues/1842) DOM-05 · 도메인 태그 작업과 LDAP 상태 노출 정합화 | 없음 |
| 병행 | P2 | [#1843](https://github.com/ablecloud-team/ablestack-cloud/issues/1843) DOM-06 · 도메인 한도·사용량 표시와 재계산 일치 | 없음 |
| 3 | P2 | [#1844](https://github.com/ablecloud-team/ablestack-cloud/issues/1844) DOM-07 · 도메인 목록·상세·탭·모달에 가상머신 UI 표준 적용 | [#1839](https://github.com/ablecloud-team/ablestack-cloud/issues/1839), [#1840](https://github.com/ablecloud-team/ablestack-cloud/issues/1840), [#1841](https://github.com/ablecloud-team/ablestack-cloud/issues/1841), [#1842](https://github.com/ablecloud-team/ablestack-cloud/issues/1842), [#1843](https://github.com/ablecloud-team/ablestack-cloud/issues/1843) |

1단계는 #1838과 #1839다. 첫 착수는 #1838의 검색 결과·선택 UUID 정합성이다. #1839의 도메인 이미지 범위는 독립적으로 구현할 수 있다.

2단계에서 #1840과 #1841은 #1838이 확정한 선택·갱신 흐름을 사용한다. 편집 API 계약과 이동 권한·후보 설계는 먼저 진행할 수 있다. #1842의 태그·LDAP 노출과 #1843의 도메인 한도는 병행할 수 있다.

3단계 #1844는 이미지 범위, 편집, 이동, 태그·LDAP, 한도가 확정된 후 VM 표준 UI와 역할별 통합 인수를 진행한다. #1838은 #1840·#1841을 통해 선행 조건에 포함된다.

계정 이미지 범위 #1820과 공통 한도 처리 #1824는 PR #1826으로 Europa에 병합됐다. 도메인 UUID 단독 필터, 도메인 저장 후 갱신과 계층별 한도는 이번 구현에서 인수한다. 삭제 수명주기는 #1717의 검증 결과를 재사용한다. [병합 PR #1826](https://github.com/ablecloud-team/ablestack-cloud/pull/1826) · [삭제 #1717](https://github.com/ablecloud-team/ablestack-cloud/issues/1717)

## 13번 테스트 클러스터 인수 기준

- 13번 클러스터의 시험 도메인에서 0건 검색, 연속 요청, 변경으로 조건에서 벗어난 도메인, 관련 자원 왕복을 확인한다. 트리·상세·작업의 UUID가 일치하고 잘못된 이전 대상에 변경 작업이 열리지 않아야 한다.
- 도메인 경유 이미지 목록에서 `domainid`를 필터 칩·요청·페이지에 유지한다. 소유 자원이 없으면 0건을 표시한다. 계정 범위와 일반 이미지 진입은 병합된 공통 동작을 회귀 기준으로 사용한다.
- 네트워크 도메인 유지·변경·명시적 비우기, 계층 이동 전후 UUID·상위 경로·하위 도메인, 권한 밖 목적지와 서버가 거절한 요청의 결과를 확인한다.
- 일반 태그 작업 노출, LDAP 설정과 연결 상태, 프로젝트 사용량과 적용 한도, 저장 직후 재조회 및 유형별 재계산을 확인한다. LDAP 실연동은 시험 디렉터리가 있는 환경에서 인수한다.
- 도메인 트리와 UUID 상세를 VM 기준으로 390/768/1280px와 라이트·다크에서 확인한다. 키보드, 긴 경로, 빈 결과, 실패 후 재시도를 포함한다. 최고 관리자·도메인 관리자·일반 사용자 결과와 시험 리소스 정리를 기록한다. [VM 표준 #1201](https://github.com/ablecloud-team/ablestack-cloud/issues/1201) · [모달 표준 #1213](https://github.com/ablecloud-team/ablestack-cloud/issues/1213)
