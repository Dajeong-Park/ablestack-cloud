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

# EVT-01 이벤트 CSV 다운로드 검증

2026-11-21 KST에 13번 테스트 클러스터의 Mold를 검증했다. 기준 Europa는 `25e2ab7eda1abe17490ccd577deceb1f3f6ba63e`이며 로컬·origin·upstream 차이는 `0 0`이었다.

## API와 UI 계약

- `downloadEvents`는 기존 `ids`, `type`, `startdate`, `enddate`를 사용하고 접근 범위를 적용해 이벤트를 조회한다. 활성·보관 이벤트를 함께 내보낼 수 있다. 명시적 보관은 `archiveEvents`에서 처리한다.
- `response=json`의 `downloadeventsresponse`에 `success`, `filename`, `count`, `csv`가 반환된다. `csv`는 BOM을 포함한 CSV 텍스트로 UTF-8 인코딩해 저장한다. `count`는 헤더를 제외한 행 수이며, 필터가 0건을 반환하면 헤더만 포함한다.
- CSV는 기존 11개 열 순서를 보존한다. `key`는 기존 소비자를 위한 빈 열이다. 셀 인용으로 쉼표·따옴표·줄바꿈을 유지한다.
- Mold의 상세·선택 목록은 같은 CSV를 요청한다. 확인 대상은 대화상자를 열 때 고정된다. 마우스·Enter·Ctrl+Enter는 동일한 요청을 사용하며, 응답 대기 중 반복 제출을 막는다. 공통 MoldDialog의 제목·본문·푸터를 사용한다.

## 클러스터 실측

| 경로 | 대상 | 검증 |
| --- | --- | --- |
| Chrome 마우스·Enter·Ctrl+Enter | 활성 단건 | 각 1행, 각 410바이트, 세 파일과 API의 SHA-256 일치 |
| Chrome 마우스 | 보관 단건 | 1행, 302바이트, API SHA-256 일치 |
| Chrome 마우스 | 활성 복수 | 2행, 678바이트, API SHA-256 일치 |
| Chrome Ctrl+Enter | 보관 복수 | 2행, 517바이트, API SHA-256 일치 |
| API | 활성 단건·복수, 보관 단건·복수, 혼합, ID·유형·기간 조합, 0건 | HTTP 200 응답 7건을 CSV 파일로 저장하고 열·UUID·필드·행 수 대조 |
| API | 조건 누락, 기본 User 역할 | 각각 HTTP 431, 432. CSV 미반환 |
| Chrome 취소 | 활성 복수 대화상자 | 창 닫힘, 다운로드 이벤트 0건 |

- 브라우저가 쓴 임시 파일 6개와 API CSV의 전체 바이트가 일치했다. CSV 파서로 UTF-8 BOM, 11개 헤더, 계정 생성 시험 이벤트의 한글·쉼표·따옴표·줄바꿈과 조회 원문을 확인했다. 관리 Chrome에서 최종 `event.csv` 이름으로 변경됐다는 완료 신호는 확인하지 못했다.
- 4개 시험 이벤트의 다운로드 직전·API 후·Chrome 후 보관 상태를 개별 UUID로 대조했다. 활성 2건·보관 2건이 동일했다. 시험 계정을 삭제하고 목록 0건을 확인했다.
- 원본 CSV 및 브라우저 감사 로그는 로컬 검증 디렉터리에 보관했다. 이 문서에는 행 수·크기·고정 해시만 기록한다.

## 산출물과 자동 검증

- 변경 JAR 클래스 5개를 13번에 적용했다. 기존 92,938개 엔트리의 CRC가 유지됐다. 관리 JAR SHA-256은 `accf2251939b42365783ae00c46446b9caa7bd0363a29ccdab0ed49660b2d25e`이며 `mold.service`는 active였다.
- 적용 UI 704개 파일을 해시로 대조했다. 설정은 보존했고 HTTP로 받은 `index.html` SHA-256은 `61038f64303bdb4d3c17b719f2579761a99da124a60e85fffacc8bb4e57e4d7a`였다.
- WSL 백엔드 집중 3건, UI 집중 14건, 변경 JavaScript/Vue ESLint 및 UI 빌드 통과. SystemVM 외부 체크섬 다운로드는 오프라인 Maven 검증에서 제외했다.
- 최초 적용은 준비 확인 스크립트가 이름 없는 API 메타데이터 필드를 처리하지 못해 원복했다. 확인 스크립트를 수정하고 재적용한 뒤 API 로그인·CSV 필드·HTTP·배포 해시를 검증했다.

| 대표 파일 | SHA-256 |
| --- | --- |
| 활성 단건 | `67d5a70f50676a5ebf425b07b00fe3c0715193af383bf000851ad0a880bbd52d` |
| 보관 단건 | `9850ab4804fc1ac2aa0ae61c793e117568c68f8ee3e7f5181c1e31ddacca16c5` |
| 활성 복수 | `aa158aa5e121f809a122938d2c1679fab114eb4fcd31533a02cdec32f326e6f0` |
| 보관 복수 | `df27efb2f10b15b2176199a46db6b112406eb4a730937a28bc4380da7005964e` |

[이슈 #1753](https://github.com/ablecloud-team/ablestack-cloud/issues/1753)

[구현 커밋](https://github.com/dhslove/ablestack-cloud/commit/c25dd3ed44858154a5b08357219cbdadf65729e4) · [Epic PR #1765](https://github.com/ablecloud-team/ablestack-cloud/pull/1765) · [이슈 검증 댓글](https://github.com/ablecloud-team/ablestack-cloud/issues/1753#issuecomment-7053883306)
