# #1569 Skudonet 실제 UI 배포·NIC·실패 복구 검증 (2026-11-08)

**31 GFS2·32 Glue RBD에서 Skudonet을 실제 Mold UI로 각각 배포하고 L2·Shared 보조 NIC를 연결했다.** 두 VNF는 Running이며 Isolated 기본 NIC를 포함해 각 3 NIC다. UI 제출 → 비동기 작업 → API → 호스트 libvirt → 게스트 QGA 인터페이스를 대조했다. 확인용 VNF/템플릿과 기존 자원을 남겼다.

**전체 #1569 완료는 아니다.** 31의 세 유형/세 크기/라이트·다크 18조합과 프로젝트 왕복은 끝났으나 **32의 남은 반응형·테마 전환·프로젝트 왕복은 미완료**다. 브라우저 제어가 Windows의 현재 URL을 확실히 판정하지 못해 자동 중단됐고, 이후 UI 작업은 하지 않았다. 32의 기존 다크 데스크톱 배포/NIC/연관·실패 복구 캡처만 이번 결과로 인정한다. 제어 문제를 Mold 기능 실패로 집계하거나 미실행을 성공으로 바꾸지 않았다.

이번은 기존 배포본의 추가 검증이다. **제품 UI/API/Java 변경·새 빌드·새 배포는 없다.** #1594 구현 `31e140aa7846e81a275227de58ca5fd77775094e`의 활성 정적662개와 기존 관리 JAR 해시를 양쪽에서 다시 확인했다. 기존 Epic 브랜치/Draft PR #1577 및 #1569 Open을 유지한다.

## 실제 UI 경로와 결과

| 검증 | 31 | 32 |
| --- | --- | --- |
| URL로 프로젝트 전용 비공개 VNF 템플릿 등록 | Download Complete·ready | Download Complete·ready |
| 템플릿 VNF 설정 → Management/device0/required/management 정의 | UI 저장, API 일치 | 동일 |
| VNF 기기 → 추가 → 프로젝트 템플릿/오퍼링/Isolated 망/관리 NIC 매핑/호스트 → 실행 | UI 배포 성공, Running | 동일 |
| VNF 상세 → NIC → 기존 네트워크 연결 → L2·Shared | UI 작업2건 성공, 최종3 NIC | 동일 |
| Isolated/L2/Shared → VNF 기기 탭 | 세 망에 같은 VNF1개, 망별 IP 표시 | 동일, Shared NIC 연결 완료 캡처 포함 |
| 일반 VM만 있는 별도 L2 대조군 | UI/API VNF0, 정상 빈 안내 | API VNF0, 이번 UI 미실행 |
| VNF 연관 읽기 실패 → 기존 행 유지 → 수동 업데이트 | 경고/동일 행 유지/정상 복구 | 동일 |
| 390×844·768×1024·1280×900 × 세 유형 × 라이트/다크 | 실제 크기 검증 18조합 | 제어 중단으로 미완료 |
| 390px VNF 표 가로 스크롤 | 0→384px, 오른쪽 끝 표시 | 미실행 |
| QA→기본 보기→QA·breadcrumb VNF 목록→상세/NIC | 대시보드/이전 패널 제거, 복귀3 NIC | 남음 |
| VM 표준 기존 연결 대화상자 모바일 열기/취소 | 390px 라이트 확인 | 데스크톱 다크의 실제 연결창 확인, 모바일 남음 |

프로젝트 전용 템플릿은 제공받은 URL `http://10.10.0.202:81/OS-template/Link%20VNF/ABLESTACK-Link-Skudonet-7-2-1-LB-Appliance.qcow2`로 UI에서 등록했다. KVM/QCOW2/x86_64/Other Linux (64-bit)/VNF, 비공개·비밀번호 관리 비활성·추출 비활성이다. 기존 다른 QA 계정의 비공개 템플릿 권한을 넓히지 않았다. 새 템플릿은 각 QA 프로젝트 소유이며 원래 템플릿은 유지했다.

31은 `2Core 2GB`/ablecube31-3/SharedMountPoint(GFS2), 32는 `AS-PROD-32-AS01-2C2G`/ablecube32-2/RBD를 사용했다. 새 네트워크를 만들지 않고 #1594가 남긴 프로젝트 망 3개를 사용했다. Isolated의 실제 기본 NIC IP는 31 `10.251.31.98`, 32 `10.251.32.38`, Shared는 각각 `10.246.31.50`/`10.246.32.58`이다. L2는 IP 미관리이므로 VNF 탭에 `—`를 표시하며 Isolated IP를 대신 표시하지 않는다.

