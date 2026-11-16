# Public IP breadcrumb VM 표준 스타일 보완

2026-11-16 KST. 사용자 지적에 따라 #1690의 breadcrumb 스타일 검증을 별도로 보완한다. 앞선 보고는 공통 Breadcrumb 사용 여부를 스타일 동등성의 근거로 삼아 부족했다. 이 후속은 UI 스타일과 탐색 경계에 한정하며 예약·NAT·VPC·VNF 전체 기능 시험을 반복하지 않는다.

## 확인과 수정

실제 배포 VM/Public IP를 대조한 결과 기본 경로 서체14px·두께400과 공통 카드 padding/sticky 구조는 이미 같았다. 기본 폰트 자체가 달랐다는 판정은 하지 않는다 (`ui-results.json`의 before 항목). 다만 Public IP는 VM이 참여하는 themed-list-toolbar 대상에서 빠져 있었고, 경로 뒤 문서/업데이트/상태·프로젝트 컨트롤은 각각의 inline margin으로 배치됐다. 경로의 테마 색상·hover/focus·긴 값/줄바꿈을 Public IP 범위에서 명시적으로 맞추는 작업이 빠졌다.

- Public IP 목록·상세에만 public-ip-page 범위를 부여하고 VM의 공통 themed-list-toolbar 스타일을 적용한다.
- 경로14px/22px/400, 테마의 secondary/current/hover/separator 토큰, 정적 위치·긴 경로 줄바꿈을 명시한다. 기존 VM/다른 메뉴의 경로 스타일을 변경하지 않는다.
- 공통 Breadcrumb의 끝 슬롯에 breadcrumb-controls class만 추가한다. Public IP 범위에서 끝 슬롯을 display:contents로 펼쳐 경로·문서·업데이트·필터·프로젝트가 하나의 흐름에서8px gap으로 줄바꿈되게 한다. 홈은 첫 줄 기준선에 맞추고 개별 margin을 정규화한다.
- 키보드 focus-visible과 상태 선택 필터의 연결 label을 추가한다. 필터가 없는 상세에는 해당 hidden label을 생성하지 않는다.
- API·상태 enum·URL 범위/목록 복귀·소유자/결과 추적 코드는 변경하지 않는다. 소스3개 파일과 SHA는 source-manifest.json에 있다.

제품 소스: `17ba03fc9c8630448cad22f33c24e6cf5320c10b`.

## 검증 결과

**최종 배포본 검증 완료**. 31 GFS2·32 RBD의 목록/상세 ×1280/768/390 ×라이트/다크 **24개**를 다시 확인했다. 각 조합은 페이지 가로 넘침 없음, 경로/컨트롤 viewport 내,14px 서체/정적 위치, 연결 label, 홈과 경로 첫 줄 차이2px 이내를 통과했다 (`ui-results.json`). 최종 화면 파일은 `31/32-list/detail-light/dark-1280/768/390.*`다.

양쪽 실제 UI에서 page2→상세→breadcrumb 목록 복귀 후 URL 필터·페이지와 행UUID 집합이 일치했다. 링크 hover는 transition 완료 후 링크와 내부 글자 모두 `rgb(105,177,255)`, 키보드 Tab은2px focus였다. 실제 .layout-content 스크롤31=600/32=506에서 breadcrumb가 컨테이너 상단78/151에 고정됐다 (`navigation.json`). 상태 필터의 연결 label과 실제 가용 선택도 확인했다. VM 화면은 기존14px/400/공통 카드 스타일을 유지했다.

UI **11 suites/250 tests**, 변경 파일 lint, WSL ext4 로컬 production UI build PASS. Java/전체 Cloud 빌드·Actions dispatch는 실행하지 않았다. 제품 소스는 위 최종 커밋이며 CSS만 바뀐 마지막 보완은 production 빌드·실제 화면으로 검증했다.

동일 artifact SHA256 `cc85d8533d7fc9cc19d35e7a675b9146e2bb9b8db30a501908da002f0b46b10d`, 양쪽 index SHA256 `76e0634943e2ffcb5aba8ffec7c6d19e4f5c84f868011de7ed5dd233d86c5000`. 최종 백업31 `/root/publicip1690-breadcrumb-ui-20261116-121044`,32 `/root/publicip1690-breadcrumb-ui-20261116-121140`. 정적 파일 전수/서버 디렉터리·설정·백엔드 JAR SHA와 PID31=2375963/32=2698517 보존, WEB-INF·HTTP200·서비스 active·활성 breadcrumb CSS marker를 확인했다 (`runtime-final-31/32.log`).

이번 후속은 시험 개체를 생성/변경하지 않았다. 한국어·라이트·기본 보기·Allocated/20으로 복원하고 임시 CSS/viewport/cache override를 해제한 뒤 전용 탭2개를 닫았다. 기존 FTCTL 작업14,541파일 지문과HEAD가 동일하다 (`protected-worktree.json`). 기존 #1690/Epic #1684의 종료 상태는 유지한다. PR #1691은 업데이트하되 병합은 실행하지 않는다.

첫 배포5cee 화면에서 홈과 현재 경로가 다른 줄로 갈라지는 것을 원본 캡처로 발견했다. 마지막 경로가 남은 너비를 사용하도록 하고 끝 슬롯 wrapper를 펼쳐 보완했다. 임시 CSS 미리보기는 즉시 제거했으며 배포 완료 근거에는 포함하지 않는다 (`32-wrap-before-fix.jpg`, `32-wrap-preview-not-deployment.jpg`). 이후 최종17ba 배포본으로 전체24개 조합과 탐색/hover/포커스/실제 스크롤을 다시 확인했다.
