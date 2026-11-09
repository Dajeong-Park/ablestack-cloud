# #1569 Shared 재시작 후 dnsmasq 충돌 수정

2026-11-09 KST에 31(GFS2)·32(RBD) 시험 Shared 네트워크의 라우터를 수정하고 실제 Mold UI 재시작을 각각 두 번 검증했다. 테스트 VM은 모두 해당 라우터와 같은 호스트에 두었다.

## 원인과 수정

두 라우터 모두 Debian 12의 `dnsmasq-base 2.90-4~deb12u2`를 실행 중이었다. 당시 Mold 라우터 로그에는 기존 구성에 변경이 없는 상태에서 `systemctl reload dnsmasq`를 실행한 기록이 있고, 커널·서비스 로그에는 직후 SIGSEGV가 있다. `dhcp-hostsfile`은 MAC별 `set:` 태그를 사용했고, 앞서 실제 DHCP 요청을 처리했다.

Debian #1090352는 DHCP 처리 중 임시로 이어 붙인 태그 목록을 재로딩 때 소유 목록으로 해제해 잘못된 포인터를 따라가는 결함이다. 각 라우터 내부의 독립 네트워크 네임스페이스에서 동일한 태그 설정과 DHCP 요청을 만든 뒤 `SIGHUP`을 보냈다. 원본 패키지는 양쪽 모두 종료 코드 139를 반환했고, 해당 해제 경로만 수정한 패키지는 같은 조건에서 계속 실행되며 다음 DHCP 요청에 응답했다. [Debian #1090352](https://bugs.debian.org/1090352) · [upstream 수정 f006be7](https://github.com/pi-hole/dnsmasq/commit/f006be7842104a9f86fbf419326b7aad08ade61d) · [31번 재현](evidence/31-isolated-ab.json) · [32번 재현](evidence/32-isolated-ab.json).

SystemVM 템플릿의 패키지 설치 단계에 백포트를 반영했다. Debian 저장소의 설치 버전과 같은 소스를 내려받아 기존 보안 패치를 유지한 채 `dnsmasq-base`를 빌드하고, Debian에서 수정이 포함된 버전은 그대로 사용한다. WSL ext4의 Debian 12 환경에서 설치 함수를 실행해 amd64 패키지를 빌드·설치했고 두 번째 실행의 멱등성도 확인했다. 동일한 `2.90-4~deb12u2+ablestack1` 패키지를 두 시험 라우터에 설치했고, 실제 프로세스의 바이너리 해시와 53·67번 리스너를 확인했다. [31번 적용](evidence/31-deployed.json) · [32번 적용](evidence/32-deployed.json).

## 31·32번 실환경 검증

| 항목 | 31 GFS2 | 32 RBD |
| --- | --- | --- |
| 일반 재시작 | UI 완료 2/2, API `jobstatus=1` 2/2 | UI 완료 2/2, API `jobstatus=1` 2/2 |
| dnsmasq | PID 23961 유지, SIGHUP 재로딩 2회, 커널 충돌 0 | PID 23701 유지, SIGHUP 재로딩 2회, 커널 충돌 0 |
| DNS | UDP 560/560, TCP 560/560 | UDP 560/560, TCP 560/560 |
| 기존 NIC 통신 | VM21→VM22 ICMP 140/140·TCP/22 140/140, 역방향도 사후 확인 | VM21→VM22 ICMP 140/140·TCP/22 140/140, 역방향도 사후 확인 |
| 기존 임대 갱신 | VM21 `10.247.31.58`의 유니캐스트 DHCPREQUEST → 동일 IP DHCPACK | VM21 `10.247.32.58`의 유니캐스트 DHCPREQUEST → 동일 IP DHCPACK |
| 신규 임대 | VM23의 새 Shared NIC가 DORA로 `10.247.31.55` 수신, DNS·ICMP·TCP 정상 | VM23의 새 Shared NIC가 DORA로 `10.247.32.55` 수신, DNS·ICMP·TCP 정상 |

