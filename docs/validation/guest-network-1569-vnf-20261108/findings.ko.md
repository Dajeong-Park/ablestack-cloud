# VNF 검증에서 발견한 후속 결함

제품 소스를 수정하지 않고 실제 재현과 개선 설계를 분리했다. 우선순위 F1→F2→F3→F4이며, 수정 후 #1569에서 남은32번 UI와 역할/조건부 검증을 이어간다.

## F1 / P2 VNF 기본 배포 화면의 숨은 User Data 준비 가드로 실행 버튼 비활성

상위 Epic #1554 / 통합 회귀 #1569. 31 GFS2·32 Glue RBD에서 2026-11-08 실제 UI로 확인했다. 이번은 재현/설계이며 미구현이다.

## 재현과 영향

31/32 root·QA 프로젝트에서 프로젝트 소유 Skudonet VNF 템플릿·Zone·오퍼링·Isolated 네트워크·필수 Management NIC 매핑·이름을 모두 지정한다. 고급 설정은 기본대로 닫는다. 실행 버튼이 비활성이다. 고급 설정을 열면 저장된 User Data의 ‘설정 안함’이 준비되고 실행 버튼이 활성화된다. 추가 User Data를 선택한 것은 아니다. 양쪽에서 실제 재현했으며 고급 설정을 연 정상 UI 경로로 배포는 성공했다.

## 원인 근거와 설계 (UI만)

