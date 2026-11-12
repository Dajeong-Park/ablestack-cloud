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

# #1569 서비스 연결 VPC 삭제 영향·Shared 잔여 범위/역할 검증

2026-11-09, 31 GFS2·32 Glue RBD. Epic #1554 / 브랜치 `dhslove/epic-1554-guest-networks` / Draft PR #1577을 유지한다. **VPC 삭제 영향과 Shared API·실제 통신 검증은 완료했으며, 역할 UI·반응형 회귀는 일부 미완료다. #1569는 Open이다.**

이번에는 제품 코드를 변경하거나 새 UI/JAR을 배포하지 않았다. 기존 #1605 배포본에서 새 전용 자원을 사용한 기능 검증이다. `/client/` HTTP 200과 WEB-INF 존재를 양쪽에서 다시 확인했다. 전체 Cloud 빌드나 수동 Actions 빌드를 실행하지 않았다. 이전 작업의 단위 검사·반응형 성공을 이번 신규 자원의 실행 성공으로 합산하지 않는다.

[원본 캡처와 제한](capture-matrix.ko.md) · [확인용 자원](resources.ko.md) · [검사 요약](evidence/summary.json) · [누적 통합 검증표](../guest-network-1569-integrated/coverage.ko.md)

## 서비스가 연결된 VPC

각 클러스터의 기존 Shared 시험 프로젝트에 새 VPC/Tier·전용 ACL·태그를 만들고, 실행 중 VM24에 **세 번째 NIC**만 연결했다. DHCP로 주소를 받은 뒤 VPC 자체 DNS의 UDP/TCP A 응답과 Public IP의 TCP 18269→VM24:22 포워딩에서 SSH 배너를 확인했다. 원래 제어용 L2·Shared 기본/보조 NIC는 보존했다.

스위치에 시험 VLAN 트렁크가 없으므로 VirtualRouter를 VM과 같은 호스트로 API 이주했다(31 ablecube31-3, 32 ablecube32-2). 게스트 소켓은 실제 VPC/Shared IP에 바인딩했고 SSH 제어용 L2 통신을 서비스 검증으로 계산하지 않았다. QGA exec/file 보안 정책은 변경하지 않았다.

| 절차 | 31 / 32 결과 |
| --- | --- |
| Tier/VM/PF/ACL/태그가 있는 VPC를 UI에서 삭제 | async job 실패 431. VPC·Tier·태그·ACL·PF와 기존 NIC 유지, 이후 VPC/Shared DNS와 PF SSH 응답 정상 |
| 실행 중 NIC가 있는 Tier를 API 삭제 | job 실패. 해당 VM/NIC를 먼저 분리하라는 진단, 서비스 보존 |
| PF가 연결된 비기본 NIC를 API 분리 | 연결 규칙 때문에 거부. PF/DNS·Shared 기존 통신 유지 |
| PF 삭제→그 NIC 분리→Tier 삭제 | 성공. VM24 Running 및 원래 NIC 두 개의 ID/IP/기본 여부 일치 |
| Tier 0개, VR Running·Public IP·ACL·태그가 남은 VPC를 UI 삭제 | 31 job `1aaccec3-ca27-404b-86bc-2577530ddc49`, 32 `bbcd1682-cb2d-4d72-9d3b-ea05b3962ba2`, 양쪽 jobstatus=1/success=true |
| 삭제 후 API·호스트 확인 | VPC/Tier/라우터/IP 연결/ACL/규칙/태그 없음. 호스트 `virsh dominfo`에서 해당 라우터 없음. 추가 Public IP는 Free/hasrules=false로 반환 |
| 삭제 전후 기존 Shared VM24→VM21 | 각 90개 표본 전부 UDP/TCP DNS, ICMP, TCP22 SSH 배너 정상 |

90개 표본은 UI 삭제 job 생성·완료 시각을 포함한다. [31 표본](evidence/31-shared-during-vpc-delete.json) · [32 표본](evidence/32-shared-during-vpc-delete.json). DB job 시각은 UTC이고 표본 time은 Unix epoch다. 31 삭제 10:31:50–10:31:54 UTC, 32 10:31:57–10:32:03 UTC다. 순간 단절이 절대 없음을 보장하는 연속 패킷 캡처가 아니라 약 1초 간격 표본 결과다.

