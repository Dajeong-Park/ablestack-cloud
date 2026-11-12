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

# 실행 결과·빌드·기능·제한

## 새 SystemVM

| 항목 | 실제 결과 |
| --- | --- |
| source | d5088214ede2f464df9b932e5acf8b62dfdff707 |
| builder | Packer v1.9.4 / QEMU emulator version 7.2.22 (Debian 1:7.2+dfsg-7+deb12u18+b3) |
| ISO | Debian12.12.0 amd64 netinst; 고정 SHA512는 build-provenance.json |
| 실제 build | 2026-11-11 19:56:43–20:33:29 KST,36분46초 |
| product release | 4.23.0.0; artifact suffix는 gn1569-20261111 |
| 패키지 | 2.90-4~deb12u2+ablestack1 |
| 압축 파일 bytes | 683353829 |
| 압축 SHA256 | f29459cdd4754511502bb905cbe8c78dbb20b207634d25d233ee0e6ea1174ae9 |
| qcow2 SHA256 | 43a8d47a88e0b1b7393d6c6beab69f1a49cded687effbdb62a2e5fa8a7820558 |
| 이미지/실행 dnsmasq SHA256 | 74ccbca89162f04d8615484173283f62b29824671120bd2d2579bf0e36e4b9cc |

실행 명령은 WSL ext4의 tools/appliance에서 아래와 같다.

    bash ./build.sh systemvmtemplate 4.23.0.0 x86_64 gn1569-20261111

본문 build는 BUILD SUCCESSFUL에 도달했고 qcow2와 압축 왕복 검증을 통과했다. 바깥 PowerShell→shell wrapper가 종료 코드 변수를 먼저 확장해 빈 exit 오류를 낸 진단을 숨기지 않는다. 이후 독립 qemu-img/read-only NBD 검증을 종료0으로 실행했고 실제 배포/부팅까지 확인했다. wrapper 종료1을 실제 packer 실패나 완전한 shell 성공으로 표현하지 않는다.

양쪽 템플릿 Ready/ROUTING/checksum·실제 새 router template ID/version·binary/proc hash가 일치했다. 원격 파일은 새 이름으로 추가했고 WEB-INF/META-INF·관리 JAR/기존 UI를 교체하지 않았다. Zone routing override만 바꿨다.

근거: [빌드 출처](evidence/build-provenance.json), [이미지](evidence/fresh-image-proof.json), [업로드](evidence/full-template-upload.json), [31 등록](evidence/31-full-template-registration.json), [32 등록](evidence/32-full-template-registration.json), [31 최종 runtime](evidence/31-router-final.json), [32 최종 runtime](evidence/32-router-final.json).

## DHCP/DNS·NIC

| 클러스터/구간 | DNS UDP | DNS TCP | 기존 NIC ICMP | 기존 NIC SSH |
| --- | --- | --- | --- | --- |
| 31 | 900/900 | 900/900 | 225/225 | 225/225 |
| 32 | 900/900 | 900/900 | 225/225 | 225/225 |

일반 재시작90초 + 일반/Live Patch를 포함한 확인100초 + 마지막 정상35초 합계다. UDP/TCP를 각각0.25초 주기로 시도하고 실패는 timeout을 포함한다. ICMP/SSH는1초 간격이다. 일반/Live Patch UI job은 모두1이고 dnsmasq PID2666(31)·2694(32), NRestarts0과 segfault 없음이 유지됐다. 순간 실패가 없었다는 표본 결과이며 무제한 SLA를 뜻하지 않는다.

새 Shared에서 VM21/22/25의 NIC3개를 자동 DHCP로 구성하고 사이트별 VM21/25 두 source에서 UDP/TCP12회씩과 peer ICMP5회/SSH를 확인했다. 재생성 Shared에서는 새 VM25의 .110에 DORA/ACK·unicast ciaddr 갱신·Release 후 lease 소거·재DORA 복구를 확인했다. 기존 VM21 .58 갱신도 ACK로 확인했다. 기존 NIC ID/IP/MAC/default는 유지됐다.

| 클러스터 | UDP/TCP 성공/표본 | 실패 요청 구간 UDP/TCP | 기존 NIC ICMP/SSH |
| --- | --- | --- | --- |
| 31 | 750/866 각각 | 52.33s / 52.33s | 217/217 각각 |
| 32 | 912/950 각각 | 21.43s / 20.98s | 238/238 각각 |

교체 중 DNS 중단은 예상되는 별도 구간이다. 값은 최초 실패 요청 시작부터 마지막 실패 요청 종료까지 span이며 연속 pcap downtime이나 관리 job 전체 시간이 아니다.31 교체217/217,32 교체238/238의 peer ICMP/SSH는 모두 정상이다. template 교체를 DNS 무중단으로 보고하지 않는다.

근거: [전체 계수](evidence/final-test-metrics.json), [31 교체](evidence/31-monitor-recreatefull.json), [32 교체](evidence/32-monitor-recreatefull.json), [31 신규 임대/반납](evidence/31-recreated-new-lease-release-renew.json), [32 신규 임대/반납](evidence/32-recreated-new-lease-release-renew.json), [31 새 망](evidence/31-fresh-shared-dhcp-dns-traffic.json), [32 새 망](evidence/32-fresh-shared-dhcp-dns-traffic.json).

## 추가 잔여 시험

