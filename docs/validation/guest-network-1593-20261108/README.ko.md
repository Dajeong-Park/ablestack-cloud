# #1593 VM NIC 다크모드 고정 작업 열 개선 (2026-11-08)

31·32의 390px 다크 NIC 표에서 “작업” 제목 뒤로 “장치 ID”가 비치던 문제를 **UI 스타일 한 곳**에서 수정했다. `VmNicsTab.vue`의 고정 작업 열에 `background: var(--ui-bg-surface) !important`를 적용했다. **별도의 API 수정·Java/JAR 배포는 없다.** 구현 커밋은 `8e10ca50f8fdb26dc3932b8132a2ea110f1ffdf4`다.

## 변경한 UI와 VM 표준

VM 메뉴의 **볼륨 탭 `VmVolumesTab.vue`가 이미 사용하는 고정 열 배경 규칙을 NIC 탭에도 동일하게 적용**했다. 다크모드의 `ant-table-small` 헤더 규칙이 배경을 투명하게 만들고 있었고, 배포 전 실제 계산 스타일은 `rgba(0, 0, 0, 0)`이었다. 배포 후 고정 헤더/셀은 다크 `rgb(34, 40, 47)`, 라이트 `rgb(255, 255, 255)`로 불투명하다. 기존 테마 변수와 밝기 전환을 그대로 따른다. 전역 테이블 CSS나 API 호출·권한·작업 로직을 바꾸지 않았다.

작업 열·NIC 정보·열 제목을 숨기지 않고 기존 `fixed:right`·수평 스크롤을 유지했다. 툴바의 기본 텍스트 작업 → 갱신 버튼 → 검색, 목록·상세·탭·대화상자·breadcrumb의 기존 VM 배치를 유지했다. 새 리본이나 별도 모바일 테마를 추가하지 않았다.

## 실제 UI 검증

| 범위 | 31 | 32 |
| --- | --- | --- |
| 390×844·768×1024·1280×900 × 라이트/다크 | 6조합 정상 | 6조합 정상 |
| 390px 표 수평 스크롤 좌/우 끝 | 고정 작업 제목 가독성·작업 열 유지 | 동일 |
| 긴 네트워크명·Isolated/Shared 주소·L2 Cloud IP 미관리·MAC | 표시 유지 | 표시 유지 |
| NIC 작업 메뉴·L2 상세 | 열기·상세 읽기·닫기, IP 변경/보조 IP 편집 비활성 | 동일 |
| 기존 네트워크 연결 대화상자 | 라이트 390px 열기·읽기·취소 | 라이트/다크 390px 열기·읽기·취소 |
| breadcrumb → VM 목록 → 같은 VM 상세/NIC | 4 NIC 복귀 | 4 NIC 복귀 |
| QA 프로젝트 → 기본 보기 → QA | 대시보드 이동·이전 NIC 화면 제거·다시 4 NIC 표시 | 동일 |

