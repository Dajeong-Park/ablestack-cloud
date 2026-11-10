# #1544 모바일 테마 즉시 전환 및 설정 패널 개선

2026-11-02 Asia/Seoul. 별도 dhslove/mobile-theme-1544 작업트리에서 UI만 변경했다.

## 원인과 구현

기존 테마 클래스 적용·초기화·OS 리스너가 Logo와 UserLayout에 흩어져 있었다. 모바일에서 닫힌 사이드바의 Logo가 생성되지 않으면 라디오 선택과 실제 화면이 달라졌고, 화면을 넓혀 Logo가 생성될 때 뒤늦게 적용됐다. 로그인 화면 해제 시 dark-mode 클래스를 지우는 경로도 있었다.

- App의 단일 themeController가 저장값(없으면 OS)을 한 번 초기화하고 Vuex darkMode를 immediate/sync watch해 html/body와 layout-mode를 함께 갱신한다.
- Logo·UserLayout은 로고만 계산한다. 사이드바 생성·페이지/인증 전환이 테마 초기화·삭제나 OS 리스너 중복 등록을 일으키지 않는다.
- OS 리스너는 App당 하나이며 정확한 함수 참조로 해제한다. 이후 OS 변경을 저장 모드에 반영하는 기존 정책을 유지한다. Setting의 선택 표시도 공통 상태를 따라간다.
- 실제32번 모바일에서 배너123px이 설정 Header(y=0)와 라이트 라디오(y=108.8px)를 가려 포인터 입력이 배너에 도착하는 문제를 추가 확인했다. 설정 Drawer를 공통 배너 offset 아래로 배치하고 Header 고정·본문 스크롤·동적 viewport 높이를 적용했다.

## 검증

집중 검사4 suites/29 tests PASS, 그중 테마 수명주기9조건이다. 실제 App·로그인 Layout·Logo와 설정 라디오를 포함해 저장값/OS 초기화, 모바일 양방향 변경, 로그인 경로 전환, 사이드바 반복 생성, OS 선택 동기화, 단일 리스너·해제를 검증했다. ESLint PASS. 전체 Cloud/Maven/qemu/Actions 빌드는 시작하지 않았다.

WSL ext4 UI production build PASS. 소스 `df335f8f68988cd9d02a36a45b0776f36d167213`, 앱 `js/app.e525cc67.js`, CSS `css/app.cb968b5d.css`, index SHA256 `5a861b1acdad3f83b2f9bff355b77db200cb43764d99c9f4827248064966697c`. 31/32 정적647개·런타임 라이브러리9개 해시가 일치한다. WEB-INF·기존 config·라이브러리·PID를 보존했고 /client/HTTP200, Mold active, 호스트 각3대Up, Glue HEALTH_OK/RGW3 running이다. production JS의 OS 테마 미디어 선언은1개다.

31/32 × 버킷/VM × 라이트/다크 × 360/768/1280px **24뷰**의 테마·화면 이동·반응형을 확인했다. 모바일 양방향 입력4건 모두 크기·URL 변경 없이 선택, html/body 클래스, 실제 배경이 일치했다. OS 양방향 에뮬레이션4건 후 기본값으로 복원했다. 양쪽 모바일 로그아웃→로그인과 새로고침에도 다크모드를 유지하고 사이드바를 각3회 열고 닫아도 선택이 유지됐다.

32번 배너123px에서 설정 Header y=123px/라디오 y=231.8px/hit-test 성공이다(기존 y=0/108.8/경보에 도착). 360×640 양쪽 설정창의 Header 고정·본문 단독 스크롤을 확인했다. 생성(31/32)·업데이트/업로드(32)의 다크360/1280px **8조건**을 확인하고 한글 메타데이터4행은 취소했다. 버킷 샘플 최소 대비4.97:1, 폼5.19:1, 설정 패널 라이트6.98/다크7.13:1이다. 생성·설정 변경·업로드는 저장하지 않았다.

VM 목록의 기존 대비 미달은 남아 있다. 가상머신 추가(14px/400)는3.24:1, 검색 placeholder는 라이트1.84:1·다크4.18:1이다. 테마 수정에서 VM 팔레트를 변경하지 않았으며 전체 가독성 PASS로 취급하지 않는다. [측정·후속 근거](evidence/legacy-vm-contrast.json)를 별도 VM 토큰 적용 이슈에 등록하고 다음 작업으로 제시한다. 공통 모달 기반 #1214의 완료 범위를 대신하지 않는다.

## 보존

확인용 qa-bkt-1540-32-files는 시작 시13개 객체였다. 테스트는 조회·화면 이동·테마 및 폼 입력 후 취소로 수행하고 버킷의 객체/키/보호 설정을 변경하지 않았다.

검증 후13개 원본 바이트·버전/표식·키/revision·계정 상세·요청/실제 보호가 시작과 동일했다. [보존 비교](evidence/retained-comparison.json)를 확인한다. FT 포함 dirty 작업트리의 HEAD·diff·변경/미추적 파일 해시는 병합·동기화 후 재비교한다.

검증 소스와 PR head를 고정해 병합하고 Windows/WSL Europa·origin/upstream 일치 후 #1544를 종료한다. 최종 병합·보존·동기화는 PR 완료 본문과 별도 완료 보고서에 남긴다. 등록 CI·전체 Cloud CI는 집중 검사·실제 UI와 구분한다.
