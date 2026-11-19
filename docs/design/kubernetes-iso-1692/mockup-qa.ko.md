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

# 목업 검토 기록

2026-11-16 · 문서 전용, 실제 제품 검증과 별도

## 완료한 검사

- `node --check mockup.js` 구문 검사 통과.
- 로컬 loopback HTTP에서 독립 Linux Chromium 130.0.6723.31로 **18개 상태** 렌더링. 운영 Mold로 이동하거나 인증/API를 호출하지 않음.
- CSS viewport를1440×1000,810×975,390×844로 명시하고 실제 `innerWidth/innerHeight`를 대조.
- 페이지 전체의 가로 넘침 없음. 목록/Zone 표 내부의 의도된 가로 스크롤은 허용.
- 렌더된 이름 링크는80px보다 큰 실제 가시 폭, 한 줄/ellipsis 속성 확인. Ubuntu·긴 이름·코멘트 병존 예시의 실제 화면 검토.
- 열린 모달의 좌/우/상/하가 viewport 안에 있음. 390px 로컬 창은 한 열·본문 스크롤·하단 버튼 접근 유지.
- 파일 미선택 필수 오류, 참조 중 삭제 버튼 비활성, 일반 읽기 전용의 쓰기/URL 비노출, local-only의 URL 버튼 미노출/local 버튼 표시를 예시 상태에서 확인.
- 18개 렌더에서 JS runtime exception0. 화면별 수치는 [렌더 결과](evidence/mockup-render-summary.json)에 기록.
- 시각 검토: 목록 양 테마, Ubuntu 목록, Zone 실패/조회 실패, URL/로컬/상태/삭제 모달, 390px 이름·로컬 모달·상세 쌓임 배치를 확인.

처음 단순 CLI의390px screenshot은 실제 CSS viewport와 달라 최종 결과에서 제외했습니다. 최종 PNG와 summary는 명시적인 device metrics로 재생성했습니다. 토큰 LESS의 // 주석을 그대로 CSS로 쓰면 기본 토큰이 파싱되지 않는 점을 보정했고, **토큰 선언 값은 운영 원본과 동일**합니다.

## 화면별 결과

| 화면 | 테마/상황 | 근거 |
| --- | --- | --- |
| KISO 목록 | 다크·라이트 | [다크](evidence/kiso-list-dark.png), [라이트](evidence/kiso-list-light.png) |
| KISO 상세 | 다크 | [상세](evidence/kiso-detail-dark.png) |
| Zone | 체크섬 실패·조회 실패 | [실패](evidence/kiso-zone-error-dark.png), [조회 실패](evidence/kiso-zone-lookup-light.png) |
| 이벤트 | 다크 | [이벤트](evidence/kiso-events-dark.png) |
| 등록 | URL 라이트·로컬 파일 오류 다크 | [URL](evidence/kiso-url-dialog-light.png), [로컬](evidence/kiso-local-file-error-dark.png) |
| 변경/삭제 | 상태 변경·참조 중 삭제 차단 | [상태](evidence/kiso-state-dialog-light.png), [삭제](evidence/kiso-delete-referenced-dark.png) |
| 좁은 화면 | 810 목록,390 상세 쌓임·모달 | [810](evidence/kiso-list-810.png), [390 상세 상단](evidence/kiso-zone-390.png), [390 모달](evidence/kiso-local-390.png) |
| 템플릿 이름 | 다크·라이트·390 | [다크](evidence/template-names-dark.png), [라이트](evidence/template-names-light.png), [390](evidence/template-names-390.png) |
| 권한 예시 | 일반 읽기 전용·local-only | [읽기 전용](evidence/kiso-readonly.png), [local-only](evidence/kiso-local-only.png) |

## 후속 키보드 검증

[키보드 검토 기록](keyboard-review.ko.md): Tab/Shift+Tab·Enter·Esc·상태 선택 방향키·닫기/취소/저장 후 초점 복귀를 내장 브라우저에서 확인했습니다.

## 이번에 통과로 합산하지 않은 항목

- 실제 Mold 제품의 #1694 수정/배포나 KISO 구현은 없음. 실제 Ubuntu 결함은 수정 전 상태임.
- 실계정 ACL 전체 행렬·4.21/4.23 실제 업로드·실제 파일 수신/해시·참조 중 실제 클러스터 삭제 차단·소비/부팅은 구현 단계의 게이트.
- OS 클립보드와 실제 파일 선택·전송은 목업에서 수행하지 않음.
- 초기 Windows Chrome 제어의 접근 거부/URL 확인 중단 이후, 사용자가 연 내장 브라우저의 기존 탭에서 [키보드·초점 복귀20개 그룹 검증](keyboard-review.ko.md)을 완료했습니다. 모달 순환/선택 탭 초점2건을 목업에서 보정하고 재검증했습니다. 별도 Windows/Sky 네이티브 OS 경로 검증과 혼동하지 않습니다.
