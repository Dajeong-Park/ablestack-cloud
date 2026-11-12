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

# 실제 재현·재생성·통신 검증

## 수정 전과 수정 후

31 수정 전 `1e:1f:43:00:00:30` → `1e:1f:b7:00:00:30`,32 수정 전 `1e:01:f3:00:00:07` → `1e:01:b8:00:00:07`. 두 사이트 모두 같은 Source NAT IP와 true인데 MAC이 바뀌었다. [31](evidence/31-before-fix-reproduction.json) · [32](evidence/32-before-fix-reproduction.json).

아래는 각각 실제 새 router UUID·job 성공·API/DB·VR ip -j addr·libvirt NIC를 대조한 결과다. true에서 같은 MAC 유지, false에서 다른 MAC 사용을 검사했다. 실패 입력은 실제 비동기431/job2이고 기존 VR/MAC은 유지됐다. 다음 정상 작업이 성공해 복구를 확인했다.

| 사이트 | 조건 | 실제 VR 교체 | Public MAC | 판정 |
| --- | --- | --- | --- | --- |
| 31 | post-fix-domain-ui | r-1033-VM → r-1034-VM | 1e:1f:b7:00:00:30 → 1e:1f:b7:00:00:30 | 유지 |
| 31 | offering-true | r-1034-VM → r-1035-VM | 1e:1f:b7:00:00:30 → 1e:1f:b7:00:00:30 | 유지 |
| 31 | cleanup-true | r-1035-VM → r-1036-VM | 1e:1f:b7:00:00:30 → 1e:1f:b7:00:00:30 | 유지 |
| 31 | false-domain | r-1036-VM → r-1037-VM | 1e:1f:b7:00:00:30 → 1e:1f:7a:00:00:30 | 새 MAC |
| 31 | false-cleanup | r-1037-VM → r-1038-VM | 1e:1f:7a:00:00:30 → 1e:1f:11:00:00:30 | 새 MAC |
| 31 | true-again | r-1038-VM → r-1039-VM | 1e:1f:11:00:00:30 → 1e:1f:11:00:00:30 | 유지 |
| 31 | offering-restored | r-1039-VM → r-1040-VM | 1e:1f:11:00:00:30 → 1e:1f:11:00:00:30 | 유지 |
| 31 | false-offering | r-1040-VM → r-1041-VM | 1e:1f:11:00:00:30 → 1e:1f:1b:00:00:30 | 새 MAC |
| 31 | true-offering-retry | r-1041-VM → r-1042-VM | 1e:1f:1b:00:00:30 → 1e:1f:1b:00:00:30 | 유지 |
| 32 | post-fix-domain-ui | r-509-VM → r-510-VM | 1e:01:b8:00:00:07 → 1e:01:b8:00:00:07 | 유지 |
| 32 | offering-true | r-510-VM → r-511-VM | 1e:01:b8:00:00:07 → 1e:01:b8:00:00:07 | 유지 |
| 32 | cleanup-true | r-511-VM → r-512-VM | 1e:01:b8:00:00:07 → 1e:01:b8:00:00:07 | 유지 |
| 32 | false-domain | r-512-VM → r-513-VM | 1e:01:b8:00:00:07 → 1e:01:54:00:00:07 | 새 MAC |
| 32 | false-cleanup | r-513-VM → r-514-VM | 1e:01:54:00:00:07 → 1e:01:0f:00:00:07 | 새 MAC |
| 32 | true-again | r-514-VM → r-516-VM | 1e:01:0f:00:00:07 → 1e:01:0f:00:00:07 | 유지 |
| 32 | offering-restored | r-516-VM → r-517-VM | 1e:01:0f:00:00:07 → 1e:01:0f:00:00:07 | 유지 |
| 32 | false-offering | r-517-VM → r-518-VM | 1e:01:0f:00:00:07 → 1e:01:41:00:00:07 | 새 MAC |
| 32 | true-offering-retry | r-518-VM → r-519-VM | 1e:01:41:00:00:07 → 1e:01:41:00:00:07 | 유지 |

UI 수정 job은31 `d541815c-7185-44e5-81ee-d527d89852bb`,32 `88c0c532-0f8d-47c5-93f8-e1c0943627b9`, 각각 job1/result0이다. [31 UI/runtime](evidence/31-post-fix-domain-ui.json) · [32](evidence/32-post-fix-domain-ui.json). 최종 전체 job 목록은 [31](evidence/31-recreation-jobs.json)·[32](evidence/32-recreation-jobs.json)에 보관했다.

