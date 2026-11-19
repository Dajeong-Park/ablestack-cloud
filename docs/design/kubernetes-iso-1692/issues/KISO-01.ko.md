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
목록/상세/등록/상태/삭제가 공유할 API capability·읽기 범위·응답 정규화·오류 상태를 마련합니다.

상위 Epic: #1692 · 개발 순서 2/9 · 우선순위 P1 · 기반
선행: 없음
후속: #1696 (KISO-02), #1697 (KISO-03), #1698 (KISO-04), #1699 (KISO-05), #1700 (KISO-06), #1702 (KISO-08)
재현 항목: F02, F04, F06, F09

## 확인 근거
Epic #1692의 5개 API 대조와 상속 계약을 기준으로 합니다. URL/local 폼이 URL API 설명을 함께 사용하고 local에는 arch 계약이 없습니다. 카탈로그는 시스템 소유·전역이며 일반 ISO 소유/공유 정책과 다릅니다.

## 설계
- list/add/getUploadParams/update/delete capability를 독립 판정하고 로컬만 허용된 역할에서 URL API 설명을 요구하지 않습니다.
- Enabled/Disabled와 ISO 가용성(미조회/로딩/사용 가능/전송/실패/조회 실패/권한 제한)을 별도 모델로 둡니다.
- false·0·빈 목록·필드 누락·531/권한 거절·인증 만료·일시 오류를 구분하고 응답 부재를 성공/없음으로 바꾸지 않습니다.
- 계정·역할·프로젝트·선택 리소스 변경 시 요청 세대와 캐시 소유 범위를 무효화해 늦은 응답이 섞이지 않도록 합니다.
- RootAdmin 쓰기와 isourl 보호를 유지합니다. 일반 ISO 공유·VM Metrics·소유자 쓰기 권한을 요구/확대하지 않습니다.

## 변경 후보
- `ui/src/config/section/image.js: kubernetesiso 권한/액션/필드/탭`
- `ui/src/utils/kubernetesIso*.js (제안): capability·응답·범위·작업 상태`
- `ui/src/views/image/AddKubernetesSupportedVersion.vue`
- `plugins/integrations/kubernetes-service의 command/response 계약과 관련 테스트`

## 완료 기준
- [ ] 모드별 허용 API/필드와 상속 name/format/zoneid·checksum/소유 필드의 처리 여부를 문서화합니다.
- [ ] 최소 응답/부분 응답/중첩 upload 응답/false·0/미상 상태/거절·만료·네트워크 오류를 의미 있는 경계 테스트로 확인합니다.
- [ ] UI 읽기 전용 계정에 쓰기 동작이 노출되지 않으며, 허용된 읽기가 무관한 API 실패로 막히지 않습니다.
- [ ] 특정/모든 Zone 모델과 directdownload 읽기 모델을 준비해 후속 단계가 동일 계약을 사용합니다.
- [ ] 기존 ISO/템플릿 공통 유틸을 재사용하더라도 카탈로그 전용 권한/범위를 덮어쓰지 않습니다.

## 개발 준비와 범위
- 개발 준비: [단계별 계획](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/implementation-plan.ko.md), [UI 설계](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/ui-spec.ko.md), [실행 목업](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/mockup.html), [목업 QA](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/mockup-qa.ko.md).
- 이번에는 이슈 분해·설계·목업·구현 준비까지만 진행합니다. 제품 구현/배포는 아직 시작하지 않습니다.
- 실제 기능 검증은 UI로 수행하고 시험 자원 ledger 및 정리 근거를 남깁니다.
- 기존 CI 부채 #926·#1044는 별도 OPEN으로 유지하며 이 이슈의 기능 오류와 섞지 않습니다.