배포2·NIC4의 비동기 작업6건은 모두 성공이고 호출자 admin·대상 VM·연결 망이 일치한다. 각 VM의 API MAC3개는 libvirt 인터페이스 및 **게스트 QGA `guest-network-get-interfaces`**에 모두 존재한다. 기본 NIC의 ID/IP/MAC/device0은 보존됐다. 게스트 읽기는 read-only QGA를 사용했으며 SSH 인증/QGA 보안 정책을 바꾸지 않았다. **LB 백엔드 분산/트래픽, DHCP·DNS·서비스 구성 성공까지 검증한 것은 아니다.** 새 VNF와 라우터가 같은 호스트라는 전제로 통신 성공을 추정하지 않았다.

[31 작업3건](evidence/31-jobs-audit.json) · [32 작업3건](evidence/32-jobs-audit.json) · [31 연관](evidence/31-association-audit.json) · [32 연관](evidence/32-association-audit.json) · [31 호스트/게스트 NIC](evidence/31-host-guest-nics.json) · [32 호스트/게스트 NIC](evidence/32-host-guest-nics.json).

## 실패와 복구의 구분

31의 첫 실제 실행은 기존 QA 프로젝트 스토리지 한도200GiB보다 기존 VM 사용량300GiB가 커서 HTTP535로 거부됐다. 이름/템플릿/망/매핑/호스트 입력과 재실행 버튼을 유지했다. 이전 VM을 지우지 않고 **QA 프로젝트의 primary_storage만 양쪽200→500GiB**로 조정했다. 다른 한도/멤버십은 그대로다. 기존 다른 계정의 비공개 템플릿으로 실행한 다음 시도는 HTTP531로 정상 거부됐고, 프로젝트 전용 비공개 템플릿을 UI 등록한 뒤 성공했다. 실패한 두 시도는 성공 배포나 새 VM으로 세지 않는다.

VNF 목록의 실패 복구는 **브라우저에서 해당 `listVnfAppliances` XHR 한 건에만 임시 HTTP503 JSON을 응답한 시험**이다. 서버·권한·API 소스·전체 네트워크를 중단하지 않았다. 양쪽에서 경고와 기존 이름/상태/해당 망 IP/템플릿/호스트 행 보존을 동시에 확인하고, 가로챔 해제 후 실제 서버 재조회로 경고가 사라졌다. 원래 로그인 상태를 유지했다. 이 결과를 백엔드 VNF 배포 실패/호스트 장애 복구로 확대하지 않는다.

31 배포 성공 요청의 원본 POST/응답은 브라우저 버퍼 만료로 남지 않았다. UI 배포 동작/완료 알림·원래 성공 job `c3e20013-ef42-421d-99e5-a6456401a918`의 호출자/VM/NIC 결과·API/호스트/게스트를 연결해 확인했다. 32 배포 job은 `d832ceb4-3f4d-4914-8d92-393b2832e782`이며 원본 POST/응답이 남았다. [부분 UI 요청 기록](evidence/ui-wire.json)과 [쓰기 archive](evidence/ui-write-archive.json)를 모든 요청이 보존된 로그로 해석하지 않는다.

[UI 동작/실패/복구](evidence/ui-actions.json) · [캡처50장](capture-matrix.ko.md) · [31 한도 조정](evidence/31-quota-adjustment.json) · [32 한도 조정](evidence/32-quota-adjustment.json).

## VM UI 표준·발견 결함

VNF 상세는 VM과 같은 ResourceView/InfoCard/NIC 컴포넌트를 사용한다. 목록→breadcrumb→상세→NIC와 텍스트 작업/업데이트/검색 툴바, 기존 연결 MoldDialog의 VM/Zone/프로젝트 metadata·세로 입력·모바일 footer를 실제로 확인했다. VNF 연관 탭은 공통 네트워크 툴바와 small 표/가로 스크롤/테마 변수를 사용한다. 31은 실제 각18개 viewport·테마의 행/계산 배경/문자색/본문 너비를 기록했고 원본 JPEG 치수를 대조했다. 초기 제어기 크기 적용 실패 관찰은 이18개에 포함하지 않았다.

다음 네 결함은 구현 완료로 처리하지 않았다. [재현·설계·완료 조건](findings.ko.md)에 분리했다.

