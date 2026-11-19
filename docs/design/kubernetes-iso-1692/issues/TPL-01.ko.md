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
템플릿 목록 이름 셀만 우선 보정하고 쿠버네티스 ISO 목록에도 사용할 이름 배치 기준을 확정합니다.

상위 Epic: #1692 · 개발 순서 1/9 · 우선순위 P1 · 가장 먼저
선행: 없음
후속: #1701 (KISO-07), #1702 (KISO-08)
재현 항목: F12(추가)

## 확인 근거
13번 운영 UI에서 전체 48개/50개 표시, 마지막 Ubuntu 24.04 LTS 행의 이름이 넓은 이름 열에서도 ‘…’만 표시됩니다. 실제 이름은 Europa-SystemVM-4.23-ISO1667-20261115, ID는 1cce97d2-a4b6-49c7-871a-3f52d70ce858입니다. 같은 표의 Debian·Rocky·Windows 이름은 보이고 해당 Ubuntu 상세/접근성 정보의 이름은 온전합니다. 조회만 수행했으며 원본 템플릿은 수정하지 않았습니다.

## 설계
- 아이콘은 고정 슬롯(24px 이내)·축소 금지, 이름은 min-width:0인 유연 슬롯, 코멘트는 별도 고정 슬롯으로 구성합니다.
- 부모가 inline인 상태의 calc(100% - 32px) 및 아이콘 고유 폭 상호작용은 원인 후보입니다. 브라우저 레이아웃 재현으로 원인을 확정하고 모든 OS에 적용되는 이름 셀 계약으로 보정합니다.
- 이름 열의 최소 폭을 보장하고 긴 이름만 한 줄 말줄임/전체 이름 툴팁을 적용합니다. 이름 원문·링크·목록 복귀 컨텍스트는 보존합니다.
- Ubuntu 전용 display:none·이름 축약·아이콘 제거·저장 이름 변경으로 우회하지 않습니다.

## 변경 후보
- `ui/src/components/view/ListView.vue: 이름 셀의 아이콘/링크/코멘트 컨테이너 및 .template-primary-name`
- `ui/src/components/widgets/OsLogo.vue: 아이콘의 실제 고유 폭과 공통 소비 영향 조사`
- `ui/src/views/AutogenView.vue: template-list-page의 표 너비/ellipsis 경계`
- `ui/tests/unit/components/view/ListViewTemplateType.spec.js와 관련 실제 레이아웃 회귀`

## 완료 기준
- [ ] 운영 Ubuntu 행에서 이름 앞부분이 실제로 보이고, 긴 경우에만 한 줄 말줄임됩니다. ‘…’ 단독 표시가 없어야 합니다.
- [ ] 마우스 오버/키보드 초점의 전체 이름, 상세 진입·breadcrumb 복귀, 코멘트 아이콘 병존을 검증합니다.
- [ ] Ubuntu/Debian/Rocky/Windows/사용자 아이콘/아이콘 없음, 짧은·긴 한글/영문 이름을 다크·라이트·데스크톱·810px·390px에서 확인합니다.
- [ ] 접근성 트리에 원문이 있다는 확인만으로 통과시키지 않고 실제 화면의 가시 폭과 링크 클릭 영역을 확인합니다.
- [ ] 템플릿 목록의 상태·OS·부가 열 한 줄/툴팁, VM/VNF/ISO 등 공통 ListView 소비 화면을 회귀 확인합니다.

## 개발 준비와 범위
- 개발 준비: [단계별 계획](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/implementation-plan.ko.md), [UI 설계](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/ui-spec.ko.md), [실행 목업](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/mockup.html), [목업 QA](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/mockup-qa.ko.md).
- 이번에는 이슈 분해·설계·목업·구현 준비까지만 진행합니다. 제품 구현/배포는 아직 시작하지 않습니다.
- 실제 기능 검증은 UI로 수행하고 시험 자원 ledger 및 정리 근거를 남깁니다.
- 기존 CI 부채 #926·#1044는 별도 OPEN으로 유지하며 이 이슈의 기능 오류와 섞지 않습니다.

실제 UI 근거: [목록 오류](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/evidence/ubuntu-name-ellipsis-dark.jpg), [상세 이름](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/evidence/ubuntu-detail-name-intact.jpg), [수정 설계](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/first-issue-1694.ko.md).
