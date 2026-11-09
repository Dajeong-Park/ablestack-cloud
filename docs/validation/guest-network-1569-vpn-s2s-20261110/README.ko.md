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

# #1569 VPN·VPC S2S·Health Monitor 후속 검증

2026-11-10. **31 GFS2·32 Glue(Ceph) RBD에서 실제 VPN 클라이언트·VPC 간 S2S 통신과 실패 복구를 검증**했다. 제품 UI/API/Java·권한 정책을 수정하거나 새 빌드/배포를 실행한 작업은 아니다. 양쪽 활성 UI는 #1608 제품 `8f27a55dfeb78a488f56bc5d07070414617f5daf`와 동일한 index 해시/HTTP200/WEB-INF를 유지한다. Epic 브랜치 `dhslove/epic-1554-guest-networks`·Draft PR [#1577](https://github.com/ablecloud-team/ablestack-cloud/pull/1577)을 유지한다.

[검증 요약](evidence/summary.json) · [원본 캡처114장](capture-matrix.ko.md) · [확인용 자원/직접 UI 링크](resources.ko.md) · [60개 배치](evidence/ui-matrix.json) · [입력/DOM](evidence/ui-state.json) · [31 최종 검증](evidence/31-final-verification.json) · [32 최종](evidence/32-final-verification.json).

## 결과와 판정

| 항목 | 31·32 실제 결과 | 판정/제한 |
| --- | --- | --- |
| Remote Access VPN | 기존 전용 Source NAT VPN/사용자를 재사용. WSL Linux strongSwan6.0.6·xl2tpd1.3.17·ppp2.4.9 클라이언트가 실제 IKEv1/PSK → L2TP → MSCHAPv2 → PPP 주소를 받고 게스트 ICMP5/5·TCP22/SSH banner3/3 성공 | 서버 Running 표시와 실제 클라이언트 성공을 별도 대조. Windows/macOS 클라이언트 전수 검증은 아님 |
| 사용자 인증 실패/복구 | 양쪽 틀린 암호에서 IKE는 성공하나 PPP 인증은 거부되고 IP/세션을 받지 못함. 기존 정상 암호로 재접속해 PPP·ICMP5/5·TCP3/3 회복 | 서버 사용자 암호/PSK를 변경하거나 인증 정책을 완화하지 않음. 사용자 삭제 후 기존 세션 철회·역할별 조합은 남음 |
| 터널 단절/재접속 | 32 클라이언트의 해당 IKE SA를 종료 → 실제 ping 실패/TCP0/3. 새 세션 연결 후 PPP·ICMP5/5·TCP3/3 복구 | 클라이언트 시험 연결만 중단. 서버/기존 VM 재시작 없음 |
| VPC S2S 구성 | 기존 전용 svc-review VPC를 재사용. **게이트웨이는 양쪽 실제 UI 생성**, 고객 GW/연결·시험 ACL/게스트 경로는 API/SSH로 준비. 31은 Passive=true,32는 false. 양쪽 API Connected·IKEv2/CHILD SA INSTALLED | 연결을 UI로 생성했다고 표현하지 않음. UI는 입력/후보·목록/상세·재설정·상태/프로젝트/테마를 검증 |
| 실제 암호화 통신 | 10.239.31.121↔10.239.32.248. 초기/재설정 후/복구 후/최종 각각 양방향 ICMP10/10·TCP22/SSH banner5/5, 별도 암호화 시험 ICMP15/15·TCP5/5. 외부 NIC에서 양쪽 ESP8패킷씩 캡처·SA 카운터 대조 | IKEv2 AES256/SHA256/DH2048·ESP AES256/SHA256. 게스트 NIC는 각 VPC 라우터와 같은 호스트이므로 미구성 스위치 VLAN을 경유하지 않음 |
| S2S 실제 피어 장애 | 31 전용 VPC VR의 strongswan-starter만 중단. 양쪽 API Disconnected·UI 연결 불가·ICMP100% 손실·TCP0/5. 32 UI 재설정 job1이어도 실제 연결은 계속 불가 | **명령 job 성공과 터널/통신 성공은 다름**을 확인. 원격 VPN VR과는 다른 전용 라우터이므로 RA 시험과 독립 |
| S2S 장애 복구 | 31 서비스를 다시 시작한 뒤 양쪽 새 SA/Connected·실제 통신 복구. 복원 후 추가 UI 재설정은 캡처 준비 단계에서 실행되지 않았고 자동 재협상 복구로 판정 | 최종 양쪽 Connected·ICMP10/10·TCP5/5·기존 VM libvirt Running/UUID 확인 |
| VPN UI 조회 실패 | 현재 IP의 listRemoteAccessVpns XHR1건만 통제503. 상태 경고/변경 동작 비활성, 생성/삭제 POST0. 재조회 후 Running/변경 버튼 복구 | 서버 API를 변경하지 않은 브라우저 한정 시험. 가로채기 제거 |
| Health Monitor | 전용 LB의 API createLBHealthCheckPolicy가 양쪽430 unsupported, 전후 정책0. 실제 UI 설정 메뉴에도 전용 Health Monitor 작업 없음 | VirtualRouter 미지원. Netscaler 없음/Tungsten Disabled. **정상 health·장애 복구는 환경 차단**이며 HAProxy 기본 check나 API 거부를 정상 health 검증으로 계산하지 않음 |

