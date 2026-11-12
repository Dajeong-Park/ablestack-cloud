# #1569 Shared 사용량·재시작·공유 철회 통합 회귀

2026-11-09 KST에 31(GFS2)·32(RBD)에서 각각 독립적인 Account Shared 네트워크, 공유 대상 프로젝트, 가상 라우터 및 시험 VM 2대로 검증했다. Root Admin은 네트워크를 변경했고, 프로젝트 멤버는 VM 화면과 API에서 NIC 연결을 검증했다. VLAN 스위치 조건을 피하려고 전용 VM만 각 라우터와 같은 호스트에 배치했다. 검증 결과 및 증거만 반영한다.

| 검증 | 31 | 32 |
| --- | --- | --- |
| 사용량 제외와 복원 | UI `포함 → 제외 → 포함`, API/DB 일치 | UI `포함 → 제외 → 포함`, API/DB 일치 |
| 일반 네트워크 재시작 | UI 완료, API `jobstatus=1`, VR·기존 NIC 유지, 재시작 구간 ICMP 32/32 | UI 완료, API `jobstatus=1`, VR·기존 NIC 유지, 재시작 구간 ICMP 32/32 |
| 재시작 후 라우터 DNS | 연결 거부, dnsmasq SIGSEGV, 서비스 재기동 후 복구 | 연결 거부, dnsmasq SIGSEGV, 서비스 재기동 후 복구 |
| 사용 중 프로젝트 공유 철회 | 기존 NIC/IP/MAC·ICMP·DNS·라우터→VM TCP 유지, 신규 연결 UI/API 거부 | 기존 NIC/IP/MAC·ICMP·DNS·라우터→VM TCP 유지, 신규 연결 UI/API 거부 |
| 재부여 및 실제 신규 연결 | 멤버 UI에서 연결, DHCP `10.247.31.57`, 양방향 ICMP·TCP 및 양 VM DNS 응답 | 멤버 UI에서 연결, DHCP `10.247.32.57`, 양방향 ICMP·TCP 및 양 VM DNS 응답 |

## 사용량