1. **F1/P2:** 고급 설정이 닫힌 기본 VNF 배포 화면에서 실행 버튼이 계속 비활성. 고급 설정을 열어 User Data의 ‘설정 안함’ 선택기가 준비되면 활성화된다(양쪽 재현).
2. **F2/P2:** VNF 상세 요약/NIC에서 접근 가능한 세 네트워크 링크가 숨겨진다. `vmNetworkAccessScope`가 `/vm/`만 받아 `/vnfapp/`를 제외한다. 31 최종 NIC 표 링크0, 양쪽 초기/연결 완료 캡처에서도 일반 텍스트다.
3. **F3/P2:** root의 명시적 QA 프로젝트 배포는 성공하지만 Isolated IP 후보 조회는531. owner/member/DomainAdmin/peer의 시험 역할에서는 해당 API가432로 미노출이다. `admin.is.allowed.to.deploy.anywhere=false`는 유지했다. 역할/대상 소유 범위와 조회 계약을 맞춰야 하며 이 설정을 켜서 우회하지 않는다.
4. **F4/P3:** 템플릿 VNF NIC 추가 한 번에 같은 대화상자가2개 열린다(양쪽 DOM2). 파일에 같은 visible의 modal이 중복 선언됐다. 이번에는 최상위 창 한 번 제출로 저장했다.

새 결함 때문에 C06과 M02는 실패로 표시한다. 넓은 X06 VNF는 이번 배포/연관/읽기 복구만 검증했으며 나머지 조건은 부분이다. 63행 집계는 **실패2·부분47·미실행5·환경차단6·적용제외3·전체행성공0**이다. #1569를 닫지 않는다.

## 보존·런타임·후속

각 프로젝트의 기존 일반 VM3대/16 NIC(원래8+직전4+#1594의4), IP/MAC/default/호스트/상태를 보존했다. 네트워크 ID45/46개·소유/오퍼링/주소·멤버십은 그대로다. VNF에 실제 사용한 세 망의 상태/동적 VLAN 구현은 의도된 변화로 구분했다. 신규 VNF/루트 볼륨/프로젝트 비공개 템플릿은 각각2개다. 1차 스토리지 한도500GiB는 확인 자원 보존을 위해 남긴다. 망 한도50 등 나머지 한도는 유지했다.

운영 네트워크/VM/오퍼링 지문은31의28/121/30, 32의11/58/21개가 기준선과 같다. 기존 LB 각5개 Active·인증서·FW/PF·공유2행도 보존됐다. [보관 자원과 직접 링크](resources.ko.md).

양쪽 HTTP200·mold active·WEB-INF·정적662개/기존 FTCTL 표식과 #1594 표식을 재확인했다. 관리 JAR SHA256은 `2faddb218741a22b1e83ff89337adb73e0a981d525c2bdc32c313b7bb33b8592`, 기존 서버204,656항목/클래스 해시가 같고 최근15,000로그 행의 linkage 오류0이다. [31 런타임](evidence/31-runtime-after.json)·[32 런타임](evidence/32-runtime-after.json). 이번 변경은 검증 문서뿐이므로 새 단위 테스트/빌드/Actions는 실행하지 않았다. [직전 UI26개/빌드](../guest-network-1594-20261108/README.ko.md)는 이전 단계 결과로 구분한다.

후속 순서는 **F1 실행 가드 → F2 VNF 네트워크 링크 → F3 IP 조회 계약 → F4 중복 창 → #1569 32번 UI 미완료와 VNF 나머지 역할/실패 조건 재검증 → L2 ConfigDrive/PVLAN·VPC 등 잔여 조합**이다. IPv6/BGP/Tungsten은 기존 실환경 준비 후, #1586은 별도 RBD 정리 후속이다. 브라우저 URL 확인 문제 해소 전 32 미완료 항목을 성공으로 처리하지 않는다.

## 게시된 후속 이슈와 해결 순서

1. [F1 / #1595 [Europa][P2] VNF 기본 배포 화면의 숨은 User Data 준비 가드로 실행 버튼 비활성](https://github.com/ablecloud-team/ablestack-cloud/issues/1595)
2. [F2 / #1596 [Europa][P2] VNF 상세 요약·NIC에서 접근 가능한 네트워크 링크가 표시되지 않음](https://github.com/ablecloud-team/ablestack-cloud/issues/1596)
3. [F3 / #1597 [Europa][P2] 루트 관리자의 프로젝트 VNF 배포와 Isolated IP 후보 조회 권한 불일치](https://github.com/ablecloud-team/ablestack-cloud/issues/1597)
4. [F4 / #1598 [Europa][P3] VNF 템플릿 NIC 추가 시 동일 대화상자 두 개가 동시에 열림](https://github.com/ablecloud-team/ablestack-cloud/issues/1598)

이후 #1569의32번 미완료 UI와 잔여 역할/조건부를 재검증한다. 네 이슈는 미구현/Open이며 Epic 하위35개 중 완료30/Open5다.