새 S2S 객체는 양쪽 게이트웨이1·고객 GW1·연결1이다. 기존 전용 ACL 규칙2개씩을 그대로 두고 **상대 시험 VM /32만 ICMP echo·TCP22로 허용하는 규칙2개씩**을 추가했다. VM24의 기존 NIC/기본 경로를 보존하고 상대 VM /32 경로만 VPC NIC에 추가했다. 이 제한된 시험 구성과 연결은 리뷰를 위해 유지한다. 운영 오퍼링·전역 방화벽·다른 시험망 정책을 변경하지 않았다.

## 발견한 UI 결함과 설계

1. **[#1609 P1: PSK 기본 평문 노출](https://github.com/ablecloud-team/ablestack-cloud/issues/1609).** VPC VPN 접속 표·전역 S2S 목록/상세·VPN 고객 GW 목록/상세의 **양쪽10개 화면**에서 기본 DOM/화면에 PSK가 노출되는 것을 실제 확인했다. Remote Access VPN은 기본 마스킹/명시적 표시 버튼이 있어 계약이 다르다. API/역할 정책을 바꾸지 않고 목록 마스킹·상세의 명시적 열람/복사·프로젝트/대상/경로 변경 초기화를 구현해야 한다. [비밀값 제거 DOM](evidence/psk-surfaces.json). 증적에는 실제 키를 게시하지 않았고 해당 열을 제외한 원본 crop만 보관했다.
2. **[#1610 P2: VPN GW 생성 창 수명·표준](https://github.com/ablecloud-team/ablestack-cloud/issues/1610).** 양쪽 UI createVpnGateway job1·목록1 성공 후에도 생성 창/확인 버튼이 남았다. VpcTab.vue의 successMethod가 창을 닫지 않고 제출 loading과 대화상자 loading도 분리돼 있다. VM MoldDialog·하단 footer·중복 제출/진행 상태·확정 실패 입력 보존·불확실 job 조회를 적용해야 한다. VPN 접속 생성 창의 Passive를 ‘정적’으로 표시하는 번역도 함께 정리한다. [31 재현](screenshots/31-gateway-success-dialog-still-open.jpg) · [32 재현](screenshots/32-gateway-success-dialog-still-open.jpg).

두 건 모두 Epic #1554의 실제 하위 이슈로 연결했으며 아직 구현/종결하지 않았다. 이번 통신 성공이 해당 UI 결함의 해결을 뜻하지 않는다.

## VM 표준·프로젝트·반응형/다크

VM NIC 탭·기존 네트워크 연결 MoldDialog를 비교 기준으로 **31/32 ×라이트/다크 ×390/768/1280px ×5화면(원격 VPN 탭·VPC VPN GW 탭·VPN 사용자 목록·VM NIC·VM 연결 창)=60개 기하/배치 검사**를 수행했다. 가로 페이지 넘침0·sticky breadcrumb 경계·대화상자/footer viewport 범위를 확인했다. VPC 기존 VPN 생성 창의 표준 불일치는 #1610으로 분리했으므로 모든 UI 표준이 통과했다고 표현하지 않는다.

양쪽 실제 스타일 메뉴로 라이트↔다크를 전환했고 timeOrigin 동일로 새로고침 없음을 확인했다. 기본 보기↔원 프로젝트 왕복 시 전용 VPN 사용자는 기본 목록에서 없어지고 원 프로젝트에서 복원됐으며 변경 POST0이다. 32에서는 이전 검색 필터를 실제 목록 footer의 해제 버튼으로 지운 뒤 기본 보기를 선택했다. Root 관리자 문맥의 검증이며 모든 역할×모든 폭/테마 전수 조합을 의미하지 않는다.

원본을 직접 열어본 뒤 긴 모바일 요약 때문에 탭 본문이 일부 화면 밖인 것을 확인해 **390/768px에서 실제 탭을 클릭/스크롤한 본문 캡처16장**을 추가했다. 본문/표 스크롤은 허용하고 모든 텍스트가 한 화면에 동시에 보인다고 주장하지 않는다. 보완 캡처 중 브라우저 제어 시간 초과1회 후 저장 증적을 복원해 이어갔고 개체 생성은 반복하지 않았다. 114 native JPEG의 live viewport 또는 명시적 crop과 디코딩 치수·해시를 모두 대조했다. 비밀값 열 제외/확인창 원본 crop은 기재된 영역만 캡처했으며 이미지를 편집해 가린 것은 아니다. 임시 viewport/Fetch 대체는 해제했다.

## 클라이언트 시험의 보정과 보존

초기 strongSwan 클라이언트 ESP 기본 proposal이 서버의 비-PFS transport 정책과 달라 CHILD SA가 거부됐다. **클라이언트 proposal만 AES256/SHA256·none으로 명시**한 뒤 협상했다. 최초 급속 재접속은 이전 L2TP 세션 패킷이 겹쳐 PPP 협상이 완료되지 않았고, 이후 정상 종료·시도별 고유 UDP 포트를 사용했다. 이 중간 단계를 잘못된 암호 거부/정상 복구 성공으로 계산하지 않는다. 최종 bad-password-confirmed/auth-recovered-final은 양쪽 실제 인증 거부/복구를 별도 검증한 증적이다. [strongSwan 설정 근거](https://docs.strongswan.org/docs/latest/swanctl/swanctlConf.html) · [CloudStack VR 간 S2S/Passive 구성 근거](https://docs.cloudstack.apache.org/en/latest/adminguide/networking/site_to_site_vpn.html).

기존 **31 망115/VM157·32 망98/VM85**의 식별자·상태·호스트·NIC와 기존 AutoScale 그룹/Remote VPN UUID·사용자·PSK가 동일하다. API·실제 호스트에서 최종 실행을 대조했다. 시험용 WSL 클라이언트 daemon/PPP·호스트 제어 IP172.26.31.254/172.26.32.254만 제거했다. Mold의 게이트웨이·고객 GW·연결·시험 ACL/경로·기존 VM·네트워크는 남겼다. 관리 서버 WEB-INF·HTTP200·index 해시는 #1608 배포와 동일하다. 제품 변경이 없어 새 lint/단위/Maven/전체 Cloud 빌드·수동 Actions를 실행하지 않았다. LB 백엔드 분산/처리량 측정은 제외다.

## 남은 항목과 후속 순서

1. **#1609 PSK 기본 마스킹**을 먼저 구현·31/32 재검증한다.
2. **#1610 VPN 생성 대화상자 수명·VM 표준**을 구현·재검증한다.
3. #1569의 VPN 사용자 삭제/세션 철회·잔여 역할/오퍼링 조합, 제공자가 준비되는 Health Monitor 정상/장애 복구를 검증한다. 현재 Health Monitor 제공자는 미준비이며 별도 준비 정보는 사용자에게 요청했다.
4. 외부/VPC/Internal LB·잔여 오퍼링, 준비된 PVLAN/IPv6/Routed·BGP/외부 DNS 조건을 검증한다. LB 분산 성능은 제외한다.
5. 63행 결과를 최종 통합한다. 새 결함으로 **C06/P09 실패**, 양쪽 실패2·부분52·환경차단6·적용제외3, 전체 완료0이다. #1554/#1569·Draft PR #1577은 Open을 유지한다.
