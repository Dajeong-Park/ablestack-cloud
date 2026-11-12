# 검증에서 발견한 UI 후속

## #1594 생성 대화상자의 소유 계정·프로젝트 문맥

31·32 root 관리자가 QA 프로젝트를 선택한 상태에서 Isolated/L2/Shared 생성 대화상자를 열었을 때, 세 양식 내부에 대상 프로젝트 이름이 없다. 반면 VM의 기존 네트워크 연결 대화상자는 VM/Zone/프로젝트를 명시한다. 생성 요청의 실제 projectid와 결과 소유권은 이번 역할 검증에서 정확했다.

다른 프로젝트를 가리키는 접근 불가 `guestnetwork?projectid=...` URL에서 목록은 요청 실패로 거부된다. 헤더의 기본 보기에는 개인 생성 버튼이 남아 있고, 32 outsider에서 이를 누르면 대화상자가 열린다. 그때 listZones 요청의 projectid는 null이다. 실제 생성 제출은 하지 않았다. URL 필터와 현재 쓰기 문맥이 다를 수 있으므로 사용자가 소유 범위를 오해하지 않게 표시해야 한다. **권한 우회나 무단 프로젝트 생성이 확인된 것은 아니다.** [요청 전 관찰](evidence/ui-scope-preflight.json).

설계는 MoldDialog의 기존 VM 메타데이터/description 스타일로 소유 계정·도메인·프로젝트를 표시한다. 기본 보기 개인 범위, 프로젝트 범위, 관리자 선택 소유자, VM 내 생성의 고정 대상 범위를 일관되게 다룬다. 현재 검증된 store 문맥/실제 owner 선택을 표시 근거로 삼고 URL 문자열로 소유자를 추정하지 않는다. 프로젝트 전환 중 대화상자 닫기/입력 보존 정책을 명확히 하며 기존 API 권한 검사를 유지한다. 지원하지 않는 조회 권한을 추가로 요구하지 않는다.

근거: [31 Isolated](screenshots/31-owner-context-Isolated.jpg) · [32 Shared](screenshots/32-owner-context-Shared.jpg) · [양쪽 세 유형 양식 텍스트](evidence/ui-owner-contexts.json) · [VM 표준 모바일 다크](screenshots/32-vm-attach-standard-dark-390x844.jpg). 소스 후보는 CreateIsolatedNetworkForm.vue, CreateL2NetworkForm.vue, CreateSharedNetworkForm.vue, VM NIC 생성 문맥이다.

## #1593 390px 다크모드 VM NIC 표의 고정 열 제목 겹침

양쪽 새 VM의 NIC 탭을 390×844 다크로 열면 우측 고정 작업 열 제목과 뒤쪽 장치 ID 제목이 같은 자리에 표시된다. 라이트 표에서는 작업 열 바탕이 뒤쪽 제목을 가린다. 행의 NIC 데이터·권한과 실제 연결은 정상이며 가독성 결함이다. 파일은 원본 JPEG이며 별도 크기 변환을 하지 않았다.

재현: QA 프로젝트 → 새 r2 VM → NIC → 다크모드 → 390px → 표를 수평 스크롤할 수 있는 상태에서 열 제목 확인. [31 원본](screenshots/31-vm-nic-dark-390.jpg) · [32 원본](screenshots/32-vm-nic-dark-390.jpg) · [라이트 비교](screenshots/31-vm-nic-light-390.jpg).

VmNicsTab.vue는 scroll.x=760, fixed:right인 작업 열을 사용한다. 공통 테마의 고정 열 배경/레이어와 모바일 폭 정책을 확인해 불투명한 테마 배경과 분명한 경계를 적용하거나 작은 화면에서 고정 정책을 조정한다. 정확한 CSS 원인은 구현 단계에서 재현/계산 스타일로 확정한다. 텍스트와 작업을 숨겨 해결하지 않는다. 목록·상세·탭·breadcrumb·대화상자와 프로젝트 즉시 전환에 영향을 주지 않아야 하며 390/768/1280px 라이트/다크와 수평 스크롤 양 끝, 기본 NIC 연결 해제 비활성·권한 역할을 재검증한다.

이 두 후속은 이번에 구현하지 않았다. Epic 브랜치와 기존 Draft PR에서 순차 구현한다.

Epic #1554의 하위 이슈로 [#1593](https://github.com/ablecloud-team/ablestack-cloud/issues/1593) → [#1594](https://github.com/ablecloud-team/ablestack-cloud/issues/1594) 순서로 등록했다. 두 이슈는 Open이며 실제 재현·설계·완료 조건과 증적 링크를 포함한다.
