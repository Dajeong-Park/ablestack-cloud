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

# 확인용 보관 자원

기존 시험망/VM/NIC/LB/VPN과 새 전용 사용자·인증서를 별도 삭제 지시까지 남긴다. 원래 오퍼링·SSL 인증서 매핑·정책 없음·VPN range는 복원했다. 비밀번호·PSK·private key는 공개하지 않는다.

| 클러스터 | 프로젝트 | 네트워크 / TLS | 최종 VR·host |
| --- | --- | --- | --- |
| 31 | qa-gn1569-31-shared-reg | qa-gn1569-31-vpn-lb / 10.10.31.149:19111→18443 | r-1022-VM / ablecube31-3 / `167ee3de-acfb-4146-a8b6-9a31ee716d3c` |
| 32 | qa-gn1569-32-shared-reg | qa-gn1569-32-vpn-lb / 10.10.32.177:19111→18443 | r-494-VM / ablecube32-2 / `973332e3-5e8a-487e-bd19-aef24e8c26fc` |

각 프로젝트의 VPN 사용자 qa-gn1569-{31/32}-parallel-a/b를 유지한다. 인증서 qa-gn1569-{31/32}-valid-chain-no-revocation 및 tls-no-chain-20261111을 유지한다. CA 검토용 인증서는 시험 업로드에서만 revocation=false를 명시했고 원래 인증서 매핑은 복원했다. Public IP > 부하 분산 > qa-gn1569-{31/32}-backend-tls-review > 설정 > SSL 인증서에서 후보를 확인할 수 있다.

VPN 비활성/활성 시험으로 PSK가 회전했다. 최신 시험 client 자료는 이번 실행의 비공개 작업 디렉터리에 갱신했다. 기존 과거 실행의 client 자료는 과거 키일 수 있다. UI는 관리자/소유자의 VPN 탭에서 현재 키를 기본 마스킹하며 제공한다.

오퍼링 전환에 따라 기존 r-1020/r-490이 r-1022/r-494로 교체됐다. 중간 시험 VR은 Cloud의 정상 전환 절차로 제거됐으며 기존 네트워크·IP·VM/NIC는 유지했다. 관리 JAR/서비스/UI를 재배포하지 않았다. 독립 client2대 미준비는 사용자 답변대로 환경 조건이다.
