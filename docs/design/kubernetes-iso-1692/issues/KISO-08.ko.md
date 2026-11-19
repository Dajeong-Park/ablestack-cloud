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
선행 8개 구현의 기능·권한·환경·스타일·정리를 실제 UI로 통합 확인하고 Epic 완료 근거를 확정합니다.

상위 Epic: #1692 · 개발 순서 9/9 · 우선순위 P1 · 최종 완료 게이트
선행: #1694 (TPL-01), #1695 (KISO-01), #1696 (KISO-02), #1697 (KISO-03), #1698 (KISO-04), #1699 (KISO-05), #1700 (KISO-06), #1701 (KISO-07)
후속: 없음
재현 항목: F01~F12

## 확인 근거
초기 분석은 현재 4.23 Root Admin UI 및 전송용 ISO fixture에 한정했습니다. 실계정 전체 ACL·4.21·실제 Kubernetes 설치/업그레이드·다중 Zone은 그 결과로 통과 처리할 수 없습니다.

## 설계
- Root/DomainAdmin/ResourceAdmin/User/Read-Only/전용 제한 역할로 목록·직접 상세·URL·연결 ISO 읽기·쓰기 버튼/요청·권한 회수 후 재시도를 교차 검증합니다.
- 4.21→4.23 각 SystemVM 실제 계열을 확인하고 URL/로컬 전송·Ready·저장 arch·체크섬·이벤트·정리를 검증합니다. 기존 #1667의 일반 ISO 경로 결과를 KISO 통과로 대신하지 않습니다.
- 최소 버전/page/복귀·Ready/오류/조회 실패·상태/연쇄 삭제·참조 pin 보존·Ubuntu 이름·테마/화면/키보드를 통합합니다.
- CKS 소비는 실제 바이너리 ISO와 전용 클러스터로 별도 준비합니다. 전송용 fixture로 설치/부팅 성공을 주장하지 않습니다.
- 환경 없는 다중 Zone/Edge/비KVM/ARM·s390x 부팅은 NOT_RUN을 명시하고 기존 기능을 보존합니다. 단일 Zone인 현재 완료 범위와 미실행 범위를 분리합니다.

## 변경 후보
- `UI 회귀 행렬·실제 계정/역할/시험 자원 ledger`
- `KISO/TPL 기능별 테스트 및 배포 제품 delta 검증`
- `docs/validation/kubernetes-iso-<issue>-<date> (구현 시 생성 제안)`

## 완료 기준
- [ ] 모든 P1/P2 이슈가 기능별 근거와 함께 완료되고 신규 결함은 별도로 추적됩니다.
- [ ] 실제 ACL 행렬·양 계열 업로드와 허용된 읽기 경계를 UI 증거로 입증합니다. 읽기 전용 경로가 VM Metrics/쓰기 API를 요구하지 않습니다.
- [ ] 필요한 제품 delta만 13번에 배포하고 원래 자원·설정·참조를 보존합니다.
- [ ] 시험 버전/ISO/계정/역할/클러스터/티켓/HTTP 파일 ledger를 정리해 잔여 0과 원래 목록/식별자 보존을 확인합니다.
- [ ] 변경 검사·기능 회귀와 기존 CI 부채 #926/#1044를 분리 보고하고 이슈/Epic/PR 완료 상태를 갱신합니다.

## 개발 준비와 범위
- 개발 준비: [단계별 계획](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/implementation-plan.ko.md), [UI 설계](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/ui-spec.ko.md), [실행 목업](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/mockup.html), [목업 QA](https://github.com/dhslove/ablestack-cloud/blob/73fad18d78b136f24c0d7a8c16202e4435bd3403/docs/design/kubernetes-iso-1692/mockup-qa.ko.md).
- 이번에는 이슈 분해·설계·목업·구현 준비까지만 진행합니다. 제품 구현/배포는 아직 시작하지 않습니다.
- 실제 기능 검증은 UI로 수행하고 시험 자원 ledger 및 정리 근거를 남깁니다.
- 기존 CI 부채 #926·#1044는 별도 OPEN으로 유지하며 이 이슈의 기능 오류와 섞지 않습니다.