첫 재시작 전부터 VM21의 Shared IP에 소켓을 바인딩해 라우터의 UDP·TCP DNS에 약 250ms 간격, 기존 VM22에 ICMP·TCP/22를 약 1초 간격으로 검사했다. 첫 구간 85초와 두 번째 구간 55초에 각각 브라우저 POST, 라우터 SIGHUP, 작업 완료를 포함했다. 관측 구간에서 DNS 오류나 통신 손실은 없었다. UI에서 네트워크 요소 재생성·이중화 전환·Live Patch는 끈 상태였다. [31번 연속 측정](evidence/31-monitor-restart02.json) · [32번 연속 측정](evidence/32-monitor-restart02.json).

첫 재시작 뒤 새 NIC를 API로 연결해 게스트에서 실제 Discover·Offer·Request·ACK를 확인했다. 기존 VM21은 현재 주소를 `ciaddr`로 넣고 라우터로 유니캐스트 갱신을 요청해 같은 주소의 ACK를 받았다. 신규 임대와 갱신을 처리한 상태로 두 번째 UI 재시작을 실행했고, 이후 다시 갱신에 성공했다. 세 VM의 기존 NIC ID·IP·MAC·기본 여부, 라우터 ID·호스트는 해당 재시작 전후 API에서 일치했다. [31번 DHCP](evidence/31-dhcp23.json) · [32번 DHCP](evidence/32-dhcp23.json) · [31번 반복 재로딩](evidence/31-journal-repeat.json) · [32번 반복 재로딩](evidence/32-journal-repeat.json).

| 화면 | 31 | 32 |
| --- | --- | --- |
| 일반 재시작 옵션 | [1280px 라이트](screenshots/31-restart-options-1280-light.jpg) | [390px 다크](screenshots/32-restart-options-390-dark.jpg) |
| 첫 재시작 완료 | [캡처](screenshots/31-restart-complete-1280-light.jpg) | [캡처](screenshots/32-restart-complete-390-dark.jpg) |
| DHCP 처리 후 반복 재시작 완료 | [캡처](screenshots/31-restart-after-dhcp-1280-light.jpg) | [캡처](screenshots/32-restart-after-dhcp-390-dark.jpg) |
| VM23 상세의 NIC 탭 | [캡처](screenshots/31-new-nic-1280-light.jpg) | [캡처](screenshots/32-new-nic-390-dark.jpg) |

## 시험 자원 및 후속 순서

| 클러스터 | 시험망·프로젝트 | 라우터/호스트 | 남긴 Shared NIC |
| --- | --- | --- | --- |
| 31 | [qa-gn1569-31-shared-reg](http://10.10.31.10:8080/client/#/guestnetwork/87601b32-f211-4609-819f-6d0f4810b788) | r-978-VM / ablecube31-3 | VM21 `.58`, VM22 `.57`, [VM23 `.55`](http://10.10.31.10:8080/client/#/vm/390e0a4d-2456-485c-8415-8c6f36b8ffc9?tab=nics) |
| 32 | [qa-gn1569-32-shared-reg](http://10.10.32.10:8080/client/#/guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd) | r-453-VM / ablecube32-2 | VM21 `.58`, VM22 `.57`, [VM23 `.55`](http://10.10.32.10:8080/client/#/vm/c74285b6-8f22-4f4c-a396-a2e262ca41f2?tab=nics) |

시험망·라우터·프로젝트·VM을 보관하고, 게스트 SSH 검증용 임시 호스트 IP만 제거했다. 실행 중인 두 시험 라우터에 패키지를 직접 설치했다. 새 라우터와 재생성 경로에 적용하려면 수정된 SystemVM 템플릿의 빌드·배포가 필요하다.

1. 새 SystemVM 템플릿을 빌드·보급하고 새로 생성한 라우터 및 요소 재생성 경로의 패키지 버전과 통신을 확인한다.
2. Shared 철회 확인창 번역 키를 수정하고 사용 중 삭제 거부, 나머지 공유 범위·역할을 검증한다.
3. VPC Tier·VPC 삭제의 서비스 영향과 남은 ConfigDrive 게스트 실행을 확인한다.
4. 준비된 조건부터 VPN·LB UI/API, 호스트 간 PVLAN, IPv6·BGP·DNS를 검증한다.

[S09·S10 통합 검증표](../guest-network-1569-integrated/coverage.ko.md) · [Epic #1554](https://github.com/ablecloud-team/ablestack-cloud/issues/1554) · [#1569](https://github.com/ablecloud-team/ablestack-cloud/issues/1569) · [Draft PR #1577](https://github.com/ablecloud-team/ablestack-cloud/pull/1577)
