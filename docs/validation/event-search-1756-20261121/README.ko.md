<!--
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this work
for additional information regarding copyright ownership. The ASF licenses this
file to you under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy at
http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
-->

# EVT-04 이벤트 검색·생성일 서버 정렬 검증

2026-11-21 KST에 13번 테스트 Mold에서 [#1756](https://github.com/ablecloud-team/ablestack-cloud/issues/1756)을 검증했다. 시험 계정 생성 이벤트로 정확 조회를, 기록이 고정된 과거 하루의 관리자 로그인 이벤트로 다중 페이지 정렬을 검증했다.

## 검색과 정렬 계약

- 고급 검색은 키워드와 정확한 유형, 시작일·종료일, 이벤트 UUID, 리소스 유형·UUID를 기존 레벨·상태·도메인·계정 필터와 조합한다. 날짜는 관리 서버 시간대를 사용하며 양쪽 날짜를 포함한다. 13번 응답의 시각 오프셋은 `+0900`이었다.
- `eventuuid`는 공개 UUID를 직접 일치시키는 목록 필터다. 유효한 UUID의 결과가 범위에 없으면 0건이다. 기존 상세 조회에는 `id`를 사용한다. 리소스 UUID에는 리소스 유형이 필요하다.
- 일반 이벤트 목록의 `sortkey=created`와 `sortorder=asc|desc`는 생성일과 ID를 같은 방향으로 정렬한 뒤 페이지를 적용한다. UI는 URL에 정렬을 유지하며 API 메타데이터가 이 계약을 제공할 때 생성일 정렬 제어를 표시한다.
- 유형 목록은 `listEventTypes`에서 조회한다. 목록을 불러오지 못하면 정확한 코드 입력과 키워드 검색을 사용할 수 있다.

## 브라우저와 API 확인

| 사례 | 확인 결과 |
| --- | --- |
| 고급 검색 조건 7개 | 키워드·유형·시작/종료일·이벤트 UUID·리소스 유형/UUID를 함께 보내 시험 이벤트 1건을 확인했다. |
| 불일치 및 유효성 | 유형이 다르면 0건이었다. 리소스 유형 누락과 날짜 역전은 화면에서 차단됐다. API로 기간 외 및 없는 이벤트 UUID의 0건을 대조했다. |
| 재진입과 범위 | 취소 후 조건 유지, URL 재진입과 폼 값 복원을 확인했다. 보관 보기에서도 7개 조건이 적용됐다. 초기화는 검색 조건을 지우고 보관 범위를 유지했다. 실제 프로젝트의 유형·UUID 조회는 해당 프로젝트의 1건을 반환했다. |
| 오름차순 | 브라우저에서 생성일을 누른 뒤 다음 페이지로 3회 이동했다. 네 페이지에 20·20·20·6건이 표시됐다. 모든 행의 UUID 순서가 대응 서버 응답과 일치했고 페이지 경계까지 시각 오름차순이었다. |
| 내림차순 | 마지막 페이지에서 생성일을 다시 누르면 1페이지로 돌아갔다. 네 페이지의 66건은 중복·누락 없이 오름차순과 정확히 역순이었다. 같은 초에 생성된 이벤트도 포함됐고 새로고침 이후 마지막 페이지와 정렬이 유지됐다. |
| 유형 목록 실패 | Chrome 검증 탭에서 유형 목록 요청을 일시 차단해 안내를 확인했다. 코드와 키워드를 입력한 조회는 HTTP 200을 반환했고 차단을 해제했다. |

최종 Chrome에서 UUID 필터 칩의 한국어 이름과 보관 결과를 확인했다. 검증 탭을 닫기 전에 기본 보기로 복원했고, 시험 계정과 프로젝트는 조회 0건으로 정리했다.

## 빌드와 적용

- WSL 로컬·origin·upstream Europa 기준 `25e2ab7eda1abe17490ccd577deceb1f3f6ba63e`, 차이 `0 0`.
- 백엔드 집중 39건, UI 집중 21건, 변경 파일 ESLint와 UI 빌드 통과.
- 관리 서버 JAR의 클래스 2개를 교체했고 다른 92,941개 엔트리의 CRC를 대조했다. JAR SHA-256은 `4b0b61ab3a7639dd1334d5eb0d77e3e14c27e0ef058cf6dd6fae2720d6162a7a`이다.
- UI 704개 파일을 검증했고 HTTP `index.html` SHA-256은 `166588cba0f8278e9901983b97350be90b844f2da6abd40cadcf3d5914dcfe8a`였다. Chrome에서 `app.c9a5b889.js`를 확인했다. 최종 필터 칩 확인에 사용한 번역 두 파일은 별도로 적용했다.

[Epic PR #1765](https://github.com/ablecloud-team/ablestack-cloud/pull/1765)

[이슈 검증 댓글](https://github.com/ablecloud-team/ablestack-cloud/issues/1756#issuecomment-7055817147)
