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

# #1569 P07 LB 정책·TLS·역할 통합 회귀

이 문서는 #1627 수정 전 P07 실행 기록이다. 기존 #1625 AppCookie runtime 및 #1626 비동기 정책 UI 개선을 기반으로31·32에서 전용 TCP/HTTP/SSL 규칙을 추가하고 정책·TLS·역할을 교차 검증했다. projectid 생략 삭제 권한 우회가 재현돼 #1627로 분리했고, 후속 수정·양쪽 검증 결과는 [#1627 보고](../guest-network-1627-20261111/README.ko.md)에 연결한다.

## 확인한 범위

- 사이트별48개 역할/메서드/생성·삭제 행렬에서 읽기 전용·비구성원의 명시 projectid 삭제는 거부되지만 생략 삭제는 실제 성공했다. 3프로토콜×2역할×2사이트=12개 우회가 본 행렬에서 검출됐고 시험 정책을 각각 복원했다. 수정 전 성공을 정상 권한으로 계산하지 않는다.
- owner/member/domainadmin 실제 UI 정책 설정 및 사이트별9개 API 옵션 조합을 job1·실제 HAProxy 문법/HTTP/SSH/TLS로 확인했다. LbCookie insert/indirect/nocache/domain·postonly GET/POST·rewrite/prefix와 백엔드 전달 쿠키, SourceBased HTTP/TCP, AppCookie HTTP 요청 학습false/true·SSL false를 포함한다. 잘못된 LbCookie mode의 실제 job2/530에서 실행 설정 SHA가 유지되고 보정 job1/HTTP200으로 복구됐다.
- 31번 구성원의 실제 실패 UI는 초안 보존·프로젝트 문맥 차단/추가POST0·재조회·보정 성공을 확인했다. 전용 SSL 규칙 생성과 owner CA 교체도 실제 UI로 진행했다.
- 양쪽 Root CA 신뢰·호스트명/체인 검증으로 TLS200, TLS1.2/1.3 허용·1.1 거부, 중간 체인 누락의 실제 클라이언트 오류→full-chain 복원200을 확인했다. 원래19111 인증서/정책을 바꾸지 않았다.
- 기존 SSL 역할 문맥26행/사이트는 별도 SSL deny 역할과 비구성원의 명시/생략 쓰기 거부를 확인했다. 네트워크 읽기 전용 역할 자체에는 SSL 쓰기 거부가 없으므로 이를 SSL 거부 역할로 오판하지 않았다.

[캡처](capture-matrix.ko.md) · [정책 옵션31](evidence/31-policy-option-matrix.json) · [정책 옵션32](evidence/32-policy-option-matrix.json) · [수정 전 역할31](evidence/31-role-policy-matrix.json) · [수정 전 역할32](evidence/32-role-policy-matrix.json)

## 남은 범위와 순서

이번 오퍼링 검토는 기존 clone의8192/keepalive true·현재4096/false 인벤토리 확인과 VPC 후보 조회다. 새 오퍼링 실제 전환/VPC/Internal 양성 통합 회귀를 수행했다고 계산하지 않는다. #1627 수정 검증 → 준비된 오퍼링/유형/역할 남은 조합 → 기존 환경 조건 →63행 최종 판정 순이다. 각 클러스터 부분54·환경차단6·적용제외3·행전체완료0을 유지한다. 독립 VPN client2대·CRL/OCSP·Health Monitor 제공자는 미준비이며 LB 백엔드 부하분산 측정은 제외한다.

이번 전용 시험 규칙과 CA full-chain·방화벽·HTTP18080 서비스는 확인용으로 보관하고, 최종 자원·배포·통신 보존 검증은 #1627 보고에 통합했다. 무단 자원 삭제를 하지 않았다.
