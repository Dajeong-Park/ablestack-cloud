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

# #1569 Shared 재시작 후속 검증

2026-11-09. 31 GFS2·32 Glue RBD에서 새 라우터 이미지 등록·요소 재생성과 일반 재시작을 검증했다. **최종 새 라우터의 일반 재시작 2회씩에서 UDP DNS 540/540·TCP DNS 540/540, 기존 NIC 간 ICMP 135/135·TCP 135/135를 각각 확인했다.** VM24 신규 DORA 임대와 VM21 유니캐스트 임대 갱신도 성공했다. 시험 자원을 유지한다.

이번 수정 이슈는 #1602 VPC 태그 보존, #1603 프로젝트 선택 경합, #1604 Shared 라우터 탭의 소유 문맥이다. **#1605 공통 breadcrumb 동적 폭 결함은 미구현/Open**이며 다음 순서다. 넓은 역할·조건부 회귀가 남아 #1569와 Epic #1554는 Open, PR #1577은 Draft를 유지한다.

[원본 캡처](capture-matrix.ko.md) · [확인 자원](resources.ko.md) · [측정·작업 요약](evidence/summary.json) · [통합 검증표](../guest-network-1569-integrated/coverage.ko.md)

## 새 라우터의 UI·API·실제 통신

| 항목 | 31 | 32 |
| --- | --- | --- |
| 새 템플릿 | SystemVM-gn1569-dnsfix-20261109-KVM-r2, Ready | 동일 이름, Ready |
| 새 라우터 / 최종 시험 호스트 | r-984-VM / ablecube31-3 | r-459-VM / ablecube32-2 |
| 실제 릴리스 / dnsmasq | 4.23.0.0 / 2.90-4~deb12u2+ablestack1 | 동일 |
| 요소 재생성 | UI 실패 항목 재시도, API jobstatus=1 | 동일 |
| 일반 재시작 | UI 2회·API jobstatus=1 2회, PID 2628 유지 | UI 2회·API jobstatus=1 2회, PID 2675 유지 |
| 80초 + 55초 DNS | UDP 320+220, TCP 320+220, 오류 0 | 동일 |
| 기존 VM21→VM22 통신 | ICMP 80+55, TCP/22 80+55, 오류 0 | 동일 |
| 새 VM24 Shared NIC | DORA로 10.247.31.54, DNS·ICMP·SSH 배너 | DORA로 10.247.32.54, DNS·ICMP·SSH 배너 |
| 기존 VM21 갱신 | ciaddr 10.247.31.58, 서버로 유니캐스트 DHCPREQUEST→동일 IP ACK | ciaddr 10.247.32.58, 동일 검증 |

DNS 소켓과 실제 통신은 Shared 주소에 바인딩했다. SSH 제어용 L2 주소로 통신 검증을 대체하지 않았다. 각 일반 재시작 job의 생성·완료 시간이 측정 구간 안에 있는지, 라우터·기존 VM NIC ID/IP/MAC/기본 여부와 dnsmasq PID가 유지되는지 검증했다. DHCP 요청 처리 후 두 번째 재시작을 실행했고 이후에도 갱신 ACK를 받았다. 커널 충돌 0, 서비스 NRestarts=0이다. [31 API](evidence/31-api-after-repeat.json) · [32 API](evidence/32-api-after-repeat.json) · [31 DORA](evidence/31-dhcp24.json) · [32 DORA](evidence/32-dhcp24.json) · [갱신](evidence/32-renew.json).

**요소 재생성과 일반 재시작의 연속성은 구분한다.** 최종 요소 재생성은 새 라우터를 다른 호스트에 자동 배치했다. 스위치 VLAN 트렁크가 없는 환경이라 시험 VM과 같은 호스트로 라우터를 API 이주한 뒤 통신을 검증했다. 재생성·이주가 포함된 관측에서 31 DNS는 UDP/TCP 각각 551/600, 32는 각각 526/589로 일시 중단이 있었고 이후 복구됐다. 기존 VM 간 ICMP·TCP는 31 각각 150/150, 32 각각 148/148이었다. 재생성을 무중단 통과로 계산하지 않는다. [31 배치](evidence/31-new-router-colocation.json) · [32 배치](evidence/32-new-router-colocation.json) · [재생성 관측](evidence/32-monitor-recreate2.json).

## 이미지와 배포 경로

포크 저장소의 Actions 비활성화로 단독 SystemVM workflow_dispatch 요청이 거부됐으며 생성된 CI run은 없다. WSL ext4의 Debian 12 환경에서 공식 Packer 1.9.4/KVM으로 로컬 빌드했다(49분 38초). ISO SHA-512를 원본 정의와 대조했고 빌드 자원은 로컬 2 vCPU/2GiB로 조정했다. 전체 Cloud 빌드나 qemu 패키지 빌드는 실행하지 않았다.

