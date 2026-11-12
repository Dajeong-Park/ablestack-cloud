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

# 63행 기능/표시 근거와 실행 경계

원래 유형/상세/탭 계약63행을 유지한다. 이 표는 기존 누적 결과와 이번 추가 근거를 연결하며, 부분54를 일괄 PASS로 바꾸지 않는다. 알려진 기능 결함0과 모든 조건 조합 실행 완료는 서로 다른 판단이다. UI P3 및 환경 준비 항목은 제품 기능 오류로 세지 않는다.

| 시나리오 | 기능/계약 | 이번 추가 또는 누적 확인 | 남은 경계 |
| --- | --- | --- | --- |
| C01 공통 | 목록·필터·검색·페이지 / 세 유형/Zone/domain/account/project/VPC/태그·정렬·선택 | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| C02 공통 | 요약·상세 필드 / 유형별 표시·API 값·상속·빈 값·직접 링크·long/mobile | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| C03 공통 | 작업·일괄 작업 / update/restart/delete·busy/권한/유형·부분 실패·물리 정리 | 서비스 의존 삭제/소모 VPN·LB 망 job와 실제 디스크 정리, 부분 삭제 보호, Shared Live Patch | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| C04 공통 | 오퍼링 선택·상세 연결 / 유형/Zone/provider/service/capability·현재/변경 후보 | 오퍼링 실제 UI/API 왕복·원복 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| C05 공통 | 관련 VM·NIC / VM 보기/생성/추가 NIC/기본 NIC/게스트 상태 | Shared/L2 기본 NIC 왕복·실제 MAC·새 VM 통신 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| C06 공통 | 갱신·실패·사용성 / 입력/목록 유지·응답 역전·job·retry·keyboard/dark/mobile | UI 읽기/쓰기503 보존·복구; #1634/35는 P3 UI | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| C07 공통 | 권한·공유·project / Admin/DomainAdmin/User·domain hierarchy·cross-owner | 추가6역할446호출·UI40허용/10거부·권한 원본 보존 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| I01 Isolated | 생성 NAT / IPv4/NAT·CIDR/gateway/netmask/DNS/domain/MTU/SNAT MAC | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| I02 Isolated | 생성 no-SourceNat / specify ranges·VLAN·오퍼링/provider·서비스 | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| I03 Isolated | VPC tier·ACL / VPC candidate·CIDR·ACL 선택/교체·중첩 IP 서비스 | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| I04 Isolated | IPv6/DualStack / 오퍼링/protocol·IPv6 DNS/주소/경로·firewall | 환경 미구성: 실패/통과로 집계하지 않음 | IPv6/AS·BGP/라우팅/외부 DNS 제공자 준비 후 실행 |
| I05 Isolated | Static/Dynamic Routed / AS 번호·BGP·routing rules·IPv4/6 경로·packet | 환경 미구성: 실패/통과로 집계하지 않음 | IPv6/AS·BGP/라우팅/외부 DNS 제공자 준비 후 실행 |
| I06 Isolated | 수정·영향 / DNS/오퍼링/CIDR/domain/SNAT/MTU·서비스별 유효 인자 | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| I07 Isolated | 삭제·재시작 / router readiness·cleanup/livepatch/redundant·VPC·의존성 | 소모 서비스 망 삭제·사용 중 보호·Shared Live Patch; live redundant는 조건부 | live redundant VR 등 별도 fixture 미구성 |
| I08 Isolated | 송신 방화벽 / TCP/UDP/ICMP/ALL·source/dest CIDR·포트/정책·실제 packet | TCP/UDP/ICMP/ALL 실제 허용·철회·차단 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| L01 L2 | 생성 기본 / VLAN/VNI·provider·specify VLAN·owner/project | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| L02 L2 | PVLAN / community/isolated/promiscuous·primary/secondary·충돌·전환 | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | Linux Bridge 거부/일반 L2 프레임 누적 근거, OvS PVLAN 정상 패킷 미실행 |
| L03 L2 | 중복 우회·권한 / bypassvlanoverlapcheck·범위/역할·서버 거부 | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| L04 L2 | ConfigDrive / UserData service·VM 데이터/주소 전달·오퍼링 clone | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| L05 L2 | VM 접속·격리 / VM 생성/add NIC/default NIC·VLAN 통신/PVLAN 격리 | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | Linux Bridge 거부/일반 L2 프레임 누적 근거, OvS PVLAN 정상 패킷 미실행 |
| L06 L2 | 상세·수정·삭제 / L2/PVLAN 값·무관 L3 필드·restart 제외·사용 NIC 보호 | 빈/사용 중 L2 독립 삭제·보호·NIC 해소 후 정상 삭제 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| L07 L2 | 제공자 조건부 탭 / VNF/policy/logical router/custom actions·non-L3 이유 | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| S01 Shared | 공유 범위 / all/domain/subdomain/account/project·역할·UI/API scope | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| S02 Shared | 물리망·연관망·오퍼링 / Zone/tags/physicalnetwork/specify VLAN/associatednetwork | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| S03 Shared | VLAN/PVLAN / VLAN/VNI·secondary·충돌/우회·실제 격리 | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | Linux Bridge 거부/일반 L2 프레임 누적 근거, OvS PVLAN 정상 패킷 미실행 |
| S04 Shared | IPv4/IPv6 생성 / gateway/netmask/CIDR/start/end/router IP·DNS·MTU | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| S05 Shared | IP Addresses / guest 주소/할당·VM/NIC·publicIP와 구분·페이지·권한 | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| S06 Shared | 게스트 IP 범위 / IPv4/6·다중 subnet·중복·사용 IP·CRUD/async | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| S07 Shared | DHCP/DNS·router / VM 실제 할당/갱신/반납·DNS 질의·router 없는 오퍼링 | 새 Shared 기본 VM DNS/ICMP/SSH 및 기존 임대 검증 누적 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| S08 Shared | DNS Zone 작업 / zone/subdomain 후보·associate/disassociate·실제 질의 | 환경 미구성: 실패/통과로 집계하지 않음 | IPv6/AS·BGP/라우팅/외부 DNS 제공자 준비 후 실행 |
| S09 Shared | usage·수정·restart / hideipaddressusage·DNS 쌍·specifyvlan 권한·서비스 영향 | Shared Live Patch 같은 VR/패치 hash·각120표본 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| S10 Shared | 공유 철회·사용 중 삭제 / 범위/NetworkPermissions 차이·기존 VM·신규 NIC 영향 | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| P01 Public IP | 상태·수명주기 / Free/Reserved/Allocated/SourceNat/StaticNat/system·reserve/release/SNAT 변경 | 추가 IP 할당/서비스 전환/해제·최종 Free | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| P02 Public IP | 상세·Static NAT / VM→NIC→primary/secondary IP·enable/disable·충돌 | primary/secondary Static NAT 실제 TCP/UDP/ICMP·철회·충돌 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| P03 Public IP | Firewall / protocol/CIDR/port/ICMP·CRUD/replace·tags/bulk·packet | TCP/UDP/ICMP 방화벽 실제 패킷·6역할 태그·일괄 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| P04 Public IP | Port Forwarding / create/update/delete·public/private range·VM/NIC/IP·CIDR | TCP/UDP 포트 범위·secondary 변경 실제 패킷 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| P05 Public IP | LB 기본 CRUD / algorithm/protocol/ports/CIDR·provider·edit/delete | PF/LB 같은 IP·알고리즘 변경·단일 backend 패킷·삭제 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| P06 Public IP | LB VM 연결 / 다중 backend/NIC/IP·나중 연결·create/assign 부분 실패·retry | backend 해제 시 응답 marker 부재·재할당 복구 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| P07 Public IP | LB stickiness·TLS / policy·SSL cert assign/remove/backendssl·권한·secret | 기존 #1625/26/27/32 결과 통합·최종 chain3/TLS/문법/점검0 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| P08 Public IP | LB health·AutoScale / 제공자 health monitor·AutoScale 링크/소유·실제 health | 전용 AutoScale 소유 LB3개씩 삭제 거부·원본 보존; 외부 Health provider 없음 | 외부 Health Monitor provider 없음; AutoScale 전용 보호 시험은 성공 |
| P09 Public IP | VPN / remote access/VPC gateway·사용자·activate/delete·client packet | VPN 역할 철회/인증 거부·복구·서비스 삭제 영향·오퍼링 왕복 후 재접속 | 독립 외부 VPN client2대 없음; 동시 독립 통신 미실행 |
| P10 Public IP | VPC/conserve mode 분기 / SourceNat/StaticNat·Firewall capability·PF/LB 공존 조건 | conserve=true 실제 공존; VPC false LB/PF 배타·Static NAT 충돌/서비스 전환 양쪽 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| P11 Public IP | 관리 규칙 보호 / Kubernetes/AutoScale owner·편집/삭제/bulk/API 거부 | AutoScale6그룹 보호; 운영 Kubernetes 쓰기 미실행 경계 유지 | 전용 Kubernetes 파괴 시험 fixture 없음; 운영 규칙 보존 |
| X01 조건부 | BGP peers / ASN/IPv4/6/peer변경/dedication/secret·실제 세션·routes | 환경 미구성: 실패/통과로 집계하지 않음 | IPv6/AS·BGP/라우팅/외부 DNS 제공자 준비 후 실행 |
| X02 조건부 | Routing firewall / route/service/VPC 조건·CRUD/정책/packet | 환경 미구성: 실패/통과로 집계하지 않음 | IPv6/AS·BGP/라우팅/외부 DNS 제공자 준비 후 실행 |
| X03 조건부 | IPv6 firewall / IPv6/DualStack·ICMPv6·CIDR·정책/packet | 환경 미구성: 실패/통과로 집계하지 않음 | IPv6/AS·BGP/라우팅/외부 DNS 제공자 준비 후 실행 |
| X04 조건부 | Tungsten policy / tf·nonShared·apply/remove·sequence·tenant | 현재 제공자/API 조건상 적용 제외 | Tungsten/Custom Action 환경 전용 |
| X05 조건부 | Tungsten logical router / network gateway↔router연결·scope·packet | 현재 제공자/API 조건상 적용 제외 | Tungsten/Custom Action 환경 전용 |
| X06 조건부 | VNF / networkid/연관 장비·상태/IP/host/template/link·실패 | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| X07 조건부 | Custom Actions / 서비스/list/run API·파라미터/secret·job·실제 결과 | 현재 제공자/API 조건상 적용 제외 | Tungsten/Custom Action 환경 전용 |
| M01 권한·메타데이터 | Network Permissions / create/remove/reset accountids/projectids·owner/domain/project·existing NIC | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| M02 권한·메타데이터 | VM selection/link / domain/project/공유 범위와 VM 생성/NIC 사용권한 | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| M03 권한·메타데이터 | Events / Network/IpAddress scope/UUID·필터/페이지/읽기 실패 | 6역할·응답 UUID·API 페이지·UI 읽기 실패/복구 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| M04 권한·메타데이터 | Comments / annotation list/add/update/delete/visibility·작성자/owner·HTML | 작성자/관리자 전용·가시성·리터럴HTML·255자·쓰기 실패/복구 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| M05 권한·메타데이터 | Tags·관련 링크 / Network/IP/Firewall/PF/LB type/UUID·CRUD/search·권한 | 5 Network/IP대상·FW/PF/LB 태그6역할·일괄·12개 페이지·실제 UI retry job1 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| O01 오퍼링 | 목록/상세/상태 / 유형/범위·order/tags/availability·사용망·default/system | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| O02 오퍼링 | Isolated 조합 / NAT/noSNAT/VPC/routing/IP protocol·AS·VR/service | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| O03 오퍼링 | L2 조합 / ConfigDrive/UserData·VLAN/isolation·provider/security caps | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| O04 오퍼링 | Shared 조합 / DHCP/DNS·IP ranges/assocNet·IPv4/6·public/stretched | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| O05 오퍼링 | 서비스/provider/capability / SNAT type·redundant VR·LB/EIP/ELB/AutoScale·지원제공자 | 누적 구현/검증 보고서 근거 유지; 이번 전 조합 재실행 아님 | live redundant VR 등 별도 fixture 미구성 |
| O06 오퍼링 | clone·선택 전환 / 값/기본/false·무관 필드/provider/capability 삭제·secret | clone 선택·원복/실제 반영 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| O07 오퍼링 | 접근 범위·사용 영향 / domain/Zone·역할·관리/CKS·기존망 영향/실제반영시점 | 역할/사용망/기존 VPN 영향 및 복구 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |
| O08 오퍼링 | LB 상세설정 / maxconnections/keepalive·지원·HAProxy 실제적용 | HAProxy maxconn4096↔8192·keepalive 실제 반영·원복 | 원래 조건/제공자·역할 조합은 이전 보고서와 종료 평가의 실행 경계를 유지 |

최신 상세 근거는 [실제 결과](test-results.ko.md), [종료 준비](closure-preparation.ko.md)를 따른다. 원래 누적 표는 [통합 coverage](../guest-network-1569-integrated/coverage.ko.md), [SystemVM 당시63행](../guest-network-1569-systemvm-20261111/coverage.ko.md)에 보존한다.
