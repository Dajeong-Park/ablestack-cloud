<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.
-->

# 실행 결과와 판정 범위

| 검증 | 실제 결과 | 근거 |
| --- | --- | --- |
| 32 일반/AutoScale 후보 | 실제 Public2/Internal1 메타데이터 → 두 UI 후보 Public2, Internal0 | `32-network-api-contract.json`, `32-public-options.json`, `32-autoscale-search.json` |
| Tier 변경 | 기존 Public NIC 선택 → 빈 대체 Public Tier로 변경하면 선택0·제출 비활성, 이름/포트/CIDR 유지 → 기존 Tier 재선택 복구 | `32-tier-change-cleared.json` |
| 실제 API 실패·복구 | CIDR bad/99로 실제431, 대화상자·4입력·선택 NIC 유지, 보정 후 생성 job1·연결 job1·Active | `32-real-invalid-cidr-response.json`, `32-real-failure-inputs.json`, `32-public-create-response.json`, `32-public-assign-response.json` |
| 후보 오류·미존재 | 32 network503/offering503/empty, 31 offering503/empty에서 제출 비활성·변경 POST0, 업데이트 후 복구 | `*-result.json`, `*-mutation-requests.json` |
| 제출 전 변경 | 실제 Public 후보의 검사 응답만 Internal로 통제, create POST0·입력 보존·새 조회 복구 | `32-preflight-internal-result.json` |
| 프로젝트 전환 | 오퍼링2응답을 보류한 채 닫기→기본→응답 해제→프로젝트 복귀, 이전 초안/후보/창 부활0, 새 창 입력 공백 | `32-project-pending-result.json`, `*-project-start-*.json` |
| AutoScale 경로 | Public 검색1·Internal 검색0·전체2, 검색 추가 listNetworks0; 명시 Public 선택 후 새 규칙 job1/Add | `32-autoscale-search-network-requests.json`, `32-autoscale-create-response.json` |
| 실제 역할 UI | 양쪽 Member/DomainAdmin 생성창, 32 각 실제 새 LB 생성 job1; RO 생성 비활성, 비멤버 자원 접근 거부 | `*-peer-*`, `*-domainAdmin-*`, `*-readonly-ui.json`, `*-nonmember-ui.json` |
| 역할 API | 관리자/멤버/도메인관리자/RO/비회원 총14기록: 조회10·RO/비회원 생성 거부4. 기존 API는 Internal도 반환, UI만 필터 | `31-role-api-unchanged.json`, `32-role-api-unchanged.json` |
| 31 조건 | 기존 다른 QA 프로젝트 VPC IP31.109 읽기/취소만, 본 작업 Isolated IP31.149 규칙 생성 job1. 신규 VPC IP 확보는 환경 차단 | `31-existing-vpc-public-ip-readiness.json`, `31-isolated-create-response.json` |
| VM UI 표준 | 일반31/32·32 AutoScale 각 3폭×2테마 총18배치, 양쪽 VM 표준 대화상자·목록·상세 참조, 즉시 테마/timeOrigin 동일·프로젝트 왕복 | `layout.json`, `*-geometry.json`, `*-instant-theme.json`, 원본 JPEG |
| 배포/보존 | 31/32 활성 정적664파일·해시 일치·HTTP200·서버 디렉터리/설정/JAR/PID 보존 | `*-deployment.json`, `manifest.json`, `product-build-attestation.json` |
| 자원 보존 | 기존 QA VM/NIC/호스트, 기존 망/LB/VPN/AS 변경0, 새 확인 자원 유지 | `*-preservation.json`, `*-preservation-scope.json`, `*-after.json` |

503/empty 및 검사 시 Internal 메타데이터는 **브라우저 XHR 응답을 통제한 시험**이며 실제 서버 장애·실제 오퍼링 변경이라고 주장하지 않는다. 실패 뒤 실제 응답으로 갱신 복구했다. 실제 CIDR431/생성/연결/역할 API 거부는 통제하지 않았다. 시험 종료 시 가로채기와 디바이스 에뮬레이션을 해제했다.

처음 31 Isolated 제출은 후보/화면 준비 중 클릭으로 mutation0을 관측했고, 준비 완료 후 한 번 제출해 job1이었다. 이를 서버 생성 실패나 중복 성공으로 세지 않았다. 31 기존 SourceNAT IP는 원래 부모 가드로 LB 화면 대상이 아니므로 신규 빈 후보 UI 검증으로 집계하지 않았다.

제품 기능 검증은 d2b85e11d8b 단계에서 실행했고, 최종 스타일 변경 후 lint·153검사·빌드·배포를 다시 실행했다. 최종18배치·후보·오류 복구·역할 읽기 전용 가드를 재확인했다. 중간 모바일 겹침 캡처는 `before-layout-fix`로 구분하고 최종 배치는 같은 파일명을 최신 캡처로 덮어썼다.

전체 Cloud/제품 빌드, LB 분산/성능, 새 AutoScale 그룹·VM 증감, 준비되지 않은31 VPC 생성/다른 제공자 정상 경로는 이번 완료 범위가 아니다. 비관리자 즉시 테마 메뉴는 원래 제공되지 않으므로 상속 다크 화면으로 확인했다.
