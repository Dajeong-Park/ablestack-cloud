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

# 검증 결과와 한계

| 항목 | 31 GFS2 | 32 Glue RBD | 증거 |
| --- | --- | --- | --- |
| UI lint/106 unit/빌드 | 성공 | 동일 산출물 | test-summary |
| 670파일·WEB-INF·HTTP200 | 성공 | 성공 | active-deployment-audit |
| 실제 SSL UI 작업 | 8건 job1 | 8건 job1 | actual-ui-jobs |
| SSL 명시 거부 역할 | 쓰기 UI0·직접401 | 동일 | deny-api-checks, deny-ui-state |
| 할당/해제 전용 | 반대 버튼 없음·반대 API401 | 동일 | opposite-denied, 전용 역할 캡처 |
| 비구성원 대상 접근 | 거부 | 거부 | nonmember-project-denied 캡처 |
| 503·job0→2 실패 | 선택/창 유지·실제 재시도 성공 | 동일 | failure-503/failure-job2 |
| 조회 실패/복구 | 선택 유지·쓰기 잠금/해제 | 동일 | read-failure |
| 결과 조회 장애/재조회 | 동일 job·입력/재시도 복구 | 동일 | unknown-recheck |
| 프로젝트/탭 늦은 응답 | 이전 창 복원0 | 동일 | late-project/late-navigation |
| 실제 TLS | 지문/200·해제 TLS 부재·원복 | 동일 | tls-before/replaced/final, removed-tls-runtime |
| 새 규칙 인증서 선택 | 부모 폼 반환·쓰기0 | 동일 | picker-write-requests, 캡처 |
| SSL 배치 | 12조합 | 12조합 | 관리자/제한 ×3폭×2테마 |
| 기존 자원/보안 정책 | 보존 | 보존 | preservation |

증거 JSON은 evidence/의 클러스터 번호 접두사 파일에 있다. 실제 요청과 job 결과를 함께 수집하고 각 job을 API로 다시 조회했다. 통제 응답은 브라우저에서 구성했으며 실제 서버 장애/job 실패와 구분한다. 실제 통신은 단일 HTTPS backend의 지문·HTTP200/본문과 인증서 제거 후 TLS 부재를 확인했다. LB 분산/부하 측정은 제외했다.

기존 qa-gn1569-*-vpn-lb-readonly 역할은 VPN/LB32명령만 거부하며 SSL 두 쓰기 API는 허용한다. 그 정책은 변경하지 않았다. SSL 읽기 전용 검증은 명시 거부 역할 qa-gn1620-*-ssl-deny를 사용했다. 전용 시험 역할의 두 규칙만 임시 조합한 후 UUID/순서/설명/권한을 정확히 복원했다. 이름상 읽기 전용 계정의 허용 버튼을 가드 실패로 오판정하지 않는다.

88 JPEG의 signature·실제 viewport·decoded 치수·해시를 대조하고 VM 표준 창과 SSL 데스크톱/모바일/읽기 전용 다크 캡처를 직접 확인했다. CA 체인·만료·다른 TLS/정책 조합 및 #1569 전체 범위는 이번 완료 범위가 아니다. #1622/#1624와 기존 경보는 남겼다. 외부 Health Monitor 제공자는 없으므로 해당 정상/복구 조건은 환경 차단이다.

로컬 lint/unit/UI 빌드·실제 배포 검증과 GitHub 자동 checks/전체 Cloud CI는 구분한다. 전체 Cloud 빌드와 수동 Actions는 실행하지 않았다.
