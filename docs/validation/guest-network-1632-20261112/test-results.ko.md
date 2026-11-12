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

# UI·API·실제 런타임 결과

## 수정 전 대조

같은 기존 전용 CA를 재사용했다. OpenSSL CRL 검사는 good 정상/revoked 거부, 실제 HTTP OCSP는 good/revoked/unknown 및 중간 CA의 서명 검증을 확인했다. 양쪽 배포 전 true의 good/revoked는 모두 일반 Invalid certificate chain530, 명시적 false의 good만 성공했다. false는 전용 미할당 대조 인증서이며 해결책이 아니다. [31 수정 전](evidence/31-before-api-matrix.json) · [32](evidence/32-before-api-matrix.json) · [공개 PKI 증명](evidence/revocation-fixture-public-proof.json) · [실제 OCSP](evidence/live-openssl-ocsp-proof.json).

## 배포 후 기본 true API38회

아래 요청은 enabledrevocationcheck를 **생략**해 API 기본 true를 사용했다. 양쪽 각각 정상6·의도한 거부13이다. CRL 전용/OCSP 전용/혼합과 실제 fallback·timeout 후 복구를 분리했다. offline/redirect/oversize/timeout은 안전한 거부이며 정상 등록으로 집계하지 않았다.

| 사이트 | 조건 | 실제 결과 | 소요 |
| --- | --- | --- | --- |
| 31 | after-timeout-recovery | 등록 성공 | 0.03s |
| 31 | bad-crl-signature | INVALID_RESPONSE | 0.02s |
| 31 | bad-ocsp-signature | INVALID_OCSP_RESPONSE | 0.04s |
| 31 | crl-fallback-on-ocsp-unavailable | 등록 성공 | 0.03s |
| 31 | crl-revoked | REVOKED | 0.02s |
| 31 | default-crl-good | 등록 성공 | 0.03s |
| 31 | default-dual-good | 등록 성공 | 0.05s |
| 31 | default-ocsp-good | 등록 성공 | 0.04s |
| 31 | dual-revoked | REVOKED | 0.02s |
| 31 | foreign-ocsp-id | INVALID_OCSP_CERT_ID | 0.02s |
| 31 | http-redirect | UNAVAILABLE | 0.02s |
| 31 | ocsp-revoked | REVOKED | 0.02s |
| 31 | offline | UNAVAILABLE | 0.02s |
| 31 | oversized | UNAVAILABLE | 0.02s |
| 31 | retry-normal | 등록 성공 | 0.03s |
| 31 | socket-timeout | UNAVAILABLE | 3.02s |
| 31 | stale-crl | STALE_RESPONSE | 0.02s |
| 31 | stale-ocsp | STALE_RESPONSE | 0.02s |
| 31 | unknown | UNKNOWN | 0.02s |
| 32 | after-timeout-recovery | 등록 성공 | 0.05s |
| 32 | bad-crl-signature | INVALID_RESPONSE | 0.04s |
| 32 | bad-ocsp-signature | INVALID_OCSP_RESPONSE | 0.04s |
| 32 | crl-fallback-on-ocsp-unavailable | 등록 성공 | 0.05s |
| 32 | crl-revoked | REVOKED | 0.03s |
| 32 | default-crl-good | 등록 성공 | 0.06s |
| 32 | default-dual-good | 등록 성공 | 0.07s |
| 32 | default-ocsp-good | 등록 성공 | 0.05s |
| 32 | dual-revoked | REVOKED | 0.04s |
| 32 | foreign-ocsp-id | INVALID_OCSP_CERT_ID | 0.04s |
| 32 | http-redirect | UNAVAILABLE | 0.03s |
| 32 | ocsp-revoked | REVOKED | 0.04s |
| 32 | offline | UNAVAILABLE | 0.03s |
| 32 | oversized | UNAVAILABLE | 0.03s |
| 32 | retry-normal | 등록 성공 | 0.05s |
| 32 | socket-timeout | UNAVAILABLE | 3.05s |
| 32 | stale-crl | STALE_RESPONSE | 0.05s |
| 32 | stale-ocsp | STALE_RESPONSE | 0.04s |
| 32 | unknown | UNKNOWN | 0.03s |

서명·issuer·경로·private/mixed DNS 등 추가 경계는 Java53건에 포함된다. 모든 단위 조건을 live 네트워크 시험으로 바꿔 집계하지 않았다.

## UI 실패 보존·실제 할당·TLS

31 UI 기본 체크 상태에서 폐기 인증서530 REVOKED,32 UI에서 응답 지연530 UNAVAILABLE을 확인했다. 실패 후 이름/인증서/키/체인 네 값이 실제 DOM에서 원본과 일치하고 창/체크/재시도 상태가 유지됐다.32 연속 클릭 실동작은 POST1건이었다. 정상 체인 또는 정상 응답자로 복구한 뒤 양쪽 UI 등록이 성공하고 창이 닫혔으며2쪽 목록에 새 이름이 나타났다. [31](evidence/31-ui-failure-draft.json) · [32](evidence/32-ui-failure-draft.json).

