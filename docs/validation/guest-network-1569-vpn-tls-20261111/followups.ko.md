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

# 남은 항목과 진행 순서

<!-- gn1569-upstream-status:start -->
PR 최종 조회에서 최신 upstream `45944c40dedef7ff6b377db94225cf598c82739d`와의 merge-tree가4개 UI 파일 충돌을 확인했다: `ui/public/locales/en.json`, `ui/public/locales/ko_KR.json`, `ui/src/components/view/DetailsTab.vue`, `ui/src/components/view/ListView.vue`. upstream 변화에는 백업·VM 배포·공통 UI 등 514경로가 있어 이번 검증 전용 실행에 통합하지 않았다. working tree는 그대로이며 실환경 결과는 검증한 Epic 코드 기준이다. PR1577은 Draft/Open/CONFLICTING이다.

**선행 순서: 최신 upstream 동기화(검증된 현재 UI 우선 보존·충돌 검토)와 필요한 회귀 → #1625 → #1626 → #1569 재검증 → 준비 조건 →63행 판정.** 이전 본문의 구현 순서 앞에 이 통합 단계를 둔다. 문서 head d2c3c937a138 조회 당시 양 저장소의 commit statuses는0, upstream check/run은 Merge Conflict Check1개였다. License/Lint 성공을 주장하지 않는다. 이번 실행에 제품 빌드/수동 Actions/코드 병합은 없다. [읽기 전용 충돌 검토](evidence/upstream-conflict-review.json) · [당시 checks](evidence/pr-checks-d2c3.json).
<!-- gn1569-upstream-status:end -->

1. **#1625**: AppCookie의 HAProxy2.6 적합성과 capability/UI 후보를 개선한다. 기존 실행 설정·SSL/VPN 보존과 실제 job1/문법/TLS를 검증한다.
2. **#1626**: 세션 고정 생성/삭제 창을 VM 표준과 비동기 상태/초안 보존/같은 job 재조회로 개선한다. API/보안 정책 유지.
3. **#1569 재검증**: AppCookie/LbCookie/SourceBased·프로토콜·지원 옵션·오퍼링 전환·역할 조합을 통합한다. 이번 Isolated NAT 외 VPC/Internal/다른 제공자·policy 옵션 전체는 남는다. LB 부하분산 측정은 제외한다.
4. 사용자 확인대로 독립 VPN 시험 client가 없어 같은 VPN 동시 사용자 간 통신 영향은 준비 후 검증한다. 사설 CA의 기본 폐기 확인 정상/폐기 인증서는 CRL/OCSP 조건을 준비한 뒤 확인한다. 외부 Health Monitor 제공자도 미준비다.
5. 기존 환경 차단6행과 IPv6/PVLAN/제공자 등 조건을 재점검하고63행을 최종 판정한다. **P07 실패로 복귀: 양쪽 실패1·부분53·환경차단6·적용제외3·완료0.** #1569/Epic1554/PR1577 및 새 이슈2개는 열린 상태다. 확인 자원은 보관한다.
