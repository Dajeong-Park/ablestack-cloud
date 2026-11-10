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

기존 시험망·VM·NIC·공인 IP·규칙은 삭제하지 않았다. 원래 인증서와 VPN 클라이언트 범위를 복구했다. 사용자/서비스 및 전용 VR 재생성은 시험에 포함돼 해당 UUID와 PSK가 달라졌다. 실제 키·비밀번호는 공개하지 않으며 Mold의 제공된 관리자 계정으로 확인한다.

## 31번

- 프로젝트 `qa-gn1569-31-shared-reg` / `59614883-4085-4a76-99da-b8a1e3a78eed`
- 네트워크 `qa-gn1569-31-vpn-lb` / `43c8f6f5-8893-4a1c-bfaa-a569acaf44bb`
- VM `qa-gn1569-31-vpn-lb-vm` / `551067c6-fbfb-40df-8313-037e21de78cf` / 게스트 `10.234.31.6`
- 새 라우터 `r-1019-VM` / `d958315b-8746-4460-884b-5ba9649087cd` / 호스트 `ablecube31-3`
- VPN 서버 `10.10.31.148` / 클라이언트 범위 `10.1.2.2–10.1.2.8` / 사용자 `qa-gn1569-31-vpn-revoke` Active
- SSL `10.10.31.149:19111` → VM18443 단일 TLS backend / 인증서 `qa-gn1569-31-tls-rotation-20261111`
- UI `http://10.10.31.10:8080/client/` → 위 프로젝트 → Public IP의 VPN/부하 분산 또는 네트워크의 가상 라우터 탭.

## 32번

- 프로젝트 `qa-gn1569-32-shared-reg` / `cf5ec6b5-b522-4c18-ab90-a395012607c1`
- 네트워크 `qa-gn1569-32-vpn-lb` / `b7cd0439-ed95-4e7d-8b31-eb0ebacbd711`
- VM `qa-gn1569-32-vpn-lb-vm` / `e3ddbdd1-ccd7-4299-9461-a33d25d6b645` / 게스트 `10.234.32.227`
- 새 라우터 `r-489-VM` / `5fdc8ecb-c611-418c-b1fa-9773f60703d0` / 호스트 `ablecube32-2`
- VPN 서버 `10.10.32.150` / 클라이언트 범위 `10.1.2.2–10.1.2.8` / 사용자 `qa-gn1569-32-vpn-revoke` Active
- SSL `10.10.32.177:19111` → VM18443 단일 TLS backend / 인증서 `qa-gn1569-32-tls-rotation-20261111`
- UI `http://10.10.32.10:8080/client/` → 위 프로젝트 → Public IP의 VPN/부하 분산 또는 네트워크의 가상 라우터 탭.

원래76 LB 정의/backend·모든 기존 VM/NIC/host/power·망/VPC/IP/Internal LB controller·멤버/역할을 보존했다. 기존 API 권한과 읽기 전용 역할도 유지했다. 전용 VPN 사용자1명씩만 같은 이름/비밀번호로 재등록했고 나머지 사용자 UUID는 보존했다.

비공개 WSL 시험 클라이언트 프로파일은 새 PSK로 갱신해 보관했다. 동시에 하나의 ppp69를 사용하므로 클러스터를 순차 검증했다. 최종 확인용 연결은32번이며31번 설정도 남아 있다. Mold 양쪽 VPN 서비스와 시험 VM은 계속 Running이다. Host/VR 부팅용 archive와 현재 configure.py를 반영했고 현재 실행 VR에 다른 파일 전체를 강제로 패치한 것으로 표현하지 않는다.
