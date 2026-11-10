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

# 확인용 시험 자원

기존 자원을 삭제하지 않았다. 신규 개인 권한용 규칙/인증서와 전용 역할/계정을 남겼다. 로그인 비밀번호·API 키·개인키·VPN PSK는 공개하지 않는다. 관리자 UI에서 해당 계정/역할과 기존 프로젝트를 확인할 수 있다.

## 31번

- 프로젝트: `qa-gn1569-31-shared-reg` / `59614883-4085-4a76-99da-b8a1e3a78eed`
- 네트워크: `qa-gn1569-31-vpn-lb` / `43c8f6f5-8893-4a1c-bfaa-a569acaf44bb`
- VM: `qa-gn1569-31-vpn-lb-vm` / `551067c6-fbfb-40df-8313-037e21de78cf`
- 기존 TLS: `https://10.10.31.149:19111` → 기존 VM18443 단일 backend. 원래 인증서 `qa-gn1569-31-tls-rotation-20261111` 복구.
- 개인 권한용 규칙: `qa-gn1620-31-personal` / `f4540e57-d79f-454c-8ec1-e0c77023a3a7` / 공인19120→18443. backend/FW 없음.
- 전용 계정/프로젝트 역할: `qa-gn1620-31-ssl-deny`. assignCertToLoadBalancer/removeCertFromLoadBalancer 두 deny만 지정. 전역 읽기 전용 역할이 아니다.
- UI 확인: `http://10.10.31.10:8080/client/`에서 위 프로젝트 → Public IP → 부하 분산 → TLS review 규칙 → SSL 인증서. 31번 규칙은 두 번째 페이지.

## 32번

- 프로젝트: `qa-gn1569-32-shared-reg` / `cf5ec6b5-b522-4c18-ab90-a395012607c1`
- 네트워크: `qa-gn1569-32-vpn-lb` / `b7cd0439-ed95-4e7d-8b31-eb0ebacbd711`
- VM: `qa-gn1569-32-vpn-lb-vm` / `e3ddbdd1-ccd7-4299-9461-a33d25d6b645`
- 기존 TLS: `https://10.10.32.177:19111` → 기존 VM18443 단일 backend. 원래 인증서 `qa-gn1569-32-tls-rotation-20261111` 복구.
- 개인 권한용 규칙: `qa-gn1620-32-personal` / `cf07d2ac-7b7f-4c04-9111-7157dc85fa81` / 공인19120→18443. backend/FW 없음.
- 전용 계정/프로젝트 역할: `qa-gn1620-32-ssl-deny`. assignCertToLoadBalancer/removeCertFromLoadBalancer 두 deny만 지정. 전역 읽기 전용 역할이 아니다.
- UI 확인: `http://10.10.32.10:8080/client/`에서 위 프로젝트 → Public IP → 부하 분산 → TLS review 규칙 → SSL 인증서. 31번 규칙은 두 번째 페이지.

기존74 규칙의 정의/backend와 모든 VM NIC·실행 상태·호스트 및 네트워크 오퍼링이 유지됐다. 신규 개인 규칙2개를 포함한 최종 규칙은76개다. 기존 프로젝트 멤버/역할과 읽기 전용 권한은 그대로이며 전용 새 멤버/역할만 각1개 추가했다. API 키는 이 전용 계정에 요청한4 SSL/조회 명령 제한으로 생성해 보관했다. 생성 응답에 규칙 배열이 없으므로 요청만으로 제한 저장을 단정하지 않고 실제 비허용 VM 조회432로 확인했다.
