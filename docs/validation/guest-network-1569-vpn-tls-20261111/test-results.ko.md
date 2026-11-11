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

# 검증 결과와 경계

<!-- gn1569-upstream-status:start -->
PR 최종 조회에서 최신 upstream `45944c40dedef7ff6b377db94225cf598c82739d`와의 merge-tree가4개 UI 파일 충돌을 확인했다: `ui/public/locales/en.json`, `ui/public/locales/ko_KR.json`, `ui/src/components/view/DetailsTab.vue`, `ui/src/components/view/ListView.vue`. upstream 변화에는 백업·VM 배포·공통 UI 등 514경로가 있어 이번 검증 전용 실행에 통합하지 않았다. working tree는 그대로이며 실환경 결과는 검증한 Epic 코드 기준이다. PR1577은 Draft/Open/CONFLICTING이다.

**선행 순서: 최신 upstream 동기화(검증된 현재 UI 우선 보존·충돌 검토)와 필요한 회귀 → #1625 → #1626 → #1569 재검증 → 준비 조건 →63행 판정.** 이전 본문의 구현 순서 앞에 이 통합 단계를 둔다. 문서 head d2c3c937a138 조회 당시 양 저장소의 commit statuses는0, upstream check/run은 Merge Conflict Check1개였다. License/Lint 성공을 주장하지 않는다. 이번 실행에 제품 빌드/수동 Actions/코드 병합은 없다. [읽기 전용 충돌 검토](evidence/upstream-conflict-review.json) · [당시 checks](evidence/pr-checks-d2c3.json).
<!-- gn1569-upstream-status:end -->

| 구분 | 31 GFS2 | 32 Glue RBD | evidence 접미사 |
| --- | --- | --- | --- |
| VPN 역할 root/owner/member/DomainAdmin/readOnly/nonMember | API28건 | API28건 | vpn-role-matrix |
| 정책 create/delete 읽기 전용·비구성원 | 4거부, job0개 | 동일 | policy-role-denials |
| 구성원·도메인 관리자 서비스 철회/복구 | 각 실제 API사이클·통신 | 동일 | peer/domainAdmin-service, multi-2 관련 파일 |
| 소유자 사용자/서비스 UI | 최종4작업 job1 | 동일 | owner-ui-final-jobs |
| 사용자 철회/복구 | A 기존/신규 차단·복구 | B 기존/신규 차단·복구 | multi-1 또는2-user-withdrawn/recovered |
| 동시 사용자 간 영향 | 판정 보류/환경 조건 | 동일 | parallel-fixture, 초기 multi 표본 |
| 인증서 API | 10건·옵션 구분 | 동일 | certificate-api/options-matrix |
| CA 체인 실제 UI·TLS | 신뢰 Root/SAN/HTTP200 | 동일 | ca-chain-assigned, tls-chain-valid |
| 중간 체인 누락·복구 | curl60→0/TLS거부→성공 | 동일 | tls-missing-chain/chain-recovered |
| 만료/기간 전/키 불일치 | API거부 | 동일 | certificate-api-matrix |
| 만료 시점 이후 client 검증 | 실제 TLS거부 | 동일 | tls의 futureVerification |
| AppCookie | UI job2/530·후보 appsession 미지원 | 동일 | appcookie-actual-job/syntax-diagnosis |
| AppCookie API 교차 | job2·실행 cfg SHA 동일 | UI/VR교차 | appcookie-second-api-reproduction |
| SourceBased | job1·stick-table·TLS | job1·오퍼링 조합 TLS | source-policy, offering-clone |
| 오퍼링/복원 | 원래→8192/true→원래4096/false | 동일 | offering-apply/restore/runtime/final-runtime |
| VM 표준·프로젝트·테마 | SSL6+VPN12배치·VM5화면 | 동일 | 관련 캡처/layout/theme |
| 최종 원래 TLS·상태 체크 | 지문/HTTP200·15/15 | 동일 | tls-final, final-health |
| 기존 자원/설치본 보존 | 모두 통과 | 동일 | preservation, active-deployment-audit |

파일은 evidence/의 클러스터 번호-접미사.json이다. 기본 폐기 확인 true의 valid-chain 최초 예상은 인증서 API의 기본 정책을 확인하기 전 표본이다. 같은 leaf/chain의 명시적 false 허용과 구분해 최종 판정했다. 폐기 목록이 없는 사설 CA의 기본 거부를 실패 결함으로 합산하지 않는다. 실제 신뢰 TLS는 등록한 시험 CA를 명시적으로 신뢰하는 client로 검증했으며 외부 공인 CA 발급/CRL/OCSP 전체를 완료한 것은 아니다. backendssl의 기존 verify none 설정을 CA backend 인증까지 검증했다고 해석하지 않는다.

동시 client의 PPP 성공은 동시 통신 성공이 아니다. 처음의 겹치는 route/strict rp_filter, 공유 NAT/IKE의 오래된 터널, 시험 도구의 초 단위 selector 대기/세션 전환, 32번 오퍼링의 다른 호스트/중첩 시점 및 원래 인증서 복원 뒤 CA 신뢰로 조회한 표본은 성공 집계에서 제외했다. 사용자 확인대로 독립 클라이언트가 없으므로 같은 VPN 동시 통신은 환경 조건이다. 양쪽의 유효한 단일 사용자·서비스 복구와 API/UI job·자원 보존을 별도로 대조했다.

오퍼링 전환은 라우터를 재생성하므로 무중단을 주장하지 않는다. 32의 첫 전환은 host가 달라 통신 판정에서 제외하고, 최종 양쪽 apply/restore는 같은 host로 배치한 후 검사했다. PSK는 서비스 재생성으로 회전했고 비공개 client 자료에 갱신했다. 기존 역할 정책/전역 보안 정책/기존 VPN 사용자/기존 인증서 매핑은 보존했다. 마지막 원래 TLS 지문과 관리 JAR/PID/서버 디렉터리/UI671파일 동일도 확인했다.

제품 소스/배포 변경·Maven·전체 Cloud 빌드·수동 Actions는 없었다. 문서 lint/증거 감사·live UI/API/실제 통신 결과를 GitHub 자동 CI 성공과 구분한다. LB backend 부하분산 측정·새 외부 제공자·동시 client와 CRL 준비 조건은 완료로 처리하지 않는다.
