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

# 원인·구현·보안 경계

## 전체 체인과 PKIX

기존 CertificateHelper.parseChain은 PEM 첫 객체만 읽는다. CertServiceImpl에 SSL 범위의 전체 PEM/PKCS7 파서를 추가해 업로드 체인의 모든 인증서를 사용한다. 공통 utils 모듈을 광범위하게 바꾸지 않았다. 체인은256KiB·9인증서로 제한한다.

폐기 검사 true는 제공된 self-signed Root의 서명과 완전한 PKIX 경로를 먼저 확인한다. Leaf를 trust anchor로 삼지 않으며 기존 v1 Root도 서명 검증 후 처리한다. 전역 JVM revocation 설정을 변경하지 않고 로컬 경로 검증과 명시적인 폐기 정보 검증을 분리한다. 명시적 false의 기존 anchor 정책과 체인 미제공 계약은 보존했다. 따라서 이 결과를 ‘체인 미제공 모든 인증서까지 새 엄격 정책 적용’으로 확대하지 않는다.

## CRL/OCSP 지원 계약

CertificateRevocationValidator는 Root를 제외한 각 경로 인증서를 검사한다. OCSP가 있으면 우선 사용한다. 정확한 CertID·thisUpdate/nextUpdate를 대조하고 BC PKIXRevocationChecker에 확보한 응답을 전달해 서명/issuer/권한/상태를 검사한다. supplied response와 NO_FALLBACK을 사용해 암묵적인 URL 조회를 피한다.

OCSP 조회 자체가 실패하면 인증·현재성 검증을 통과한 CRL로 검사할 수 있다. revoked/unknown·잘못된 서명/CertID·손상/오래된 OCSP는 정상 CRL로 덮지 않고 거부한다. CRL의 issuer·서명·keyUsage·thisUpdate/nextUpdate를 검사한다. 지원 범위는 full direct CRL이다. delta/indirect/IDP 또는 부분 범위 CRL은 불완전한 정보로 정상 판정하지 않고 거부한다. 해당 복잡한 배포와 별도 외부 제공자 전체를 live 통과로 집계하지 않는다.

## 제한된 HTTP와 관리자가 정한 내부 응답자

RevocationHttpClient는 HTTP(S)만 허용하고 credentials/fragment·잘못된 포트·redirect·자동 retry/cookie/decompression을 거부한다. DNS 전체 주소를 확인하고 요청 DNS resolver를 고정한다. 기본값은 private 응답자 불허이며 loopback/link-local/multicast/unspecified는 항상 거부한다. 혼합 DNS 주소도 검사한다.

동적 전역 설정 `ssl.revocation.allowed.internal.endpoints`는 기본 empty다. 관리자가 지정한 정확한 origin만 private 주소 예외를 허용한다. 양쪽에서 설정 전 기본 ENDPOINT_BLOCKED 거부를 확인한 다음 시험 origin `http://10.10.31.10:20683` 하나만 지정했다. 전역 Java 검사·기존 계정/프로젝트 역할은 완화하지 않았다.

DNS 조회2초·bounded worker2/queue16, HTTP connect/read/pool3초, 요청 budget30초·최대16다운로드·개별2MiB/총8MiB 제한이다. blocking read는 최장3초 추가될 수 있다. redirect·oversize·offline·실제3초 socket timeout·복구를 live로 확인했다. URI/query/키 원문 대신 REVOKED·UNKNOWN·UNAVAILABLE·STALE_RESPONSE·INVALID_RESPONSE·INVALID_OCSP_RESPONSE·INVALID_OCSP_CERT_ID·ENDPOINT_BLOCKED 같은 안전한 범주를 반환한다.

## 등록 UI와 VM 표준

SSLCertificateTab은 기존에 undefined 체크를 false로 전송하고 finally에서 실패 창까지 닫았다. 이제 새 폼의 enabledrevocationcheck=true이며 명시적으로 해제한 false는 기존 계약대로 보낸다. 성공만 초기화하고 실패는 입력을 보존한다. 검증 시작 전부터 submitting lock을 잡아 중복을 방지하고 취소/닫기를 잠근다.

프로젝트·사용자·API 집합·route/resource scope를 기준으로 이전 결과를 폐기한다. 전환 시작/종료된 컴포넌트의 비공개 초안은 제거한다. 기존 API 집합에 따른 조회/등록/삭제 가드와 명시적 project/account 소유자 인수를 사용한다. 기본 권한 정책 자체를 수정하지 않았다.

VM 화면의 목록/상세/NIC 탭/연결 대화상자와 비교했다. MoldDialog md·세로 폼·표준 footer·모바일 여백·theme token을 재사용한다. 기본 등록 버튼 다음에 reload 아이콘+텍스트 업데이트를 둔다. 서버 페이지 이동과 좁은 표의 내부 가로 스크롤을 사용한다. 기존 ResourceView breadcrumb/스크롤 체계를 사용하며 글로벌 스타일을 새로 덮지 않는다.

백엔드 `f7097be4d98bd94258120694d3a1fcbaf549209e`·UI `22ba7f5eab604aa4840fb7decc686d3e3192ba22`. API schema나 DB migration은 없다. 관리 JAR3클래스 외204872 entry를 보존했고 기존 FT/네트워크 패치와 WEB-INF/META-INF/config를 유지했다.
