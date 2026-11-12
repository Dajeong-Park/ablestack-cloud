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

별도 삭제 지시까지 유지한다. 인증 정보·PSK·개인키·API 키는 공개하지 않는다.

| 클러스터 | 프로젝트 | Public LB / 규칙 | 네트워크 / VM | 라우터 / 호스트 |
| --- | --- | --- | --- | --- |
| 31 | qa-gn1569-31-shared-reg / `59614883-4085-4a76-99da-b8a1e3a78eed` | 10.10.31.149:19111→18443 / `9649f2d1-d4ba-42e9-8022-d764dfb45611` | qa-gn1569-31-vpn-lb / qa-gn1569-31-vpn-lb-vm | r-1019-VM / ablecube31-3 |
| 32 | qa-gn1569-32-shared-reg / `cf5ec6b5-b522-4c18-ab90-a395012607c1` | 10.10.32.177:19111→18443 / `dd36a10c-b2fa-4611-a662-f20c9c4736e4` | qa-gn1569-32-vpn-lb / qa-gn1569-32-vpn-lb-vm | r-489-VM / ablecube32-2 |

원래 rotation 인증서·모든 SSL 매핑·76 LB 정의와 backend를 복원/보존했다. UI 경로는 네트워크 > Public IP 주소 > 해당 IP > 부하 분산 > 검토 규칙 설정 > SSL 인증서다. 기존 망·라우터·VM/NIC·VPN 서비스/사용자·계정/역할·인증서를 삭제하지 않았다. SSL 명시 거부 계정과 두 거부 규칙도 남겼다.
