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
버전 상태와 ISO 가용성을 분리하고 VM 표준 상세/Zone 탭에서 진행·실패·범위·식별 정보를 읽을 수 있게 합니다.

상위 Epic: #1692 · 개발 순서 6/9 · 우선순위 P1
선행: #1695 (KISO-01), #1696 (KISO-02), #1697 (KISO-03)
후속: #1700 (KISO-06), #1701 (KISO-07), #1702 (KISO-08)
재현 항목: F04, F06, F09

## 확인 근거
연결 ISO의 checksum failure는 일반 ISO에 보이지만 버전 화면은 Allocated/Enabled만 표시합니다. 모든 Zone은 목록 공백과 /zone/undefined, 상세 범위 누락입니다. true/Enabled/Ready 및 중복 Zone 라벨, directdownload 누락도 확인했습니다.

## 설계
- 상세→Zone→이벤트로 배치하며 VM InfoCard·세로 탭·라벨/값·표/툴바 여백을 재사용합니다.
- Enabled/Disabled는 버전 허용 상태, ISO는 Ready/진행/실패/조회 실패/권한 제한으로 별도 표시합니다. 장애 원인은 해당 Zone에 연결합니다.
- 모든 Zone은 의미 있는 범위 라벨로 표시하고 undefined 링크를 생성하지 않습니다. 버전 등록 범위와 일반 ISO 공유 범위를 혼동하지 않습니다.
- 이름/ID/시맨틱 버전·연결 ISO/ID·arch·CPU/RAM·HA/오토스케일링·directdownload·생성일·허용 URL을 빠짐없이 의미 있게 표시합니다.
- RootAdmin URL 보호와 child ISO 읽기 권한을 준수합니다. 승인되지 않은 일반 ISO 쓰기/추출/VM 권한을 가용성 읽기의 선행조건으로 요구하지 않습니다.
- 설정·코멘트 entity API가 없는 상태에서 탭 이름만 추가하지 않습니다. 새로운 API/권한 설계 없이는 이 범위에 포함하지 않습니다.

## 변경 후보
- `kubernetesiso 전용 상세/Zone 컴포넌트 (제안)와 image.js 탭 구성`
- `templateAvailability.js / TemplateAvailability.vue / 기존 ISO 가용성 읽기 계약`
- `KubernetesSupportedVersionResponse와 허용된 listIsos 조회`
- `InfoCard.vue / DetailsTab.vue의 공통 소비 회귀`

## 완료 기준
- [ ] Ready/전송/체크섬 오류/부분 Zone 실패/조회 불가/빈 목록/인증 만료가 서로 다른 UI로 표시됩니다.
- [ ] Root와 읽기 전용/제한 역할에서 상세 직접 진입·새로고침·연결 ISO 이동·URL 노출/원문 복사를 확인합니다.
- [ ] 다크/라이트 Zone 표·확장 영역·알림·탭 콘텐츠가 VM 표준과 맞고 색상만으로 상태를 전달하지 않습니다.
- [ ] 다중 Zone/Edge 양성 환경이 없으면 NOT_RUN으로 명시하고 기능을 제거하거나 전역 범위를 단일 Zone으로 바꾸지 않습니다.

## 개발 준비와 범위
- 개발 준비: [단계별 계획](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/implementation-plan.ko.md), [UI 설계](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/ui-spec.ko.md), [실행 목업](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/mockup.html), [목업 QA](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/mockup-qa.ko.md).
- 이번에는 이슈 분해·설계·목업·구현 준비까지만 진행합니다. 제품 구현/배포는 아직 시작하지 않습니다.
- 실제 기능 검증은 UI로 수행하고 시험 자원 ledger 및 정리 근거를 남깁니다.
- 기존 CI 부채 #926·#1044는 별도 OPEN으로 유지하며 이 이슈의 기능 오류와 섞지 않습니다.
