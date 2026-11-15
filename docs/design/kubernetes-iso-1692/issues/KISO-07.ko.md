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

## 목적
선행 기능의 최종 배치를 운영 VM 표준과 맞추고 이름/부가 정보의 가시성·테마·반응형·키보드 경계를 마무리합니다.

상위 Epic: #1692 · 개발 순서 8/9 · 우선순위 P2
선행: #1694 (TPL-01), #1698 (KISO-04), #1699 (KISO-05), #1700 (KISO-06)
후속: #1702 (KISO-08)
재현 항목: F08, F09, F10

## 확인 근거
긴 이름을 추가하면 상태/Zone/열 제목까지 줄바꿈되고 810px에서 이름·추가 버튼 일부가 잘립니다. 추가 TPL-01의 OS 아이콘/이름 렌더링 문제를 공통 이름 배치 회귀에 포함합니다.

## 설계
- 주요 이름 열을 가장 넓게, 상태/버전/ISO상태/CPU/RAM/arch/Zone은 고정 부가 폭으로 둡니다. 아이콘/코멘트 고정 슬롯과 유연 이름 슬롯은 TPL-01의 검증된 배치를 사용합니다.
- 한 줄 표시·말줄임·hover/focus 전체 툴팁·정렬 표시·행 높이·스크롤을 맞추고 작은 창에서 핵심 열/액션이 잘리지 않도록 합니다.
- breadcrumb 위치/높이·복귀 컨텍스트와 상세 InfoCard·세로 탭 최소 rail100px·콘텐츠 여백/툴바/페이지네이션을 VM 기준으로 맞춥니다.
- 모달 폭은 내용에 맞게 정하고 대상 정보/본문/하단 버튼을 구분합니다. 필드 검증·초점·disabled·진행 상태도 공통 스타일로 처리합니다.
- 다크/라이트는 기존 semantic token 사용. 임의 검색 설명 띠·개발 용어·구현 사유를 제품 화면에 넣지 않습니다.

## 변경 후보
- `ListView.vue / AutogenView.vue의 kubernetesiso 한정 목록/툴바`
- `전용 KISO 상세/Zone/등록/상태/삭제 컴포넌트`
- `ui/src/style/theme/tokens.less의 기존 토큰 재사용`
- `필요 시 kubernetes-iso-tabs.less (제안), 기존 template-tabs.less/InstanceTab.vue 기준`

## 완료 기준
- [ ] 운영 VM 기준과 전/후 화면 비교를 목록·breadcrumb·상세·Zone·이벤트·모든 모달별로 남깁니다.
- [ ] 1440/1280/810/390 폭과 작은 높이에서 이름·버튼·탭/가로 스크롤 접근을 확인합니다.
- [ ] 긴 한글/영문·UUID·오류/URL·Ubuntu 아이콘/커스텀 아이콘/코멘트 병존, theme 양쪽을 확인합니다.
- [ ] Tab/Enter/Esc·초점 복귀·툴팁 접근성과 VM/템플릿/일반 ISO 공통 화면 회귀를 확인합니다.

## 개발 준비와 범위
- 개발 준비: [단계별 계획](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/implementation-plan.ko.md), [UI 설계](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/ui-spec.ko.md), [실행 목업](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/mockup.html), [목업 QA](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/mockup-qa.ko.md).
- 이번에는 이슈 분해·설계·목업·구현 준비까지만 진행합니다. 제품 구현/배포는 아직 시작하지 않습니다.
- 실제 기능 검증은 UI로 수행하고 시험 자원 ledger 및 정리 근거를 남깁니다.
- 기존 CI 부채 #926·#1044는 별도 OPEN으로 유지하며 이 이슈의 기능 오류와 섞지 않습니다.