[31 거부 후 API](evidence/31-service-after-ui-reject-api.json) · [32 거부 후](evidence/32-service-after-ui-reject-api.json) · [31 의존성 정리](evidence/31-service-dependency-cleanup.json) · [32 의존성 정리](evidence/32-service-dependency-cleanup.json) · [31 최종 API/DB job](evidence/31-final-state.json) · [32 최종 API/DB job](evidence/32-final-state.json) · [31 Free IP](evidence/31-service-deleted-ip-pool.json) · [32 Free IP](evidence/32-service-deleted-ip-pool.json).

VPC의 정상 삭제는 의존성을 해소한 뒤 성공한 사례이며, 연결된 VM/Tier를 강제 연쇄 삭제한 성공 사례가 아니다. PF를 먼저 명시적으로 삭제했으므로 VPC 삭제가 PF를 자동 삭제했다고 주장하지 않는다. VPN/LB가 연결된 삭제 영향과 라우터 볼륨의 물리 GC 전 과정은 이번 범위에서 검증하지 않았다.

브라우저의 성공 요청 원문은 수집 커서 오류/이벤트 만료로 확보하지 못했다. UI 조작·전후 캡처, 같은 시각의 DB DeleteVPCCmd와 queryAsyncJobResult, 실제 API/호스트 삭제 상태를 연결했다. 빈 성공 UI/API 증적 파일은 성공 근거로 사용하지 않는다. 32 Shared reset은 별도 브라우저 HTTP 200/success=true 응답을 확보했다.

## Shared 범위·역할

기존 시험망을 바꾸지 않고 각 클러스터에 **all / domain-only / domain+subdomains / account** 네 망을 만들었다. account 망은 같은 기존 시험 프로젝트에 공유했다. 기존 프로젝트 멤버 VM22와 새 프로젝트 관리자 VM23에 각각 네 NIC를 연결해 총 16개의 새 Shared NIC를 추가했다. 게스트 NetworkManager의 DHCP 실제 주소/옵션을 API NIC와 대조했다. 기존 기본 경로는 유지했다.

| 호출 주체 | all | domain-only | subdomains | account + 프로젝트 공유 |
| --- | --- | --- | --- | --- |
| Root | 허용 | 허용 | 허용 | 허용 |
| 계정 소유자 | 허용 | 허용 | 허용 | 허용 |
| 같은 도메인 peer 개인 범위 | 허용 | 허용 | 허용 | 거부 |
| 하위 도메인 사용자 | 허용 | 거부 | 허용 | 거부 |
| 외부 도메인 사용자 | 허용 | 거부 | 거부 | 거부 |
| DomainAdmin | 허용 | 허용 | 허용 | 허용 |
| 프로젝트 일반 멤버 / 관리자 / 읽기 전용 | 허용 | 허용 | 허용 | 허용 |

위 표는 **조회·canusefordeploy 후보** 결과다. 양쪽 9주체×4범위×2조회=144개 API 결과가 일치했다. 읽기 전용 후보 표시가 쓰기 허용을 뜻하지 않는다. [31 행렬](evidence/31-scope-role-matrix.json) · [32 행렬](evidence/32-scope-role-matrix.json).

- 프로젝트 일반 멤버·관리자는 각각 네 범위 NIC 연결에 성공했다. 읽기 전용 역할의 유효 VM21 연결 요청은 API 명령 권한 단계에서 401로 거부됐다.
- 개인 소유자는 자기 account 망 NIC, 하위 도메인은 subdomains 망 NIC 연결에 성공했다. 하위 도메인의 domain-only 및 외부 사용자의 domain/subdomains/account 연결은 거부됐다. 이 개인 시험 VM의 새 NIC는 API 상태까지 확인했으며 게스트 내부 패킷 검증으로 합산하지 않는다.
- specifyvlan=true Shared 수정은 Root만 허용됐다. 소유자·DomainAdmin·peer·하위/외부·프로젝트 멤버/관리자는 531, 읽기 전용은 401이다. 소유자의 권한 부여/회수/복원도 531로 거부됐고 Root로 실행했다. 이 기존 관리자 정책을 완화하지 않았다.
- 새 account 망에 peer 계정을 부여하면 peer 후보가 나타났고, 회수하면 사라졌다. 프로젝트 공유는 유지됐다.
- **양쪽 UI에서 네트워크 권한 재설정**을 실행해 0건을 확인했다. 이후 프로젝트 일반/관리/읽기 전용 모두 신규 후보에서 제외됐고, 유효 VM21의 새 NIC 연결 API가 거부됐다. 기존 VM22/23의 Running·여섯 NIC는 유지됐다.
- all/domain/subdomains/account 네 망 모두 부여 전·peer 부여 후·peer 회수 후·UI 초기화 후·프로젝트 복원 후의 5단계에서 UDP/TCP DNS, 두 VM 간 ICMP와 SSH 응답이 정상이다. 최종 프로젝트 공유 **1건만 복원**했고 peer 공유는 남기지 않았다.