## 최종 실제 통신과 기존 NIC 영향

VM25와 해당 VR을31-3/32-2의 같은 호스트에 배치한 뒤 검사했다. 자동 배치가 다른 호스트를 선택하면 API migrateSystemVm의 실제 성공 후 같은 호스트임을 확인했다. guest VLAN의 스위치 설정을 바꾸지 않았다. MAC 보존 판정은 마이그레이션 전후 API·실제 VR/NIC가 일치한다는 근거이며 외부 VLAN trunk 검증은 아니다.

- VM25의10.250.x.10에서 실제 broadcast DHCP DISCOVER/OFFER/REQUEST/ACK와 server MAC을 향한 unicast 갱신 ACK, mask255.255.255.0을 확인했다.32의 guest 할당 CIDR/25와 실제 network CIDR/24의 기존 구분을 보존했다.
- 최종 VM 이름의 DNS A 조회는 VR로 UDP12/12·TCP12/12, ICMP10/10이다. [31 DHCP/DNS](evidence/31-actual-dhcp-final.json) · [32](evidence/32-actual-dhcp-final.json).
- 시험 guest source10.250.x.10에서 같은 host의 관리 IP로 ICMP5회 송수신하고 Public bridge 수신측 tcpdump의 Source NAT IP와 Ethernet source MAC을 확인했다. host 수신 패킷의 실제 MAC이 API/VR/libvirt와 같다. 시험 목적의 source/destination 한정 policy rule/table1631은 finally로 제거했고 VM main route/rule을 보존했다. [31 SNAT](evidence/31-actual-source-nat.json) · [32](evidence/32-actual-source-nat.json).
- 기존 Shared NIC source10.247.x.110→peer.58의 ICMP·SSH 및 Shared router DNS UDP/TCP를 수정 전부터 감시했다. 사이트당1454표본×4항목 실패0이다. 재생성 대상 Isolated VR의 planned 중단을 DNS 무중단으로 표현하지 않는다. 연속성 수치는 별도의 기존 Shared NIC 경로다. [31](evidence/31-communication-summary.json) · [32](evidence/32-communication-summary.json).

원래21 VM/63 API NIC의 ID/주소/MAC/기본 NIC·VM host/state, 프로젝트 구성원을 보존했다. VM25의 실제 Reserved NIC는31 5개/32 6개로 각각 libvirt와 정확히 같다. 논리 API 전체 NIC 수와 VM25 실제 NIC 수를 혼동하지 않는다. guest21/22/25 main route 보존과 계측 정리를 확인했다.

## 배포·빌드·UI·한계

WSL ext4 changed Maven api/server package,53 tests·Checkstyle0 위반. [로컬 결과](evidence/final-static-and-tests.json). UI 소스 변경0이고 정적675파일씩/WEB-INF/HTTP200 검증을 통과했다. 활성 JAR SHA와 payload entry가 구현 commit과 일치한다. [31 배포](evidence/31-backend-deployment.json) · [32](evidence/32-backend-deployment.json) · [Spring XML diff](evidence/spring-context-diff.json).32는 가용 디스크 여유가128MiB 안전 여유 기준보다 약2MiB 부족해 반영 전 차단됐고, 전체 원본 JAR의 WSL 백업을 확인한 상태에서96MiB 여유 기준을 적용했다. 정상 반영 후 임시 hardlink만 제거했다.

양쪽 관리자 UI에서 실제 도메인 변경·프로젝트 왕복·12반응형/테마 조합·즉시4테마 전환을 완료했다. 추가 readOnly UI 촬영 중 브라우저 URL 확인이 불확실해 제어가 종료됐다. 이 미완료 촬영을 결과/역할 캡처로 집계하지 않는다. API readOnly 쓰기 거부·owner/member/readOnly 조회는 양쪽 성공이다. 일반 역할의 숨긴 테마 메뉴를 노출하거나 보안 정책을 완화하지 않았다.

이중화 election/failover·VPC 추가 Public NIC 전체·외부 trunk·인터넷 성능·LB 백엔드 부하분산을 검증했다고 주장하지 않는다. #1631 단일 VR 결함과 보호 경계는 완료하며 #1569의 조건부·역할 전체 UI 통합은 OPEN이다.
