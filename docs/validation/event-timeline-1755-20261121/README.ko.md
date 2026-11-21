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

# EVT-03 이벤트 타임라인 검증

2026-11-21 KST에 13번 테스트 Mold에서 [#1755](https://github.com/ablecloud-team/ablestack-cloud/issues/1755)를 검증했다. 예약·시작·완료를 생성하는 시험 계정 삭제 작업을 사용했다.

## 조회 계약

- 상세의 **이벤트 타임라인 보기**는 해당 이벤트 UUID를 `startid`로 전달한다. 서버는 동일한 조회 권한과 프로젝트 범위에서 이 이벤트를 먼저 찾고, 저장된 부모 ID를 사용해 가능한 단계의 집합을 조회한다.
- `timeline=true`는 생성일 오름차순과 같은 시각의 ID 오름차순을 적용한다. 페이지와 전체 건수는 같은 작업과 조건으로 계산한다. 타임라인에서 `archived`가 없으면 모두, `false`면 활성, `true`면 보관 단계가 표시된다.
- 부모가 제거된 경우에도 접근 가능한 자식의 부모 ID를 사용한다. 조회 범위가 제한되면 접근 가능한 단계만 표시한다. UI는 조회 범위, 보관 배지, 업데이트, 빈 결과 및 재시도를 제공한다.

## 13번 브라우저 및 API

| 시나리오 | 확인 결과 |
| --- | --- |
| 예약·시작·완료 각 상세에서 진입 | 같은 세 UUID가 예정됨 → 시작 → 완료 순서로 표시됐다. 같은 초에 생성된 세 기록의 순서도 일치했다. |
| 모두·활성·아카이브 | 시작만 보관한 작업은 모두 3건·활성 2건·아카이브 1건으로 표시됐다. 세 단계가 모두 보관되면 활성 0건·아카이브 3건이었다. 보관 행에는 배지가 표시됐다. |
| 부모 행 없음·보관 단독 | 부모를 제거한 작업의 시작·완료 2건이 표시됐다. 보관된 단독 이벤트는 1건으로 열렸다. |
| 페이지·기간·조회 오류 | 1건씩 두 번째 페이지에 시작 단계가 표시됐고 전체 수는 3건이었다. 결과가 없는 기간은 빈 화면이었고, 제거된 시작 ID를 열면 오류와 재시도가 표시됐다. |
| 프로젝트와 일반 사용자 | 프로젝트 상세·타임라인·행 링크에 동일 프로젝트 UUID가 유지됐다. 일반 사용자는 본인 로그인 타임라인 1건을 볼 수 있었고 관리자 범위 작업은 0건이었다. |

최종 Chrome 검증에서 기본 보기와 프로젝트 범위 안내를 각각 대조했다. 내부 조회 파라미터는 필터 칩에서 숨기고 상태 열 폭을 조정했다. 시험 계정·프로젝트는 조회 0건으로 정리되었고 검증 탭을 닫기 전에 기본 보기로 복원했다.

## 빌드와 배포

- WSL 로컬·origin·upstream Europa 기준은 `25e2ab7eda1abe17490ccd577deceb1f3f6ba63e`이며 차이는 `0 0`이었다.
- 백엔드 집중 38건, UI 집중 18건, 변경 파일 ESLint와 UI 빌드가 통과했다.
- 관리 서버 JAR에 클래스 2개를 교체했다. 나머지 92,941개 엔트리의 CRC를 대조했다. 관리 JAR SHA-256은 `24fc56f28ee6e18967dfabee89e4fabdae474a42a6bee31a5593b156473b7dd3`이다.
- 최종 UI 704개 파일과 HTTP 응답을 확인했다. `index.html` SHA-256은 `2083cfd23cae33e6ae40cb2eeb6973c5efa96952f069391a098276033229be82`였고 Chrome에서 `app.c723d339.js`를 확인했다.

[Epic PR #1765](https://github.com/ablecloud-team/ablestack-cloud/pull/1765)

[이슈 검증 댓글](https://github.com/ablecloud-team/ablestack-cloud/issues/1755#issuecomment-7055492508)