첫 등록은 체크섬 표기를 잘못 입력해 거부됐다. 재등록한 첫 이미지에서는 빌드 번호까지 합쳐진 `4.23.0.0.1569.20261109`가 버전 파싱 오류를 일으켰다. Zone 설정을 되돌리고 시험 라우터를 복구했다. 빌더에서 제품 버전과 파일명용 빌드 번호를 분리하고, 잘못된 버전을 거부하는 검사와 회귀 검사를 추가했다. 원본 이미지는 해시로 보존하고, 오프라인 파생 이미지에서 `/etc/cloudstack-release`를 `4.23.0.0`으로 수정했다. 최종 새 라우터에는 수동 버전 편집이나 패키지 설치를 하지 않았다. 초기 실패·수동 복구는 최종 통과에 합산하지 않는다.

최종 이미지는 qemu-img check, bzip2 무결성·복원 해시, GuestFS 읽기 전용 파일 검사, 제품 버전·패키지 버전·ELF 검사를 통과했다. WSL에 NBD 커널 모듈이 없어 원본 NBD 마운트 대신 GuestFS 마운트에서 같은 파일 검사를 실행했다. 이미지와 실행 중 프로세스의 dnsmasq 바이너리 SHA-256은 `74ccbca89162f04d8615484173283f62b29824671120bd2d2579bf0e36e4b9cc`로 일치한다.

| 산출물 | SHA-256 |
| --- | --- |
| 최종 qcow2 | cba5b9143d1632ce59c655147b8ed138ef17d0016d0c98a9fac0015e98073a99 |
| 최종 qcow2.bz2 | 37baae28358751b2eb6b08a444412dabffaae1dd601c5616de487dcaab2c2312 |

두 Zone의 `router.template.kvm`은 최종 Ready ROUTING 템플릿으로 설정했다. 기존 SYSTEM 템플릿·SSVM·CPVM을 교체하거나 다른 실행 중 라우터를 일괄 재생성하지 않았다. 31번은 보조 스토리지 90% 임계치로 추가 등록이 막혀 이번 시험의 잘못된 템플릿만 API로 정리해 등록했다. 기존 운영 템플릿은 삭제하지 않았다. 향후 추가 템플릿 등록 전 보조 스토리지 여유를 확인해야 한다.

[이미지 검사](evidence/image-validation.log) · [메타데이터 수정 이력](evidence/image-metadata-correction.log) · [31 실제 실행 파일](evidence/31-image-runtime-proof.json) · [32 실제 실행 파일](evidence/32-image-runtime-proof.json) · [31 최종 정적/JAR 검사](evidence/31-deployment-final.json) · [32 검사](evidence/32-deployment-final.json).

## UI 변경과 VM 표준

- 공유 권한 철회 확인창의 번역 키 노출을 한글/영문 문구로 수정했다. VM과 같은 공통 확인창을 사용한다.
- #1603: 검색 타이머 취소, 결과 교체 중 선택 객체 보존, 소유 범위 변경 시 캐시 초기화, 이전 검색 응답 무시를 구현했다. 500ms 경계 조건은 단위 검사로 재현했고, 실제 UI에서는 검색 직후 110ms/98ms 키보드 선택과 완료된 프로젝트 왕복·화면 이동을 확인했다. 초기 자동화 클릭 실패 중 숨은 옵션을 선택한 검증기 문제는 분리했으며 원본 실화면의 정확한 경계 A/B 재현을 주장하지 않는다.
- #1604: 개인 Shared 네트워크의 라우터 조회에 헤더 프로젝트가 주입돼 0건이던 문제를 수정했다. 원 자원의 프로젝트만 명시하며 API·역할 정책은 바꾸지 않았다. 기본/프로젝트 보기에서 라우터·버전·호스트 표시, 새로고침과 상세 링크 이동을 확인했다. 소비자·외부 계정 API는 양쪽 모두 기존 432 거부를 유지한다.
- VM 공통 목록·상세·탭·breadcrumb·MoldDialog 구조를 유지했다. 이번 변경에서 별도 CSS 레이아웃을 만들지 않았다. VM 기존 네트워크 연결창을 390/768/1280px × 라이트/다크 × 양쪽 12조합으로 대조했다. 실제 dark-mode 클래스, viewport, 하단 버튼, 가로 넘침 0과 폼 라벨 대비 7.13:1 이상을 확인했다. 라우터 탭은 31 데스크톱·32 모바일 다크 및 기본/프로젝트 문맥을 실화면 검증했다. 모든 탭의 모든 폭·테마 조합 완료를 의미하지 않는다.

**남은 UI 결함 #1605:** 32번 VM 상세에서 모바일 스크롤로 breadcrumb를 고정한 뒤 1280px로 넓히면 AntAffix 폭 356px이 남았다(부모 980px). 이 동적 전환은 실패로 기록한다. 새로고침 후 정상 폭으로 복구된 확인용 화면을 남겼다. 31번 동일 동작과 공통 컴포넌트 수정은 후속이다. [치수](evidence/breadcrumb-resize-limitation.json) · [캡처](screenshots/32-breadcrumb-resize-stale-width.jpg).

## Shared·VPC·ConfigDrive 후속