이 검증은 CSS 수정의 UI 회귀다. **새 NIC 연결/해제·기본 NIC 변경·네트워크 생성 제출은 하지 않았다.** 실제 생성·연결의 통합 권한 결과는 [직전 #1569 역할 회귀](../guest-network-1569-roles-20261108/README.ko.md)에 유지하고, 이번에는 양쪽 계정으로 재로그인해 역할별 버튼/읽기 상태를 확인했다.

| 역할 | 양쪽 UI 결과 |
| --- | --- |
| Admin·owner·member·직접 프로젝트 멤버 아닌 DomainAdmin | 생성 및 연결/기존 네트워크 연결 표시, 기본 NIC 해제 비활성·세 보조 NIC 해제 버튼 활성 |
| readonly·user-only | 생성/연결/해제 버튼 없음, 기존 4 NIC 읽기 가능 |

총 6역할 × 두 곳의 12건이다. [역할 결과](evidence/ui-role-gates.json) · [프로젝트 전환](evidence/ui-project-switches.json) · [화면 이동](evidence/ui-navigation.json) · [계산 스타일/원본 캡처 47장](capture-matrix.ko.md).

새 캡처는 45장이다. 수정 전 겹침 비교에는 직전 역할 회귀에서 보관한 양쪽 원본 JPEG 2장을 변경 없이 복사해 사용했다. 이번 배포 전에도 투명 헤더의 계산 스타일을 직접 다시 확인했다. 테마·viewport·좌/우 scrollLeft와 원본 JPEG 크기/해시를 함께 보관했다. 최종 31은 라이트, 32는 다크·기본 뷰포트·관리자·QA 프로젝트의 VM NIC 화면이다.

## 로컬 빌드와 배포

WSL ext4 `/home/ablecloud/work/dhslove/cloud-epic-1554`에서 해당 Vue 파일 lint와 기존 UI 테스트 2 suites/22개가 통과했다. UI 로컬 빌드도 성공했다. 새 CSS를 되풀이하는 단위 테스트는 추가하지 않고 실제 브라우저에서 투명→불투명 계산 스타일과 화면을 확인했다. 빌드는 기존 asset/entrypoint 크기 경고 2개를 출력했으며 실패는 없다. 전체 Cloud/Maven 빌드·Actions 수동 실행은 하지 않았다.

양쪽 활성 `/usr/share/cloudstack-management/webapp`에 정적 자산 **662개, 29,950,368 bytes**를 반영했다. 각 파일 SHA256 대조에 불일치 0, `index.html` SHA256은 `9b0aa67bf7327daff6ffca7e7e2f9de5068530dcbddc57101571252f41174bca`다. 루트를 삭제/교체하거나 rsync --delete를 사용하지 않았다. WEB-INF/META-INF 서버 파일·실제 config·기존 대용량 이미지와 mold PID를 보존했고 전후 HTTP 200이다. 정적 자산 백업은 WSL ext4 `guest-network-1593-validation/backups/20261108-141515/31` 및 `/32` 아래에 보관했다.

관리 JAR SHA256은 기존 `2faddb218741a22b1e83ff89337adb73e0a981d525c2bdc32c313b7bb33b8592`로 같다. 최근 로그 15,000행에 linkage 오류 0, mold active·HTTP 200·WEB-INF·FTCTL/네트워크 표식을 확인했다. [31 배포](evidence/31-deployment.json) · [32 배포](evidence/32-deployment.json) · [31 런타임](evidence/31-runtime-after.json) · [32 런타임](evidence/32-runtime-after.json) · [테스트 로그](evidence/tests.log) · [빌드 로그](evidence/ui-build.log).

## 자원 보존과 후속

검증 전후 새 r2 VM의 각 4 NIC·기본 NIC·IP/MAC·호스트가 같고 호스트 libvirt MAC과 일치한다. 기존 VM의 각 8 NIC와 프로젝트 보기 39/40개 네트워크, 멤버십/역할·공유 2행·LB 각 5개 Active·인증서·FW/PF·운영 자원이 그대로다. 신규/삭제 자원은 없으며 이전에 만든 망 24개와 r2 VM 2개를 확인용으로 남겼다. QA 망 한도 50도 유지한다. [확인 자원과 직접 링크](resources.ko.md).

#1593의 모바일 실패는 해결했다. Epic C06은 남은 넓은 사용성 조건이 있으므로 전체 성공 대신 **부분**으로 되돌렸다. 전체 63행은 실패0·부분49·미실행5·환경차단6·제외3·전체 행 성공0이다. [커버리지](../guest-network-1569-integrated/coverage.ko.md).

**다음 구현은 [#1594 생성 대화상자의 소유 계정·프로젝트 문맥](https://github.com/ablecloud-team/ablestack-cloud/issues/1594)**이다. 이후 #1569의 Skudonet 실제 UI 배포/연관 상태, 남은 역할·조건부 검증을 진행한다. IPv6/BGP/Tungsten 실환경 항목과 #1586은 기존 환경/후속 범위를 유지한다. Epic 브랜치 `dhslove/epic-1554-guest-networks`와 기존 Draft PR #1577을 유지하고 #1593만 완료 처리한다.
