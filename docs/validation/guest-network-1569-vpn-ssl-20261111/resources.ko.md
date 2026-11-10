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

# 확인용 시험 자원과 접속 경로

관리자 UI로 프로젝트 `qa-gn1569-31-shared-reg` / `qa-gn1569-32-shared-reg`를 선택한다. **자원을 삭제하지 않았다.**

| 항목 |31 GFS2|32 Glue RBD|
| --- | --- | --- |
|네트워크|qa-gn1569-31-vpn-lb|qa-gn1569-32-vpn-lb|
|VM|qa-gn1569-31-vpn-lb-vm|qa-gn1569-32-vpn-lb-vm|
|호스트|ablecube31-3|ablecube32-2|
|VPN Source IP|10.10.31.148|10.10.32.150|
|LB Public IP|10.10.31.149|10.10.32.177|
|신규 SSL LB|qa-gn1569-31-backend-tls-review ·19111→18443|qa-gn1569-32-backend-tls-review ·19111→18443|
|신규 인증서|qa-gn1569-31-tls-rotation-20261111|qa-gn1569-32-tls-rotation-20261111|
|신규 clone|qa-gn1569-31-nat-clone-20261111 ·8192/true|qa-gn1569-32-nat-clone-20261111 ·8192/true|

현재 네트워크에는 원래4096/Keepalivefalse 오퍼링을 다시 연결했다. 기존18874 SSL에는 원래인증서, 신규19111 SSL에는교체시험인증서를 연결했다. 새 clone은연결하지 않고 보관했다. 기존72 LB 정의/backend와 모든 기존VM/NIC/전원/호스트·망/VPC/IP/Internal LB controller를 보존했다. VR는 오퍼링 변경/복원으로 재생성됐으며 현재 하나씩Running이고 VM과같은호스트다.

VPN 사용자는4명씩Active다. 전용 서비스 재생성으로PSK가바뀌었고, 승인에따라owner 로그인도재설정했다. 비밀번호/PSK/인증서개인키는이문서·이슈·PR·캡처에넣지않았다. 확인은제공된admin계정으로할수있다. 기존read-only역할에추가했던SSLdeny2개씩은정확히제거해원래정책을복원했으므로해당거부재현은이슈의전용시험조건을다시설정해야한다.

시험VM에는 `/var/lib/qa-gn1569-vpn-ssl-20261111` 및 `qa-gn1569-backend-tls.service`(enabled/active), 게스트방화벽TCP18443 허용을남겼다. Public firewall은기존LB IP의19111/TCP를10.10.0.0/16에만허용한다. SSH용임시VPN클라이언트/ppp69는정리했다. 서비스는단일고정본문을돌려주며LB분산측정용이아니다. 인증서는시험용자체서명7일유효다.

- [31 VPN 탭](http://10.10.31.10:8080/client/#/publicip/ea568ffa-ed12-4d07-b174-f12f3fe80bd2?tab=vpn) · [31 LB 탭](http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing) · [31 네트워크](http://10.10.31.10:8080/client/#/guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb)
- [32 VPN 탭](http://10.10.32.10:8080/client/#/publicip/d286ca9d-1d48-42e7-8dac-ff2e73fe3c46?tab=vpn) · [32 LB 탭](http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing) · [32 네트워크](http://10.10.32.10:8080/client/#/guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711)
