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
최소 버전 필터의 잘못된 count/page를 고치고 검색·필터·페이지 컨텍스트를 보존합니다.

상위 Epic: #1692 · 개발 순서 5/9 · 우선순위 P1
선행: #1695 (KISO-01)
후속: #1701 (KISO-07), #1702 (KISO-08)
재현 항목: F03, F07

## 확인 근거
기존 버전 2개에서 최소 1.36.0을 검색하면 행은 1개, count는 2였습니다. 소스는 DB 페이징 후 최소 버전을 필터링하고 원래 count를 반환합니다. 1.35 검색 후 breadcrumb 복귀 시 조건도 사라졌습니다. 현재 페이지 시맨틱 정렬 1.29.9/10/11은 정상입니다.

## 설계
- 키워드/Zone/arch/최소 버전 조건 전체를 적용한 뒤 count·page를 일치시킵니다. 큰 목록을 UI에서 현재 페이지만 필터하는 우회는 금지합니다.
- semantic version 비교는 숫자·지원 경계 계약을 사용하고 minimumsemanticversion/minimumkubernetesversionid는 상호 배타로 처리합니다.
- id 기준 최소 버전 선택기 필요성·API capability를 확정하고 텍스트 방식과 충돌하지 않게 설계합니다.
- 목록→상세→breadcrumb/브라우저 뒤로의 keyword·필터·page/pagesize·정렬을 보존하고 계정/역할/프로젝트 변경 시 폐기합니다.
- 현재 페이지 정렬과 전체 서버 정렬은 실제 지원 계약을 표시/제어하되 설명 문구를 breadcrumb 아래 임의 삽입하지 않습니다.

## 변경 후보
- `KubernetesVersionManagerImpl.listKubernetesSupportedVersions 및 DAO 조회/정렬 계약`
- `ListKubernetesSupportedVersionsCmd 및 KubernetesVersionManagerImplTest`
- `ui/src/utils/kubernetesIsoSearch.js (제안)`
- `AutogenView.vue / ListView.vue / breadcrumb 연동`

## 완료 기준
- [ ] 최소 버전 1.36.0의 행 1/count 1·0개·마지막 페이지·전체 조건 결합·페이지 크기 변경이 일치합니다.
- [ ] 페이지 경계를 넘어 최소 조건에 맞는 항목을 배치한 의미 있는 서버 테스트로 누락/빈 페이지 위험을 재현·방지합니다.
- [ ] 1.29.9/1.29.10/1.29.11 및 서버 최소 버전 경계·유효하지 않은 기준 ID·두 최소 조건 동시 요청을 확인합니다.
- [ ] 검색/필터/정렬 복귀 및 권한/계정 전환의 오래된 응답·오래된 복귀 컨텍스트 차단을 UI로 확인합니다.

## 개발 준비와 범위
- 개발 준비: [단계별 계획](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/implementation-plan.ko.md), [UI 설계](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/ui-spec.ko.md), [실행 목업](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/mockup.html), [목업 QA](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/mockup-qa.ko.md).
- 이번에는 이슈 분해·설계·목업·구현 준비까지만 진행합니다. 제품 구현/배포는 아직 시작하지 않습니다.
- 실제 기능 검증은 UI로 수행하고 시험 자원 ledger 및 정리 근거를 남깁니다.
- 기존 CI 부채 #926·#1044는 별도 OPEN으로 유지하며 이 이슈의 기능 오류와 섞지 않습니다.
