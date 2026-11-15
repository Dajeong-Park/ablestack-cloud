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
URL 등록에서 서버가 허용하는 값과 UI 검증을 맞추고 등록 접수와 실제 ISO 가용성을 구분합니다.

상위 Epic: #1692 · 개발 순서 3/9 · 우선순위 P1
선행: #1695 (KISO-01)
후속: #1697 (KISO-03), #1699 (KISO-05), #1702 (KISO-08)
재현 항목: F05, F06

## 확인 근거
CPU 1은 UI 통과 후 서버 530으로 거절됐습니다. 잘못된 bare64 SHA-256 및 sha256:<hex> 형식도 접수했습니다. 올바른 {SHA-256}<64hex> URL 등록은 Ready까지 별도 통과했습니다.

## 설계
- CPU≥2·RAM≥2048·정수·시맨틱 버전≥서버 최소값·URL·단일/전역 Zone·아키텍처를 서버 계약에 맞춥니다.
- 체크섬은 빈 값/기본 MD5/지원된 {알고리즘} 접두사와 길이를 검증합니다. 형식 도움말은 해당 필드 가까이에 두고 breadcrumb에 설명 띠를 추가하지 않습니다.
- 이름 필수 UX와 서버 기본 이름의 차이를 명시적으로 정리하고 payload에 false/0을 truthy 필터로 누락하지 않습니다.
- 모든 Zone/Edge/directdownload 가능 조건을 유지하고 선택 변경 시 사용자의 유효한 선택을 복원합니다.
- 등록 접수는 Ready 성공과 구분하고 연결 ISO 진행·실패 확인으로 이어집니다. 동일 요청 중복 전송과 실패 후 재등록 중복을 방지합니다.

## 변경 후보
- `ui/src/views/image/AddKubernetesSupportedVersion.vue`
- `ui/src/utils/templateForm.js: validTemplateChecksum 재사용`
- `ui/src/utils/isoRegistration.js: 기존 검증 계약 참고`
- `KubernetesVersionManagerImpl.validateKubernetesSupportedVersion와 AddKubernetesSupportedVersionCmd`

## 완료 기준
- [ ] CPU 1/2, RAM 2047/2048, 소수/NaN, 유효/무효 버전·URL·체크섬의 오류가 올바른 필드에 표시됩니다.
- [ ] URL 정상 등록·잘못된 체크섬·네트워크 실패·모든/특정 Zone·directdownload true/false를 UI로 확인합니다.
- [ ] 잘못된 사용자 입력 시험을 서버의 유효 입력 처리 결함으로 오판하지 않고 실패 자원 정리까지 확인합니다.
- [ ] 정상 등록 후 parent/ISO ID·arch·범위·directdownload·Ready를 재조회합니다.

## 개발 준비와 범위
- 개발 준비: [단계별 계획](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/implementation-plan.ko.md), [UI 설계](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/ui-spec.ko.md), [실행 목업](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/mockup.html), [목업 QA](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/mockup-qa.ko.md).
- 이번에는 이슈 분해·설계·목업·구현 준비까지만 진행합니다. 제품 구현/배포는 아직 시작하지 않습니다.
- 실제 기능 검증은 UI로 수행하고 시험 자원 ledger 및 정리 근거를 남깁니다.
- 기존 CI 부채 #926·#1044는 별도 OPEN으로 유지하며 이 이슈의 기능 오류와 섞지 않습니다.