`네트워크 업데이트`의 `IP 사용량 내보내기 제외`를 켜고, 상세 화면과 `listNetworks`의 `details.hideIpAddressUsage`를 대조했다. 기존 할당 `.58`의 `NET.IPASSIGN` 이벤트는 `hidden=false`로 남았고, 제외 상태에서 UI로 연결한 `.57`의 신규 할당 이벤트만 `hidden=true`였다. 시험 후 설정을 `포함`으로 되돌려도 두 이벤트의 값은 유지됐다. 복원 작업에서 양쪽 UI가 한때 결과 미확인과 중복 요청 금지 안내를 표시했다. 재제출 없이 성공 표시와 최종 API 값을 확인했다. 사용량 일괄 집계는 이번에 실행하지 않았다. 이전 내보내기 검증은 [#1564](../guest-network-1564-20261104/README.ko.md)에 있다.

## 재시작 및 데이터 경로

`Cleanup`·라우터 이중화·Live Patch를 선택하지 않고 UI에서 일반 재시작을 실행했다. Job ID는 31번 `c9415a1a-3318-46a5-bbe7-7b904c249d19`, 32번 `93902a31-517e-47fd-80b6-b2aca757fd21`이다. `queryAsyncJobResult` 성공 후에도 VR ID·호스트와 기존 NIC의 ID·IP·MAC·기본 NIC 상태가 동일했다. 브라우저의 POST 시점을 포함하는 약 31초 구간에 VM21의 Shared 소스 주소로 보낸 1초 간격 라우터 ping은 양쪽 모두 32/32였다.

첫 사후 검사에서 양쪽 모두 라우터 DNS 질의가 `ConnectionRefusedError (111)`로 실패했다. 같은 검사에서 ICMP와 라우터→VM TCP 22는 응답했다. 31번 라우터는 05:38:14 UTC에, 32번은 05:38:15 UTC에 dnsmasq reload 직후 `status=11/SEGV`를 기록했다. 05:39:06과 05:39:07 UTC에 각각 dnsmasq가 시작됐고, 재질의에서 시험 VM의 이름이 기존 IP로 해석됐다. 프로세스 종료부터 재기동까지 로그상 약 52초이며, DNS 중단의 정확한 지속 시간과 충돌 원인은 추가 확인이 필요하다. 따라서 S09는 양쪽 **실패**다. 재시작 중 신규 DHCP 임대·갱신은 별도로 측정하지 않았다. [31번 라우터 로그](evidence/31-router-dns-after-restart.json) · [32번 라우터 로그](evidence/32-router-dns-after-restart.json).

## 철회와 재부여

`네트워크 권한` 탭에서 시험 프로젝트의 단일 공유 권한을 철회했다. `listNetworkPermissions`는 0건, 실제 프로젝트 멤버의 `listNetworks(canusefordeploy=true)`에서 대상이 사라졌다. 같은 멤버의 `addNicToVirtualMachine`은 `530 permission denied`였고 VM22의 NIC는 변하지 않았다. UI에서도 `연결 가능한 네트워크가 없습니다`를 표시하고 제출을 비활성화했다. VM21의 기존 Shared NIC는 활성화 상태와 이름을 유지했고 네트워크 상세 링크는 숨겨졌다. 실제 라우터 ping 3/3, DNS 자기 이름 응답, 라우터→VM TCP 22로 기존 통신을 확인했다.

같은 프로젝트 권한만 API로 복구했다. VM22의 VM NIC 대화상자에 같은 Shared 망이 다시 나타났고, 멤버가 UI에서 연결했다. 기존 기본 NIC를 유지하면서 새 Shared NIC가 활성화되고 상세 링크가 복구됐다. VM22가 DHCP로 `.57`을 받았다. VM21과 VM22는 Shared 주소로 서로에게 ICMP 3/3과 TCP 22를 받았고 각각 라우터 DNS에서 자신의 주소를 확인했다. 이 경로는 통과했고 사용 중 삭제, 다른 공유 범위·역할 조합을 남겨 S10은 **부분**이다. 철회 확인창에는 양쪽 모두 번역 키 `message.confirm.remove.network.permission`이 노출됐다.

## VM UI 표준과 캡처

`컴퓨트 > 가상머신` 목록 → 상세 → NIC 탭과 breadcrumb, 그리고 기존 네트워크 연결의 공통 `MoldDialog`를 기준으로 확인했다. Shared 업데이트 대화상자는 390×844, 768×1024, 1280×900 각각 라이트·다크에서 양쪽 12조합을 실측했다. 세로 입력 배치, 헤더·푸터, 제외 상태 레이블 및 배경을 확인했고 페이지 가로 넘침이 없었다. 실제 NIC 차단과 허용 대화상자는 31번 데스크톱 라이트와 32번 모바일 다크에서 확인했다. 프로젝트 → 기본 보기 전환 직후 헤더는 새 범위를 표시했고, 라우트는 잠시 기존 상세를 기록한 뒤 대시보드로 이동했다. 시험 프로젝트에 재진입해 두 VM 목록과 VM22의 NIC를 다시 열었다. [화면 검증](evidence/ui-results.json) · [레이아웃 실측](evidence/ui-layouts.json) · [캡처 크기 및 해시](evidence/ui-captures.json).

| 화면 | 31 | 32 |
| --- | --- | --- |
| IP 사용량 제외 | [데스크톱 라이트](screenshots/31-usage-excluded-1280-light.jpg) | [모바일 다크](screenshots/32-usage-excluded-390-dark.jpg) |
| 일반 재시작 완료 | [데스크톱 라이트](screenshots/31-restart-done-1280-light.jpg) | [모바일 라이트](screenshots/32-restart-done-390-light.jpg) |
| 공유 철회 확인 |  | [모바일 다크와 번역 키](screenshots/32-project-revoke-390-dark.jpg) |
| 철회 후 신규 NIC 차단 | [데스크톱 라이트](screenshots/31-new-nic-denied-1280-light.jpg) | [모바일 다크](screenshots/32-new-nic-denied-390-dark.jpg) |
| 재부여 후 후보 선택 | [데스크톱 라이트](screenshots/31-new-nic-allowed-1280-light.jpg) | [모바일 다크](screenshots/32-new-nic-allowed-390-dark.jpg) |
| 연결 작업 완료 | [데스크톱 라이트](screenshots/31-new-nic-attached-1280-light.jpg) | [모바일 다크](screenshots/32-new-nic-attached-390-dark.jpg) |
| 프로젝트 복귀 후 VM 상세 | [태블릿 라이트](screenshots/31-project-return-768-light.jpg) | [모바일 다크](screenshots/32-project-return-390-dark.jpg) |

## 확인용 자원과 후속 순서

| 클러스터 | Shared 네트워크 및 동명 프로젝트 | 호스트·라우터 | 보관 VM |
| --- | --- | --- | --- |
| 31 | [qa-gn1569-31-shared-reg](http://10.10.31.10:8080/client/#/guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=network.permissions) VLAN 2790 | ablecube31-3 · r-978-VM | VM21 `10.247.31.58`, VM22 `10.247.31.57` |
| 32 | [qa-gn1569-32-shared-reg](http://10.10.32.10:8080/client/#/guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=network.permissions) VLAN 2791 | ablecube32-2 · r-453-VM | VM21 `10.247.32.58`, VM22 `10.247.32.57` |

Shared 망·라우터·프로젝트 권한·VM·제어용 L2를 남겼다. 사용량은 초기 `포함`으로 복원했고, 임시 호스트 측 제어망 IP만 제거했다. [31번 최종 API·DB](evidence/31-phase-final.json) · [32번 최종 API·DB](evidence/32-phase-final.json).

1. dnsmasq reload 충돌 원인을 좁히고, Shared 일반 재시작 후 DHCP 신규 임대·갱신, DNS 연속성, 기존 NIC의 ICMP·TCP를 양쪽에서 다시 검증한다.
2. 철회 확인창 번역을 수정하고, 사용 중 Shared 망 삭제 거부와 도메인·계정·프로젝트의 다른 공유 범위 경로를 검증한다.
3. VPC Tier·VPC 삭제 시 서비스 영향과 ConfigDrive의 남은 게스트 실행 경로를 검증한다.
4. VPN·LB 조건부 UI·API, 호스트 간 PVLAN, IPv6·BGP·DNS 경로는 조건을 갖춘 뒤 진행한다. LB 백엔드 분산 측정은 기존 범위에서 제외한다.

[통합 검증표](../guest-network-1569-integrated/coverage.ko.md) · [Epic #1554](https://github.com/ablecloud-team/ablestack-cloud/issues/1554) · [회귀 #1569](https://github.com/ablecloud-team/ablestack-cloud/issues/1569) · [Draft PR #1577](https://github.com/ablecloud-team/ablestack-cloud/pull/1577)