Shared 사용 중 삭제는 양쪽 UI·API에서 530으로 거부됐고 기존 NIC와 VM을 유지했다. 같은 도메인 개인 계정 부여와 원래 프로젝트 부여를 확인한 뒤 UI 권한 재설정으로 0건을 만들었다. 개인/프로젝트/외부 계정의 신규 후보가 사라지고 기존 NIC의 DNS·ICMP·TCP는 유지됐다. 원래 프로젝트 권한 1건만 복원했다. 다른 공유 유형 전체 역할 조합은 남아 있다. [철회 결과](evidence/31-permission-reset.json) · [최종 후보](evidence/32-permission-final.json).

#1602는 Tier가 남은 VPC 삭제 실패 시 태그가 먼저 삭제되던 순서를 수정했다. 양쪽 실패 후 VPC·Tier·태그가 남는 것을 UI·API로 확인했다. 별도의 빈 VPC를 정상 삭제해 태그·Source NAT IP 정리를 확인했고, 이 사례는 라우터 0→0이었다. 서비스가 연결된 Tier/VM의 삭제 영향까지 완료한 것은 아니다. 실패 확인용 VPC/Tier/태그는 남겼다. [31 실패 보존](evidence/31-vpc-tag-preserved-api.json) · [32 정상 정리](evidence/32-vpc-successful-delete.json).

ConfigDrive 복제 오퍼링 시험 VM은 기존 QGA exec/file 보안 설정을 유지했다. 정상 정지 상태의 디스크 사본을 해시 대조한 뒤 GuestFS 읽기 전용으로 `/var/tmp/qa-gn1569-configdrive-clone.txt`의 실제 V2 내용을 양쪽 확인했다. ISO 내용만으로 실행 성공을 추정하지 않았다. 실행 엔진을 cloud-init으로 단정하지 않으며 두 원래 VM은 원래 NIC를 유지한 Running 상태로 복구했다. [31 실행 흔적](evidence/31-configdrive-guest-execution.json) · [32 실행 흔적](evidence/32-configdrive-guest-execution.json).

## 로컬 검사와 범위

변경 server 모듈의 VpcManagerImplTest 25개와 package, UI lint·4 suite 15개·production build, 제품/빌드 버전 분리 2개 정상·1개 거부 검사를 통과했다. server 빌드는 rat/checkstyle을 생략했으며 전체 Cloud CI 성공으로 표시하지 않는다. UI 검사에는 아이콘 중복 등록·router-link stub 경고와 Jest forceExit 안내가 있었다. 활성 정적 파일 662개의 해시, WEB-INF·런타임 설정, 관리 JAR과 FTCTL 표식을 보존했고 `/client/`는 양쪽 HTTP 200이다. 보호된 주 FT 작업의 추적 변경 해시는 작업 전후 동일하다.

실행 UI 소스 `249246eced87685272fb0d14af562174e12f466e`, VPC 서버 수정 소스 `92018d30693433888b28e947d5fd302597c1b881`, 이미지 빌드 원본 `28481113917edab58b387f9b76c4a8c1ba69bc26`, 릴리스/검사 보완 `5dbcde3f2c5c3f1524aa51c8220651ef1d5b2399`이다. 증적 커밋은 실행 코드를 바꾸지 않는다.

## 후속 순서

1. **#1605 공통 breadcrumb 동적 리사이즈 폭** 수정과 31·32 검증.
2. #1569에서 서비스가 연결된 VPC Tier/VM 삭제 영향, 나머지 공유 범위·역할 조합.
3. 환경이 있는 VPN/LB UI·API·실패 복구와 Health Monitor/AutoScale 조건. 사용자 지시에 따라 LB 백엔드 부하분산 측정은 제외한다.
4. 스위치/제공자 준비 후 호스트 간 PVLAN·Shared PVLAN 라우터, IPv6·BGP·외부 DNS 등 조건부 항목.

현재 통합 표는 31번 부분 52·미실행 2·환경 차단 6·적용 제외 3, 32번 실패 1·부분 51·미실행 2·환경 차단 6·적용 제외 3이다. #1605의 실제 실패를 감추거나 전체 #1569를 닫지 않는다. 확인용 네트워크·VM·새 템플릿을 보관하고 임시 호스트 SSH 프로브 IP와 잘못된 이미지/등록만 정리했다.

## 자동 Checks 추가 확인

증적 head `677148c245747ce7231d45f543cdbf4faed2b6bf`의 [License Check](https://github.com/ablecloud-team/ablestack-cloud/actions/runs/42590198545)는 RAT 미승인 파일 3,573개로 실패했다. CI가 출력한 전체 미승인 경로와 이번 작업 시작 head `d62eaeb3c074910f758f708e0ceb802024295243` 이후 변경 파일의 교집합은 **0개**다. 이번 변경 파일은 해당 실패 목록에 없다. 범위 밖의 3,573개 파일을 일괄 수정하지 않았다. [경로 대조·Checks 상태](evidence/ci-scope.json).

로컬 변경 모듈/집중 검사 통과와 저장소 전체 License Check 실패를 구분한다. Lint 및 병합 충돌 검사의 관측 상태는 위 JSON에 기록했다. 이후 증적 설명 커밋으로 시작된 자동 검사까지 전체 CI 성공으로 간주하지 않는다.
