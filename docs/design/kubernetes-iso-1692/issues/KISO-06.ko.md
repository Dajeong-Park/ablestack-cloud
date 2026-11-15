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
대상과 영향을 확인할 수 있는 상태/삭제 흐름을 만들고 기존 참조 잠금과 부분 실패 복구를 보존합니다.

상위 Epic: #1692 · 개발 순서 7/9 · 우선순위 P1
선행: #1695 (KISO-01), #1699 (KISO-05)
후속: #1701 (KISO-07), #1702 (KISO-08)
재현 항목: F10

## 확인 근거
Enabled→Disabled 및 전용 버전/ISO 연쇄 삭제는 UI로 성공했습니다. 현재 모달은 대상명/ID와 연결 ISO 영향 안내가 없고 상태 창은 1000px 외곽/450px 내용으로 큰 빈 영역을 만듭니다.

## 설계
- 상태 변경 창에 대상명·버전·ID·현재 Enabled/Disabled·선택 상태를 보여주고 서버 현재 상태/권한을 재확인합니다.
- 삭제 창에 버전과 연결 ISO 삭제 영향을 명시하고 참조 중/조회 실패/비참조를 구분합니다. 클러스터·미완료 업그레이드의 source/target pin 잠금이 최종 권한입니다.
- 서버가 현재 허용하는 Disabled 전환을 참조 중이라는 이유만으로 임의 금지하지 않습니다. 삭제 보호와 사용 허용 상태를 구분합니다.
- ISO 삭제 실패 시 버전 보존, 결과 불명 시 재조회, 중복 제출 차단, 안전한 재시도를 구현합니다. force/DB 삭제로 참조 보호를 우회하지 않습니다.
- 성공 후 목록·상세·가용성·이벤트를 갱신하고 modal의 취소/Esc/초점 복귀를 VM 표준으로 맞춥니다.

## 변경 후보
- `UpdateKubernetesSupportedVersion.vue와 전용 삭제 모달 (제안)`
- `KubernetesVersionManagerImpl.updateVersionWithReferenceLock/deleteUnreferencedKubernetesVersion`
- `KubernetesVersionReferences 및 KubernetesVersionDeletionReferenceTest`
- `image.js 작업 정의와 공통 async-job 추적 경계`

## 완료 기준
- [ ] Enabled↔Disabled·동시 상태 변경·권한 회수·일시 오류/결과 불명·취소를 UI로 확인합니다.
- [ ] 전용 참조 클러스터/미완료 업그레이드에서 삭제 차단·pin 보존을 검증하고 기존 운영 클러스터는 건드리지 않습니다.
- [ ] 비참조 버전/ISO 삭제 및 ISO 실패 후 버전 보존·재조회·재시도·잔여 0을 검증합니다.
- [ ] 대상/영향/위험 버튼/로딩·오류·키보드 동작이 다크·라이트·좁은 화면에서도 일관됩니다.

## 개발 준비와 범위
- 개발 준비: [단계별 계획](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/implementation-plan.ko.md), [UI 설계](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/ui-spec.ko.md), [실행 목업](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/mockup.html), [목업 QA](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/mockup-qa.ko.md).
- 이번에는 이슈 분해·설계·목업·구현 준비까지만 진행합니다. 제품 구현/배포는 아직 시작하지 않습니다.
- 실제 기능 검증은 UI로 수행하고 시험 자원 ledger 및 정리 근거를 남깁니다.
- 기존 CI 부채 #926·#1044는 별도 OPEN으로 유지하며 이 이슈의 기능 오류와 섞지 않습니다.
