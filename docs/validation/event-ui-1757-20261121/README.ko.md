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

# EVT-05 이벤트 UI 표준과 목록 복귀 검증

2026-11-21 KST에 13번 테스트 Mold에서 Chrome으로 검증했다. VM은 목록·상세·이벤트 탭과 편집 모달을 읽고 취소하는 데 사용했다. 상태 변경에는 이번 검증용 이벤트만 사용했다.

## VM과 이벤트 비교

| 화면 | 확인 결과 |
| --- | --- |
| breadcrumb와 목록 | 공통 카드의 위치에서 업데이트 및 고급 검색을 사용할 수 있었다. 두 고급 검색 패널은 우측 정렬 팝오버이며 하단에 재설정과 검색을 배치한다. 이벤트는 보관 범위와 검색 칩을 한 번씩 표시한다. 조회 범위와 현재 헤더 프로젝트가 다르면 목록에 실제 조회 범위를 표시한다. |
| 상세와 탭 본문 | 이벤트는 breadcrumb와 요약 카드에 같은 제목을 표시하고, 상세 탭에 식별 정보와 상태를 표시한다. VM 이벤트 탭과 같은 갱신·열 선택·검색·테이블 구조를 타임라인에서 사용한다. 이벤트 타임라인은 활성·보관 범위 선택을 추가하고 서버가 반환한 단계 순서를 유지한다. VM의 기존 이벤트 탭도 실제 행을 표시했다. |
| 390px 라이트·다크 | 두 화면에서 상세 탭이 상단에 표시되고 사이드바가 접혔다. 이벤트 표는 영역 346px 안에서 가로 스크롤됐다. VM 편집과 이벤트 CSV 모달 폭은 모두 366px이었다. |
| 768px 라이트·다크 | 두 화면에서 상세 탭이 좌측에 표시되고 사이드바가 축소됐다. 이벤트 표는 영역 644px 안에서 가로 스크롤됐다. 모달 폭은 모두 720px이었다. |
| 1280px 라이트·다크 | 기본 사이드바 상태에서 상세 탭이 좌측에 표시됐다. 이벤트 표는 영역 980px 안에서 가로 스크롤됐다. 모달 폭은 모두 720px이었다. |
| 대화상자 | VM 편집과 이벤트 CSV는 헤더·본문·하단 버튼 구조를 공유했다. 여섯 화면 조합에서 Tab 시 모달 안에 포커스가 있었고 취소 후 작업 버튼으로 돌아왔다. 삭제는 위험 버튼과 대상, 보관은 대상과 영향이 표시됐다. |

## 목록 상태와 작업 결과

- 기본 보기에서 키워드·유형·기간·리소스 UUID로 조회했다. 생성일 내림차순 2페이지의 20개 행은 상세와 타임라인을 거쳐 breadcrumb로 돌아온 뒤에도 순서와 UUID가 동일했다.
- 시험 프로젝트에서 키워드·유형·기간·생성일 오름차순을 적용했다. UI에서 다음 페이지로 이동해 2행을 확인한 뒤 상세와 타임라인을 열었다. breadcrumb와 브라우저 뒤로 가기는 모두 동일한 프로젝트의 2페이지에 같은 두 행을 복원했다.
- 활성·보관 상세를 직접 열면 상세 URL의 프로젝트와 이벤트 보관 상태에 맞는 목록으로 이동했다. 헤더가 기본 보기이고 명시적 프로젝트 쿼리가 있는 보관 목록에서는 조회 범위 안내가 나타났다. 상세와 타임라인을 거쳐 돌아와도 해당 보관 범위와 필터·정렬이 유지됐다.
- 프로젝트 활성 목록의 마지막 6페이지에서 해당 시험 이벤트만 보관했다. 상세는 보관 상태를 표시했고 breadcrumb로 돌아오면 동일한 검색 조건의 5페이지로 보정됐다.
- CSV 취소·포커스 복귀와 확인 시 Chrome의 `event.csv` 다운로드 시작을 확인했다. 파일 내용과 보관 상태는 #1753에서 검증했다. 삭제 취소 후 상세가 유지됐다. 열린 삭제 창의 대상이 먼저 보관된 경우 확인 요청이 HTTP 431로 거부됐고 모달 본문에 업데이트 안내가 표시됐다. 영구 삭제 성공 사례는 #1754에서 검증했다.

## 빌드와 적용

- 로컬 `ablestack-europa`와 `upstream/ablestack-europa`는 `25e2ab7eda1abe17490ccd577deceb1f3f6ba63e`에서 일치했다.
- UI 집중 테스트 8개 스위트 87건, 변경 파일 ESLint, Vue CLI 빌드, `git diff --check`가 통과했다. 테스트용 UI 빌드는 번들 압축을 끈 프로덕션 모드로 실행했다.
- UI 정적 파일 704개를 배포하고 기존 UI 설정의 해시를 대조했다. HTTP `index.html`의 SHA-256은 `4ca4b2507d522532542616d512daf3beb54fa826882b0f372f34d460f361229f`였으며 Chrome은 `app.9c135c6b.js`를 로드했다. Mold 서비스는 활성 상태였다.
- 표시 모드와 뷰포트를 원래대로 복원했다. 시험용 SSH 공개 키 3개를 삭제한 뒤 시험 계정·프로젝트가 각각 0건임을 확인했다.

[#1757 검증 댓글](https://github.com/ablecloud-team/ablestack-cloud/issues/1757#issuecomment-7056124468) · [Epic PR #1765](https://github.com/ablecloud-team/ablestack-cloud/pull/1765)
