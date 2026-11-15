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
파일 미선택 무한 로딩과 ARM 선택값 유실을 해결하고 전송·Ready·감사·부분 실패 정리를 일관되게 처리합니다.

상위 Epic: #1692 · 개발 순서 4/9 · 우선순위 P1
선행: #1695 (KISO-01), #1696 (KISO-02)
후속: #1699 (KISO-05), #1702 (KISO-08)
재현 항목: F01, F02, F11

## 확인 근거
파일 없이 확인 시 로딩이 남고 자원은 생성되지 않았습니다. aarch64를 선택해 실제 전송/Ready한 버전은 x86_64로 저장됐습니다. 로컬 버전 이벤트는 0개였으며 URL ADD/UPDATE 이벤트는 보였습니다.

## 설계
- API 요청 전에 정확히 파일 1개를 검증하고 모든 return/catch/finally에서 상태를 정리합니다.
- 로컬 arch를 허용값으로 검증하고 GetUploadParamsForIsoCmd까지 전달합니다. 미지원 입력을 기본 x86_64로 조용히 저장하지 않습니다.
- 티켓 발급·전송·서버 처리·Ready를 분리하고 실제 Promise를 await합니다. 등록·업로드 응답의 계열 차이는 공통 정규화로 처리합니다.
- 티켓 만료·빈 응답·중단·탭/계정 변경·중복 제출·재시도에 요청 소유권과 잔여 자원 정책을 적용합니다. 삭제 성공이 불명인 자원을 무조건 재삭제하지 않습니다.
- KUBERNETES.VERSION.ADD의 로컬 경로와 resource UUID 감사 연결을 보정하고 child ISO 이벤트와 버전 이벤트를 구분합니다.

## 변경 후보
- `GetUploadParamsForKubernetesSupportedVersionCmd: arch 추가·문서·검증`
- `KubernetesVersionManagerImpl.registerKubernetesVersionIsoForUpload 및 registerKubernetesSupportedVersionForPostUpload`
- `AddKubernetesSupportedVersion.vue: 파일 규칙·응답 파서·Promise·업로드 상태`
- `KubernetesVersionManagerImplTest / KubernetesVersionServiceTest / UI 업로드 경계 검사`

## 완료 기준
- [ ] 파일 미선택·교체·제거·다중 파일·잘못된 체크섬·실패/중단/만료 후 UI가 복구되고 잔여 0을 확인합니다.
- [ ] x86_64/aarch64 선택값이 버전과 연결 ISO 양쪽에 저장됨을 UI로 검증합니다. 물리 ARM 부팅과 메타데이터 검증을 구분합니다.
- [ ] 실제 4.21·4.23 SystemVM을 각각 확인한 환경에서 로컬 전송→Ready→정리를 모두 통과합니다. 한 계열 결과나 mock을 다른 계열 PASS로 합산하지 않습니다.
- [ ] 전송 성공 알림만으로 완료하지 않고 저장 값·가용성·감사 이벤트·시험 자원 정리를 검증합니다.
- [ ] 기존 클러스터/업그레이드에 참조된 ISO를 업로드 실패 정리 대상으로 삭제하지 않습니다.

## 개발 준비와 범위
- 개발 준비: [단계별 계획](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/implementation-plan.ko.md), [UI 설계](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/ui-spec.ko.md), [실행 목업](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/mockup.html), [목업 QA](https://github.com/dhslove/ablestack-cloud/blob/dhslove/epic-1692-ui-design/docs/design/kubernetes-iso-1692/mockup-qa.ko.md).
- 이번에는 이슈 분해·설계·목업·구현 준비까지만 진행합니다. 제품 구현/배포는 아직 시작하지 않습니다.
- 실제 기능 검증은 UI로 수행하고 시험 자원 ledger 및 정리 근거를 남깁니다.
- 기존 CI 부채 #926·#1044는 별도 OPEN으로 유지하며 이 이슈의 기능 오류와 섞지 않습니다.