[31 역할 쓰기](evidence/31-scope-write-matrix.json) · [32 쓰기](evidence/32-scope-write-matrix.json) · [31 DHCP](evidence/31-scope-dhcp.json) · [32 DHCP](evidence/32-scope-dhcp.json) · [31 초기화 영향](evidence/31-scope-after-ui-reset.json) · [32 초기화 영향](evidence/32-scope-after-ui-reset.json) · [31 복원·통신](evidence/31-scope-traffic-after-restore.json) · [32 복원·통신](evidence/32-scope-traffic-after-restore.json).

## UI 표준과 미완료 범위

**새 UI 변경은 없다.** VM 메뉴와 같은 공통 breadcrumb·상세 요약/탭·아이콘+텍스트 업데이트·MoldDialog 확인/취소 구조를 대조했다. 31 소유자 개인 목록은 네 범위, child는 all/subdomains, 외부는 all, peer는 all/domain/subdomains를 표시했다. DomainAdmin 목록도 API 접근 정책과 일치했다. 31 프로젝트 전환은 대시보드로 이동한 뒤 목록으로 진입했고, 공유 초기화 후 VM 기존 네트워크 연결창에 account 망이 빠진 세 후보만 나타났다.

32에서는 관리자 다크모드의 VPC 확인창, Shared 권한 탭·초기화창·빈 목록을 확인했다. 캡처 26개는 실제 viewport와 JPEG 디코딩 치수가 모두 일치한다. 데스크톱에서 페이지 가로 넘침은 없었으나 전체 탭/색상 대비를 정량 전수 검사한 결과는 아니다.

역할 전환 도중 제어 연결이 끊겼고, 최종적으로 Computer Use가 **Windows에서 현재 브라우저 URL을 충분히 확인할 수 없어 이번 턴의 제어를 중단**했다. 이후 UI 제어를 재시도하지 않았다. 31 프로젝트 관리자·읽기 전용 UI, 32 비관리자 범위 UI, 양쪽 신규 자원의 모바일/태블릿·라이트↔다크 즉시 전환·프로젝트 왕복은 남았다. 기존 #1605의 31/32 검증을 이번 새 자원에서 재실행한 것으로 표시하지 않는다. 31은 역할 로그인 화면에서 멈췄으므로 확인 시 기존 관리자 계정으로 다시 로그인해야 한다.

## 보존·후속 순서

소모성 svc-delete VPC만 위 검증 절차로 삭제했다. 각 클러스터에 새 **svc-review VPC/Tier·ACL·PF·VM24 NIC**를 다시 구성해 DHCP/DNS/PF SSH를 확인하고 유지했다. 네 Shared 망, VM22/23 NIC, 개인 역할 VM 3대, 시험 계정/읽기 전용 프로젝트 역할과 원래 실패 확인용 VPC/Shared 자원도 유지했다. 임시 호스트 SSH 프로브 172.26.31.254/172.26.32.254만 제거했다. 주 FT 작업의 추적 변경 해시는 시작 시점과 동일하다.

1. 브라우저 제어 복구 후 **31/32 남은 역할 UI·32 비관리자 범위·모바일/태블릿·즉시 테마·프로젝트 왕복**을 먼저 완료한다. 새 svc-review와 Shared 자원을 그대로 사용한다.
2. VPN/LB UI·API와 서비스 연결 삭제/실패 복구, 지원 제공자의 Health Monitor·AutoScale 조건을 진행한다. 사용자 지시에 따라 LB 백엔드 부하분산 측정은 제외한다.
3. 스위치/제공자 준비 후 호스트 간 PVLAN·Shared PVLAN 라우터, IPv6·BGP·외부 DNS 등 조건부 항목을 실행한다. 미구성 환경을 성공으로 표시하지 않는다.

종합 #1569와 Epic은 닫지 않는다. 누적 63행은 부분 52·미실행 2·환경 차단 6·적용 제외 3을 각 클러스터에 유지한다. C06의 이전 #1605 실패는 해당 수정/검증 근거로 부분으로 갱신하며, 이번 신규 역할 UI 미완료는 부분 범위로 명시한다.