| 분야 | 수행·실제 결과 | 한계/결함 |
| --- | --- | --- |
| 필터·메타데이터 | 43 API/사이트: type/Zone/domain/account/project/VPC/tag·paging,2개 Network bulk tags,231자 한글/HTML literal 코멘트·5역할/visibility·삭제 | Network 이벤트 읽기503와 마지막 데이터 유지/검색 복구. 모든 다른 resource type 교차 완료로 확대하지 않음 |
| 오퍼링 | Shared/L2 ConfigDrive/NAT/VPC Internal 4 clone+명시false custom·Enabled→Disabled | 10개 Disabled clone 보관. 비활성 EIP/default maxconn 정규화와 availability Optional을 설명하고 거짓 결함으로 만들지 않음 |
| Shared IPv4 범위 | 양쪽 UI create→edit→중복 차단→정정→삭제; 추가 .110–112 보관 | 31 두 번째 subnet CRUD 정상.32 추가 subnet DB530=#1628. IPv6 미구성 |
| Egress | 사이트별 source/dest /32에서 UDP/ICMP/ALL 허용→철회와 TCP 대조 실제 packet | 기존 규칙 빈 상태로 원복; management 임시 endpoint 제거 |
| Public IP/NAT/PF | Free→Reserved→Free→재예약→Allocated/StaticNat; nondefault NIC TCP/UDP/ICMP 별도 Firewall·충돌/철회; PF2port 범위·표시 변경·삭제 | 문서상 VPC-only CIDR을 비VPC에 적용한 최초 전제는 정정. 비VPC Firewall CIDR 교체로 차단/복구 확인. Allocated release431과 disassociate 후 반환 확인 |
| VPN 보존 | 원래 slot2 재연결 후 해당 검사 동안 사이트별 ICMP/SSH295/295 | 앱/WSL 재시작 뒤 PPP가 없었던 최초15개 실패 표본은 preflight 진단으로 보존·서비스 변경 실패로 집계하지 않음 |
| 프로젝트 Shared 조회 | 6주체×명시/생략 project×2조회×2사이트=48결과; owner/member/readOnly 실제 UI | member/readOnly 명시 project에서 network1개/IP531=#1629; nonMember432/531 유지 |
| NIC 실패 | 31 실제 VLAN 부족 addNic job2·DB/VM API/virsh XML/UI 대조 | Ghost NIC Allocated·UI 활성화=#1630.32 정상 연결을31 실패 재현으로 확대하지 않음 |
| MAC/CIDR/domain | 32 guest CIDR 밖 요청 거부·/25 할당범위와 domain 수정·DHCP 및 UDP/TCP12/12 | keepMAC=true 도메인 단독 수정에서도 실제 MAC변경=#1631.31 동일 경로는 #1630/VLAN 조건 차단 |
| MTU | 양쪽 기존 allow.end.users.to.specify.vr.mtu=false·요청1400은 유효1500 유지 | global 정책을 켜지 않았다. 지정값 적용 성공으로 계산하지 않음 |
| CRL/OCSP | 새 Root/intermediate/정상·폐기 leaf/CRL·서명 OCSP. OpenSSL CRL goodOK/revoked 거부·HTTP OCSP3개 서명OK·양쪽 관리CRL HTTP200/동일SHA | 양쪽 기본 true의 정상 chain530=#1632. false good 대조 성공2개는 LB미할당·검사 비활성 해결 아님 |

Public IP lifecycle 뒤 MAC 시험에서31 .143/32 .103을 재사용해 종료 시 Allocated다.31은 미구현 망과 실패 NIC,32는 r-506-VM의 Source NAT로 보관한다.

## UI·실패 복구

이번 제품 UI 코드 수정0. 기존 VM 목록/상세/NIC/연결창/breadcrumb를 실제 비교했다. Shared3탭×3폭×2테마×2사이트=36개는 탭 본문이 viewport 안에 보이도록 새 캡처했다. VM NIC/연결창24배치, 양쪽 긴 한글 이름과 설명1280/768/390→확대·원복, Root 프로젝트 기본보기→QA 왕복, 같은 timeOrigin의 즉시 테마를 확인했다. 최초 진입·새로고침 후 같은 IP 탭 scrollTop327에서 양쪽 breadcrumb top78/width980/sticky가 동일했다.

UI query503는 comments/events 한 요청만 CDP 통제 주입했다. comments의 마지막 정상 데이터/초안/쓰기 차단·재조회 복구와 literal/삭제를 확인했다. 실제 서버 장애라고 하지 않는다. 타이밍/초기 loading·메뉴 조작·helper timeout 진단을 성공 기능 수로 계산하지 않는다.

사진210장 원본 모두 JPEG이며 실제 viewport/해시를 감사했다.36장 구형 요약/메타데이터 불완전 사진은 제외하고174장만 연결 증거로 사용한다. [감사](evidence/capture-audit.json).

## 보존·정리·범위

기존 VM major state/host/원래 NIC subset의 변경·누락0. 새 확인용 추가 NIC와 VM25·새 Shared·오퍼링 clone·시험 인증서와 실패 재현 망은 보관했다. role/membership/password/공유 정책·MTU 정책·global SYSTEM 템플릿은 바꾸지 않았다.31 threshold0.90 복원과 temporary route/host IP/helper/firewall 정리를 확인했다.

Native 8개 dirty worktree 13020파일은 이번 시작 snapshot과 동일하다. WSL 14개/107파일은 이전 실행에서 인계한 보호 snapshot과 최종 동일하다. WSL 기준을 이번 시작에 새로 전체 해시했다고 표현하지 않는다. [보존](evidence/worktree-preservation.json).

Java/UI source 변경과 해당 module/UI build는0. 요청한 SystemVM은 로컬 WSL ext4 build다. 전체 Cloud/수동 Actions 미실행. 시작 시 PR 등록 build·Run pre-commit failure와 triage 결과를 확인했으며 CI 전체 성공으로 보고하지 않는다. 게시 후 최신 check 상태는 publication 증거를 따른다.
