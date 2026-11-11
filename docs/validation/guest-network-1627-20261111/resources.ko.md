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

# 사용자 확인용 시험 자원

| 클러스터 | 네트워크 | VIP | 실제 VM | 같은 호스트 VR |
| --- | --- | --- | --- | --- |
| 31 GFS2 | qa-gn1569-31-vpn-lb | 10.10.31.149 | qa-gn1569-31-vpn-lb-vm /10.234.31.6 | r-1024-VM /ablecube31-3 |
| 32 RBD | qa-gn1569-32-vpn-lb | 10.10.32.177 | qa-gn1569-32-vpn-lb-vm /10.234.32.227 | r-499-VM /ablecube32-2 |

관리자 로그인 → 프로젝트 qa-gn1569-31/32-shared-reg → 네트워크/Public IP → 위 VIP → 부하 분산 → 목록2쪽의 qa-gn1569-31/32-p07-ssl/http/tcp → 설정/세션 고정으로 확인한다. 두 관리자 브라우저 탭도 확인용으로 남긴다.

- SSL19171→18443: qa-gn1627-31/32-review-ssl, AppCookie/QA_SESSION/32/3h/요청 학습false. 실제 CA full-chain 인증서 연결.
- HTTP19172→18080: qa-gn1627-31/32-review-http, LbCookie/QA_LB_COOKIE/insert/nocache=true.
- TCP19173→22: qa-gn1627-31/32-review-tcp, SourceBased/20k/10m.
- 기존19111 원래 인증서와 qa-gn1626-31/32-review 정책은 그대로 유지한다.
- 전용 방화벽19171/19172/19173은10.10.0.0/16 범위이며 기존 규칙을 넓히지 않았다. HTTP18080 시험 서비스와 기존HTTPS18443, VPN 사용자/활성slot2·정책/프로젝트 역할·서명 제한 시험 키를 보관했다. 개인 LB 대조 시험은 시작과 같은 활성 정책0으로 복원했다.

로그인 정보·API/secret key·PSK·인증서 개인키는 공개하지 않았다. 별도 삭제 지시 전까지 확인 자원을 유지한다.