[`DeployVnfAppliance.vue`](https://github.com/dhslove/ablestack-cloud/blob/31e140aa7846e81a275227de58ca5fd77775094e/ui/src/views/compute/DeployVnfAppliance.vue)의 실행 버튼/handleSubmit은 `userDataSelectionBlocked`를 사용한다. [`userDataSelection.js`](https://github.com/dhslove/ablestack-cloud/blob/31e140aa7846e81a275227de58ca5fd77775094e/ui/src/utils/userDataSelection.js)는 초기 ready=false이며 기본 등록 User Data 탭을 검사한다. 선택기가 고급 영역에 늦게 mount돼 초기 ‘설정 안함’까지 차단하는 것으로 판단한다. 이는 UI/source 대조에 따른 원인 추론이며 이번에 수정하지 않았다.

- 초기 ‘설정 안함’과 사용자가 지정한 등록 User Data의 미해결 상태를 구분한다. 고급 영역을 열지 않아도 유효한 기본 배포가 가능해야 한다.
- 실제 선택한 User Data의 pending/실패/삭제/권한 변화 때는 기존 fail-closed 제출 차단을 유지한다. 전역 가드를 단순 제거하지 않는다.
- VM 배포 등 공통 consumer에 미치는 영향을 분리하고 프로젝트/Zone/템플릿 전환 시 이전 선택값을 안전하게 정리한다.
- VM 메뉴의 실행 버튼·모바일 footer/기존 MoldDialog·라이트/다크 테마를 유지한다. API/Java 변경은 범위 밖이다.

## 완료 조건

- [ ] 31/32 프로젝트 및 개인의 유효한 기본 VNF 배포가 고급 설정을 열지 않고 실행된다.
- [ ] 고급 영역 열기/닫기만으로 불필요하게 실행 가능 여부가 바뀌지 않는다.
- [ ] 선택된 User Data의 pending/오류·프로젝트 전환 중 이전 값 제출은 차단한다.
- [ ] 집중 테스트와 실제 UI 배포·390/768/1280px·라이트/다크·프로젝트 왕복 캡처를 게시한다.

후속 우선순위1. #1569의 이번 배포를 성공으로 인정하되 기본 화면 문제는 별도로 남긴다.

## F2 / P2 VNF 상세 요약·NIC에서 접근 가능한 네트워크 링크가 표시되지 않음

상위 Epic #1554 / 통합 회귀 #1569. 31 GFS2·32 Glue RBD에서 2026-11-08 실제 UI로 확인했다. 이번은 재현/설계이며 미구현이다.

## 재현과 영향

31/32 QA 프로젝트 Skudonet VNF를 실제 UI 배포하고 Isolated/L2/Shared NIC3개를 연결했다. 같은 root는 각 네트워크 상세와 VNF 탭을 볼 수 있으나 VNF 상세 요약/NIC의 네트워크 이름은 링크가 없는 일반 텍스트다. 31 최종 NIC DOM은3행/네트워크 링크0이다. 양쪽 연결 완료 캡처에서도 같은 상태다.

## 원인과 설계 (UI만)

[`vmNetworkAccessScope`](https://github.com/dhslove/ablestack-cloud/blob/31e140aa7846e81a275227de58ca5fd77775094e/ui/src/utils/vmNetworkAccess.js)는 route meta가 `vm`이거나 `/vm/`로 시작하는 경우만 허용해 `/vnfapp/`는 빈 scope가 된다. InfoCard와 VmNicsTab이 같은 권한 판정을 사용하므로 링크가 사라진다. #1592의 일반 VM 범위를 VNF 화면에서도 같은 계약으로 사용할 수 있도록 확장한다.

- VM/VNF의 실제 route family·resource ID·Zone·프로젝트·로그인 역할을 함께 검증해 조회 scope를 생성한다. 임의 경로나 다른 VM ID에는 활성화하지 않는다.
- VNF metadata 갱신에 일반 `listVirtualMachines`와 VNF 전용 API의 응답 차이가 있는지 확인하고 적절한 읽기 API/권한을 사용한다.
- 조회 오류/권한 회수는 링크를 숨기고 기존 NIC 데이터를 유지하며, 재시도 성공 시 요약과 NIC 링크가 같이 복구돼야 한다.
- role/project 변경·unmount 시 이전 허용 snapshot을 재사용하지 않는다. 단순히 VNF 링크를 무조건 표시하지 않는다.
- 기존 VM UI 표준/모바일·다크 고정 작업 열과 툴바를 유지한다. API/Java 변경은 범위 밖이다.

## 완료 조건

- [ ] 31/32 VNF의 접근 가능한 Isolated/L2/Shared 링크가 요약/NIC에 모두 표시되고 올바른 상세로 이동한다.
- [ ] 공유 회수/권한 없는 역할/조회 실패 때 두 위치의 링크 판정이 일치하고 NIC는 보존된다.
- [ ] 프로젝트 즉시 전환·breadcrumb 왕복·390/768/1280px·다크/라이트 및 일반 VM 회귀를 검증한다.

후속 우선순위2. #1592의 일반 VM 완료 결과를 되돌리지 않고 VNF 적용 누락을 추가한다.

## F3 / P2 루트 관리자의 프로젝트 VNF 배포와 Isolated IP 후보 조회 권한 불일치

상위 Epic #1554 / 통합 회귀 #1569. 31 GFS2·32 Glue RBD에서 2026-11-08 실제 UI로 확인했다. 이번은 재현/설계이며 미구현이다.

## 재현과 실제 결과

31/32 root가 QA 프로젝트를 선택하고 VNF 배포에서 해당 프로젝트 Isolated 망을 선택하면 `listAvailableGuestIps(networkid,projectid)`가 HTTP531 permission denied다. UI는 같은 오류를 여러 번 알림으로 표시한다. 입력을 보존하고 자동 IP로 실제 배포하면 성공한다. 새 VNF는 해당 프로젝트 소유이며 기본 NIC/IP도 생성된다.

`admin.is.allowed.to.deploy.anywhere=false`가 양쪽에 있으며 바꾸지 않았다. owner/member/DomainAdmin/peer의 전용 시험 역할은 해당 API가432로 미노출이다. 이것을 이 역할들의 네트워크 배포 권한 거부로 해석하지 않는다. root 프로젝트 IP 후보 조회와 명시적 프로젝트 배포의 문맥/권한 계약 차이를 해결해야 한다.

## 원인 근거·개선 설계

[`NetworkServiceImpl.listAvailableGuestIps`](https://github.com/dhslove/ablestack-cloud/blob/31e140aa7846e81a275227de58ca5fd77775094e/server/src/main/java/com/cloud/network/NetworkServiceImpl.java)는 callingAccount로 `checkNetworkPermissions`를 호출한다. [`NetworkModelImpl`](https://github.com/dhslove/ablestack-cloud/blob/31e140aa7846e81a275227de58ca5fd77775094e/server/src/main/java/com/cloud/network/NetworkModelImpl.java)는 deploy-anywhere=false인 root가 프로젝트 멤버가 아니면 사용권한 경로를 탄다. 실제 배포는 명시적 프로젝트 소유자를 선택한다. 이 차이가 관찰 결과의 원인으로 추론된다. 이번에 API/정책을 변경하지 않았다.

- 명시적으로 선택한 프로젝트/소유자의 배포 가능 범위와 IP 조회의 범위를 대조해 계약을 확정한다. 임의 projectid/query로 다른 소유자의 후보를 읽지 못하게 해야 한다.
- 서버 변경이 필요하면 기존 프로젝트/도메인 접근 검사를 통과한 대상에만 조회를 허용한다. `admin.is.allowed.to.deploy.anywhere`를 켜거나 권한 검사를 제거하지 않는다.
- UI는 API 미노출 역할에서 호출하지 않고 자동/수동 IP 입력의 지원 범위를 설명한다. 조회 실패 시 입력 보존·명시적 재시도·오류 알림 중복 억제를 적용한다.
- 배포 성공과 IP 후보 조회 성공을 별도로 검증한다. 일반 VM의 같은 IP 선택기에도 영향을 확인한다.

## 완료 조건

- [ ] 31/32 명시적 QA 프로젝트 root 조회·배포의 계약이 일치하고 허용 경로에서는 IP 후보가 정상 표시된다.
- [ ] 비멤버/외부 도메인/가짜 프로젝트·공유 회수는 서버에서 거부하며 정책 플래그를 유지한다.
- [ ] API 미노출 역할·조회 실패/재시도·프로젝트 전환에서 입력이 유지되고 알림이 무한 누적되지 않는다.
- [ ] UI/API/실제 NIC 결과와 역할별 허용/거부를 게시한다.

후속 우선순위3. 보안 정책을 약화시키는 우회는 해결로 인정하지 않는다.

## F4 / P3 VNF 템플릿 NIC 추가 시 동일 대화상자 두 개가 동시에 열림

상위 Epic #1554 / 통합 회귀 #1569. 31 GFS2·32 Glue RBD에서 2026-11-08 실제 UI로 확인했다. 이번은 재현/설계이며 미구현이다.

## 재현

31/32 프로젝트 전용 VNF 템플릿 → VNF 설정 → VNF nic 추가를 한 번 누른다. 같은 제목/필드의 visible dialog가2개 렌더링된다. 이번 UI 검증에서 두 곳 모두 DOM2를 확인했다. 최상위 창에서 Management/device0/필수/관리 NIC를 입력하고 한 번 제출해 정의1개를 저장했다. 중복 API 쓰기를 성공으로 집계하지 않는다.

## 원인과 개선 설계 (UI만)

[`TemplateVnfSettings.vue`](https://github.com/dhslove/ablestack-cloud/blob/31e140aa7846e81a275227de58ca5fd77775094e/ui/src/views/image/TemplateVnfSettings.vue)에 같은 `showAddVnfNic`/제목/필드/닫기/submit을 사용하는 추가 modal 블록이 연속으로 두 번 선언돼 있다.

- 중복 블록을 제거하고 단일 상태/submit/닫기 처리를 둔다. 중복 클릭 중 저장은 한 번만 실행한다.
- VM 메뉴의 MoldDialog·세로 입력/metadata·footer·모바일/다크 테마를 적용한다. device ID/이름/필수·관리 플래그/설명을 의미별로 배치하고 label과 input을 연결한다.
- 모달을 여는 초점·Tab 이동·ESC/취소 후 초점 복귀·마스크 정리를 한 번만 처리한다.
- 기존 NIC 정의의 편집/순서/삭제에 영향을 주지 않고 API/Java는 바꾸지 않는다.

## 완료 조건

- [ ] 양쪽에서 한 번 클릭 시 visible dialog1개·초점 영역1개·저장 요청1건이다.
- [ ] 저장/취소/ESC/재열기 후 중복 overlay나 값 잔류가 없다.
- [ ] 390/768/1280px·라이트/다크·프로젝트 전환과 기존 정의 보존을 검증한다.

후속 우선순위4. 현재 UI/source 재현을 기록했으며 아직 수정하지 않았다.

증거: [32 기본 실행 비활성](screenshots/32-deploy-disabled-basic.jpg)·[31 최종 NIC](screenshots/31-final-review-nic.jpg)·[32 Shared 연결 완료](screenshots/32-attach-shared-complete.jpg)·[프로젝트 IP 조회 오류](screenshots/31-deploy-project-network-permission-error.jpg)·[31 중복 NIC 창](screenshots/31-template-vnf-add-duplicate-dialog.jpg)·[32 중복 NIC 창](screenshots/32-template-vnf-add-duplicate-dialog.jpg)·[UI 동작/DOM 수](evidence/ui-actions.json)·[31 API 진단](evidence/31-ip-permission-probes.json)·[32 API 진단](evidence/32-ip-permission-probes.json).
