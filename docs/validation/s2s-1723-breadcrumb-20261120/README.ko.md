# #1723 breadcrumb 표준·다크 설명문 후속 교정

사용자가 지적한 breadcrumb 영역 배치와 다크모드 설명문 결함을 교정했다. 앞선 1,536항목 검증은 breadcrumb 내부 도구 배치 및 설명문 색상까지 포함하지 못했으므로, 그 항목의 완전한 인수 근거로 사용하지 않는다. 이번 보고가 해당 범위의 교정·재인수 결과다.

## 변경

- **VM 공통 breadcrumb 배치 복원:** VPN 목록에만 적용된 flex 도구 모음 규칙을 제거했다. VM과 같은 table/table-cell 경로로 추가 버튼과 검색창을 같은 높이에 정렬한다.
- 표시 범위/VPC/계정 등 필터 칩을 검색창 내부에서 분리해 **VM의 별도 필터 행 규격**(상단 12px·왼쪽 12px·최소 높이 36px)으로 배치했다. 카드·본문·경로·작업 영역의 공통 스타일을 유지한다.
- 칩의 소유 범위 검증·조회 실패 표시·오래된 응답 폐기·필터 해제 동작은 `S2sGatewayFilterChips.vue`로 옮겨 유지했다. 도메인 칩 해제 시 계정/VPC 종속 조건을 함께 해제하고 표시값/검색어는 보존한다.
- **검은 설명문 교정:** 고급 검색의 `.ant-form-item-extra`에 `--ui-text-secondary`를 적용했다. 양쪽 기존 배포에서 실제 색상 `rgba(0,0,0,0.45)`를 확인한 후 수정했다. label/input/select의 VM 기본 색상은 임의로 바꾸지 않았다.

제품 변경은 UI 5개 파일(새 칩 컴포넌트·검색·AutogenView·공통 목록 CSS의 VPN 한정 규칙 제거·기존 테스트 이동/보강)이다. VM 자체의 스타일과 다른 메뉴의 opt-in 규칙은 변경하지 않았다.

## 빌드·배포

구현·빌드 소스: `76ada6219bd53a9d3745980fa67196f0537bd807`. WSL ext4의 기존 #1723 브랜치에서 UI만 빌드했다. **8 suites / 213 tests PASS**, 변경 파일 ESLint PASS, UI production build PASS, git diff --check PASS.

31 GFS2/32 RBD의 활성 `/usr/share/cloudstack-management/webapp`에 UI 정적 자산만 배포했다. 기존 config.json·WEB-INF·META-INF·관리 JAR·PID를 보존했다. 전후 HTTP200과 WEB-INF, 설정 해시 및 기존 FTCTL/신규 필터 행 번들 마커를 확인했다. 관리 서버 재시작·Maven·전체 Cloud 빌드·수동 Actions를 실행하지 않았다.

| 항목 | 31 | 32 |
| --- | --- | --- |
| 백업 | `/root/s2s1723-ui-20261120-044203` | `/root/s2s1723-ui-20261120-044228` |
| PID (전후 동일) | 2900836 | 3221445 |
| JAR SHA256 (전후 동일) | `9d3958219d781111ece30e7e9aeb83ec29f6b98b9c42ffe4a9fded4950a3c841` | `4c2835aa06e63503ec4cbff65c09b01b911024b474fe5d974823c864f48811f1` |

양쪽 index SHA256: `a5ca8715ebf063e19d83e12974e336624e537dc4e949ae414efe8cde71333efc`. Payload SHA256: `79ba71ec552004efe6b5dbd1ffb1bf4ae3d4d0f868aca72ed60265dadb8facdc`. 이전 UI index는 직전 `ui-manifest-025ae706601a.json`으로 배포 전 가드에 사용했다. 배포 로그와 `ui-manifest.json` 참조.

## 재검증

**31/32 × 390/768/1280 × light/dark = 12조건**, 조건당 VM 목록·상세와 VPN 목록·고급 검색·숨김 목록·UUID 오류·상세의 원본 7장, **행렬 84장**을 수집했다. 전후 화면과 최종 상태까지 총 92장이다.

`breadcrumb-audit.json`의 **1,516항목 PASS**:

- 목록/상세에서 VM과 breadcrumb 카드·본문·행·경로·좌우 영역의 padding/margin/display/font/border/radius/gap을 비교했다. 카드 배경·텍스트 색도 대조했다. 제목 길이·필터/버튼 개수에 따른 자연스러운 높이 차이는 강제로 같게 만들지 않았다.
- 추가 버튼과 검색창의 상단 위치 일치, 칩의 실제 텍스트 영역이 도구 모음 아래에 배치됨, 요청 폭=DOM 폭=원본 PNG 치수, 문서 가로 넘침 없음, 1280px 원본의 x=901 반복 화상 없음 확인.
- 설명문 배경 대비 **light 7.557:1 / dark 8.470:1**. 계정 선택 안내 문구도 같은 기준에서 4.5:1 이상이다. UUID 오류 문구는 **light 10.256:1 / dark 8.667:1**로 확인했다. 반투명 글자·오류 배경은 실제 배경에 합성해 계산했다.
- 표시 범위 true→false 적용 후 새 필터 행에서 칩 해제→true 복원. 실제 GET 요청의 fordisplay=false/true와 UI 칩·URL 일치, mutation POST 0. `*-filter-network.json` 참조.
- 기존 프로젝트의 게이트웨이 상세를 조회하고 breadcrumb로 같은 프로젝트/표시값 목록에 복귀했다. 기존 VM/GW는 읽기 전용으로만 확인했고 새 개체 생성·수정·삭제는 하지 않았다.
- 중간 자동화의 프로젝트 선택 드롭다운 복원 click이 실패해, 최종 복원은 키보드 ArrowDown으로 목록을 열고 기본 보기를 선택했다. 이를 제품 기능 실패로 세지 않았다. 최종 Root·기본 보기·다크·viewport/device override 해제를 확인했다.

`audit.py`는 저장된 DOM 측정값과 원본을 대조하는 재현 스크립트다. 원본 PNG를 리사이즈·합성·보정하지 않았다. `evidence-audit.json`에 파일 해시와 텍스트 정규화·인증정보 검사 결과를 기록한다.

## PR·제한

기존 PR #1742에 후속 커밋으로 반영한다. #1723 기능 이슈는 Closed, Epic #1718은 PR 통합과 병합 소스의 최종 검증을 위해 Open을 유지한다. 자동 병합하지 않는다.

이번 변경은 표현·배치 교정이며 기존 실제 mutation/역할 전체 행렬은 반복하지 않았다. 변경한 필터 표시·해제·GET 정합성과 실제 화면을 집중 확인했다. ISP/터널 통신·전체 Cloud 빌드는 수행하지 않았다. 자동 PR 검사 결과와 로컬 검증은 구분하며, 전체 CI 통과를 주장하지 않는다.