입력 보존은 비공개 메모리의 원본과 boolean/길이/해시로 대조했다. 촬영 전 실제 UI로 PEM 세 칸을 비운 뒤 실패 창을 캡처했다. 공개 증거에 개인 키/인증서/CA 원문을 싣지 않았다. raw debugger event 원문도 게시하지 않았다. 일부 브라우저 제어의 대기/관측 실패는 완료 증거로 사용하지 않고 최종 성공 관측만 집계했다. Escape 실동작은 별도 live 통과 항목으로 집계하지 않는다.

| 사이트 | 프로젝트 | TLS endpoint | 실제 VR / host | UI 등록 인증서 ID | 실제 UI 할당 job |
| --- | --- | --- | --- | --- | --- |
| 31 | qa-gn1569-31-shared-reg | 10.10.31.149:19111 | r-1024-VM / ablecube31-3 | `f62b72ac-6991-4aa4-8b78-4734c7b5ac66` | `368a1aca-d0a9-4738-be5b-579e37be14b4` |
| 32 | qa-gn1569-32-shared-reg | 10.10.32.177:19111 | r-499-VM / ablecube32-2 | `44a59880-7190-4dda-99b6-b5ab18270fe0` | `1582cd8f-b89e-4d0b-b1f9-f6462e902235` |

UI 작업 완료 문구와 현재 인증서 갱신을 확인하고 같은 job ID를 API queryAsyncJobResult의 job1과 대조했다. 실제 API 연결 인증서 ID/지문이 UI 등록 결과와 일치한다. 해당 VR에서 HAProxy -c, 실제 haproxy_check.py advanced, Root 신뢰/SNI/호스트명 검증 OpenSSL verify0·3인증서 체인·curl HTTP200 및 전용 backend 응답을 확인했다. [31 UI job](evidence/31-ui-assign-job.json) · [32](evidence/32-ui-assign-job.json) · [31 live TLS](evidence/31-ui-normal-chain-live-tls.json) · [32](evidence/32-ui-normal-chain-live-tls.json).

스위치 guest VLAN 조건을 피하도록 기존 VR/VM의31-3·32-2 같은 호스트 배치를 확인했다. TLS/단일 backend 응답 확인이며 LB 분산·부하량을 측정하지 않았다. 외부 WSL VPN client는 한 대를 양쪽 순서대로 사용했다. API SSL 변경 구간 ICMP/SSH는31 각911/911·32 각212/212, PPP PID/ifindex와 VR VPN 설정 hash/mtime·프로세스가 유지됐다. UI SSL 할당 후 양쪽 VPN 새 인증/ICMP/SSH3회도 정상이다. UI 할당 구간 전체를 외부 다중 client 동시 통신 관측으로 확대하지 않는다.

## 실제 역할 정책과 UI

root/owner/peer/customAllow/deny/customReadDeny/기존 VPN-LB readOnly,7역할씩 확인했다. projectid를 준 SSL 조회는 허용6역할200, customReadDeny401이다. 식별자 없이 listSslCerts만 호출한530은 기존 ‘certificate/account/LB/project 식별자 필요’ 계약이며 권한 우회 성공이 아니다.

SSL 할당/제거 거부를 명시한 deny/customAllow/customReadDeny의 assign은 projectid 지정/생략 모두401/no job이었다. 기존 이름이 VPN-LB readOnly인 역할에는 SSL assign/upload 거부 규칙이 없으므로 해당 명령은 기존 정책대로 허용됐다. 이름을 읽기 전용 전체 정책으로 오인하지 않았다. 초기 허용 탐침 이름에 denied/rejected가 들어간 두 미할당 인증서도 실제 결과는 허용이며 자원 목록에 남겼다. 역할/구성원/규칙은 전후 동일하다. [31 API](evidence/31-role-api-regression.json) · [32](evidence/32-role-api-regression.json).

새 UI에서 관리자와 customAllow/customReadDeny를 양쪽 확인했다. 허용 역할은 목록/등록·기본 true, 조회 거부 역할은 등록 버튼0/인증서 행0/업데이트 비활성이다. 모바일과 실제 배포 app.e01a5204.js도 확인했다. API의 허용 정책은 바꾸지 않았다. owner/domain admin/child 등 모든 화면의 전체 역할 회귀는 #1569 잔여다.

## 빌드·배포·보존

로컬 WSL ext4 api/server package·Java53(19+24+10)·실패/오류/skip0·Checkstyle0, UI ESLint·Jest28·production build 성공이다. Java source6파일과 UI2파일을 별도 구현 commit으로 유지했다. 전체 Cloud 빌드·수동 Actions 없음이며 source PR 등록 체크는 PR Merge Conflict Check 성공이다. 로컬 검증을 전체 GitHub CI 성공으로 표현하지 않는다.

양쪽 새 management PID31 1808499,32 2109516. 현재 정적675파일/관리 JAR3클래스 해시·WEB-INF·HTTP200·새 설정을 확인했고 linkage 오류가 없다. 기존21 VM/63 NIC·동일 host/state/IP/MAC/기본 NIC와 실제 libvirt NIC·프로젝트 역할을 보존했다. Native8개/13389파일·WSL14개/107파일의 HEAD/status/diff/개별 파일 hash도 동일하다.
