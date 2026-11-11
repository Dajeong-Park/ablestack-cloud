# #1468 SharedFS 최종 UI 정리 — 구현·13번 UI 인수

2026-11-11. 생성 대화상자의 기존 본문을 유지하며 고정 헤더/푸터를 보완하고, SharedFS 목록·상세·15개 탭·관련 대화상자를 VM 표준과 라이트/다크 테마에 맞췄다. 마지막 피드백인 **목록 용량 한 줄+마우스 오버**, **용량·볼륨 상단 24px 간격**, **조회 리본 제거·단일 아이콘/로더·콘텐츠 유지**까지 최종 정규 production UI를 13번에 배포해 확인했다.

이번 인수는 사용자 최신 지시에 따른 **UI 중심 검증**이다. **별도 Cloud API 정상 동작 시험, 클라이언트 I/O, 설정 적용·복원·VM 재시작·자원 생성/삭제는 수행하지 않았다.** UI가 기존 조회 API를 사용하는 과정과 모의 응답 UI 회귀를 별도 API 기능 인수로 세지 않는다. 선행 28개 기능 이슈 전체를 다시 인수했다는 뜻도 아니다.

- 이슈: [#1468](https://github.com/ablecloud-team/ablestack-cloud/issues/1468), Epic [#1438](https://github.com/ablecloud-team/ablestack-cloud/issues/1438), 기존 통합 [PR #1470](https://github.com/ablecloud-team/ablestack-cloud/pull/1470).
- [최종 실제 UI 라이트/다크 갤러리](gallery.md), [개정 설계](../../design/sharedfs-1468-final-ui-20261111/README.md).
- 코드 원장: [최종 UI 수집 정보](evidence/ui-index.json), [배포 결과](evidence/ui-deployment.json), [UI 계약 대조](evidence/ui-contract-invariants.json).
- PR은 Draft·미병합을 유지한다. 별도 목업 PR이나 새 이슈를 만들지 않았다.

## 변경 범위와 기존 동작 보존

제품 소스 변경은 ui/에 한정한다. API·서버·SystemVM·DB migration·게스트 formatter·디스크·MAC은 변경하지 않았다. 실제 DATA는 기존 SPARSE 시험 서비스의 화면만 조회했다. 새 THIN/SPARSE 디스크를 만들거나 기존 볼륨을 포맷하지 않았다.

| 항목 | 반영 결과 |
|---|---|
| 탭 순서 | 상세 → NFS → SMB → iSCSI → NVMe-oF → 용량·볼륨 → 공유 디렉터리 → SMB 서비스 이름 → 구성 백업 → 작업 내역 → 런타임 → 부팅 복구 → 네트워크 → 메트릭 → 이벤트. 기존 조건부 볼륨 통계는 원래 조건을 유지한다. |
| 탐색·콘텐츠 | 기존 ResourceView/ResourceLayout·세로 탭·표·페이지네이션·semantic theme token을 재사용한다. 상세는 정보 표시 전용이다. SharedFS 미지원 코멘트 API는 신설하지 않았다. |
| 프로토콜 툴바 | 중복 콘텐츠 제목 제거. 파란 메인 생성 액션이 좌측 첫 번째, 업데이트, 넓게 보기는 같은 좌측 그룹 끝에 둔다. 기존 ACL·인증 등 개별 기능은 유지한다. |
| 생성 대화상자 | 기존 2열 요약/설정·폭·필드·그룹·순서·기본값 유지. 기존 a-modal을 감싼 SharedFSFormDialog와 footer target으로 기존 버튼만 고정 푸터에 배치한다. |
| 기타 대화상자 | MoldDialog/MoldDialogActions·VM 크기/본문 스크롤·고정 헤더/푸터 사용. 버튼의 loading/disabled·사전 점검·원복/비밀 입력 의미는 유지한다. |
| 다크모드·표 | 범위가 지정된 sharedfs.less의 semantic color·표 헤더·고정 열·설명·비활성 문구·긴 경로/해시·스크롤을 정리한다. VM/볼륨 전역 색상을 덮어쓰지 않는다. |
| 날짜·상태 | 숫자 epoch-ms는 기존 날짜 formatter에 맞게 표시용 변환. 원본 응답·저장값은 바꾸지 않는다. COMMITTED+NOT_NEEDED는 별도 원복 없음으로 안내하고 실패/SQL 대기는 구분한다. |
| 백업 UI | '구성 복원' 문구, 원본 coverage 상태를 보존하는 읽기 표시, 열 폭/가로 스크롤. 다운로드·업로드·복원 요청은 변경하지 않는다. |
| 목록 용량 | 기존 메트릭 목록의 총 프로비저닝+DATA 개수만 한 줄. 사용량·관측 범위·기본 볼륨 크기·시각은 hover/focus 팝오버. 기존 용량 탭 링크 유지, hover 추가 조회 없음. 미관측을 0으로 표현하지 않는다. |
| 용량·볼륨 간격 | 전역 a-space 여백의 간섭을 피하도록 VM detail-tab-toolbar를 사용하고 버튼 그룹과 첫 요약 사이 24px 확보. |
| 제거 작업 내역 | 실제 미등록 history 아이콘의 빈 원을 기존 등록된 ClockCircle 아이콘+라벨로 교정. 기존 action·조건·삭제 계획은 유지한다. |

## 리본·로딩·콘텐츠 깜빡임

- 조회 중 상단 정보 리본은 제거하고 실제 조회 실패 안내/재시도는 유지했다.
- 업데이트 버튼의 ReloadOutlined를 AntD **icon slot**에 유지해 기존 loading 속성이 아이콘을 spinner 한 개로 교체하게 한다. 완료하면 같은 위치의 아이콘으로 돌아온다.
- 동일 자원 재조회에서는 기존 행·식별 정보·진단을 유지한다. 최초 조회만 기존 초기 로딩을 사용한다.
- 다른 자원/범위 전환 시 캐시 초기화·오래된 응답 차단·진행 중 작업 보호는 유지한다. 표시만 quietRefresh로 조정하고 실제 loading/readPending을 보호 로직에 계속 전달한다.
- [실제 NFS 500ms 지연 관찰](evidence/nfs-refresh-proof.json): 전/중/후 리본 0개, 전체 콘텐츠 spinning 0개, 기존 8개 표와 NFS 공유/ACL 행 동일. 아이콘/로더 수는 **1/0 → 0/1 → 1/0**, 버튼 폭은 전·중 **105.53125px**로 동일했다.
- 실제 SMB/iSCSI/NVMe-oF 업데이트 중에도 게시된 행과 표가 유지되며 전체 베일이 없음을 확인했다. 오류 안내와 안전 조건을 숨기는 변경은 하지 않았다.

## 실제 UI 검토

Chrome의 실제 Mold UI를 사용했다. 주 서비스 edff302a-84bc-4e80-9b14-1884f9d13d49(10.10.13.227)의 구성·공유·DATA는 변경하지 않았다. 별도 AD/온라인 확장 지원 분기 서비스는 기존 자원의 폼 열기·취소로만 검토했다.

| 검토 범위 | 관찰 결과·경계 |
|---|---|
| 목록/상세/15개 탭 | 최종 배포본에서 라이트·다크 전환, 실제 기존 행·설명·툴바·세로 탭 순서·긴 텍스트·페이지네이션 확인. 최종 이미지 52장. |
| 목록 용량 | 실제 셀 높이/line-height 21px, nowrap. 팝오버 5개 정보 행과 용량 탭 링크 확인. 기본 목록/메트릭 모드의 기존 열 조건 유지. |
| 용량·볼륨 | 버튼과 첫 요약의 간격 -5px에서 24px로 교정. [최종 측정](evidence/capacity-spacing-proof.json). |
| 생성 | NFS·SMB·iSCSI·NVMe 선택 분기, 취소/재진입, desktop 1120px body의 300/804px 요약/설정 유지. 확인은 입력 미완료에서 비활성. 제출하지 않음. |
| 작은 화면 | 실제 CDP viewport 1366×768·390×844 확인 후 override 해제. 390px에서 header/body/footer가 화면 안에 있고 footer bottom 832≤844, 요약/설정 겹침 없음. [측정](evidence/creation-mobile-proof.json). 원래 반응형 1열 순서 유지. |
| NFS/SMB | 생성·편집·ACL·SMB 클라이언트/생성 정책·AD 이름/재가입 폼 열기·취소. 비밀값 새 입력/저장 없음. |
| iSCSI/NVMe | 대상·ACL·서브시스템·namespace·host ACL 폼 열기·취소. 기존 미지원 항목의 비활성 조건 유지. |
| 디렉터리·작업 내역 | 디렉터리 편집/POSIX 폼, 영수증/최초 실패 진단, COMMITTED 이력 안내 확인. 실제 정책/권한 변경은 없음. |
| 관리 대화상자 | 리소스 편집·컴퓨트 지원/미지원·준비 상태·DATA 기본 보존 제거 계획·백업 업로드·복원 검토·런타임 업그레이드/원복 폼. 읽기 검토 후 취소, 실행하지 않음. |
| 카탈로그 | 최종 목록/상세/감사 이력/등록 대화상자, 고정 푸터와 검증 전 disabled 상태 확인. 게시/중지 등 전이 실행하지 않음. |
| VM 표준 회귀 | 최종 배포 UI에서 기존 Windows VM 상세/NIC를 읽기 확인. VM 공통 레이아웃·기존 행 표시 정상, 추가/삭제 없음. |
| 한국어/영어·키보드 | 주 인수는 한국어. 영문 용량·백업의 새 레이블/날짜·배치 smoke, 키보드 포커스·취소·넓게보기/복원 검토. 기존 UI 전체 번역 인증으로 확대하지 않음. |
| 환경 복구 | 최종 한국어 표시·다크모드·메트릭 기본값·1920×927 viewport, 임시 지연/viewport override 해제, 열린 폼 0, 최종 탭 console error 0. HTML lang=en-gb는 기존 정적 속성이므로 실제 표시 언어와 구분한다. |

[단계별 폼 33장](gallery.md#단계별-폼-검토-최종-버전-사진과-구분)은 앞선 구현 검토 이미지다. 최종 버전 52장·버전 원장과 구분했으며 중간 산출물을 최종 배포본으로 주장하지 않는다. 최초 조회 직후의 기존 loading이 나타날 수 있는 캡처와 동일 자원 재조회의 콘텐츠 유지 시험도 구분한다.

기존 전역 '조치가 필요한 경보 2건'과 과거 작업의 FAILED 기록은 유지했다. 이를 이번 UI가 새로 발생시킨 제품 오류로 판단하거나 경보를 삭제하지 않았다. 이번 UI 인수에서 새 제품 기능 오류는 관찰되지 않았다.

## 로컬 검증과 보존 증거

| 확인 | 결과 |
|---|---|
| 로컬 UI 회귀 | **27 suites / 243 tests PASS**. [로그](evidence/ui-regression-v2.log). 실제 Vue/Autogen/SharedFSTab 모달·조회 경합·보호·생성/오퍼링·기존 탭·이력/백업 계약을 모의 API 응답으로 시험한다. |
| UI lint | PASS. [로그](evidence/ui-closure-lint.log). |
| 정규 production UI build | 최종 소스 2d0179f4a64에서 기존 npm run build 성공. [로그](evidence/ui-build-acceptance.log). Actions·Maven 빌드 미실행. UI만 변경되어 서버 모듈 빌드는 필요하지 않다. |
| API 호출 소스 비교 | 변경 대상 29개 파일의 getAPI/postAPI/callAPI **95개 AST 호출 구문 동일**. API 실행 시험이 아니다. |
| 생성 본문 보존 | footer 제외 원래 template 및 원래 SFC CSS 동일. 본문 SHA256 fc4d119f312db13b6b78220b6f7d745d5d944741f4c5232f3d8eea91d63443db. |
| 주의 | 같은 범위 readComplete/표시 캐시·toolbar 상태의 UI 분기는 의도적으로 바뀌므로 모든 메서드가 byte-identical하다고 주장하지 않는다. 서버 권한/잠금/기존 API 입력을 바꾸지 않는다. |

## 최종 배포

- UI source: 2d0179f4a64edad940a34e7082b0e1f845fd5036.
- UI index SHA256: ca28d87c4f3a605c4467e3d9f8f674b7ebc12ba67c982de06d0ec3968bd4e331.
- 대상: 10.10.13.10 /usr/share/cloudstack-management/webapp. 파일 manifest·무결성 검증, 운영 config/color 제외, index를 마지막에 교체. 실패 시 정적 파일 원복 경로를 유지했다.
- 관리 서버 JAR SHA256 보존: aef93d4371defacdc5cb595ce1548d841be1c16864dac0c642ff4988bd143d10.
- config.json SHA256 보존: 71c175523a2e251faf574bd5d977c37e81d21c9cc0b8a98dfb1642c6b8a448d7.
- color.less SHA256 보존: 2d1ff56949d9f970fae62b2711326f582c88bef79ec799f1fd2cef7e1d0174a9.
- mold.service active, /client/ HTTP 200. 관리 서버 재시작·Host agent·SystemVM 교체 없음. DB migration 없음.
- 중간 review 빌드는 최종 정규 production 빌드로 교체했다. 저장소 build 설정을 변경하지 않았다.

## 코드 기록과 완료 범위

| commit | 내용 |
|---|---|
| 900190ad10e | 탭·VM 표준·고정 대화상자·다크모드와 생성 본문 보존 |
| 2b2e3ba9425 | 조회 리본 제거·단일 로딩 아이콘·동일 자원 콘텐츠 유지 |
| b7e39176501 | 네이티브 icon slot·작은 화면 경계·표 폭·스크롤 |
| cf338174a31 | 목록 용량 한 줄/hover·용량 탭 간격 |
| 2d0179f4a64 | 제거 작업 내역 빈 아이콘/라벨 보정 |

로컬 Europa를 먼저 45944c40dedef7ff6b377db94225cf598c82739d로 upstream과 0/0 동기화한 Epic 브랜치를 유지했다. 구현은 origin/epic/1438-sharedfs에만 push하고 기존 upstream PR #1470에 반영한다.

**#1468은 위 UI 범위의 구현·로컬 검증·13번 배포·실제 화면 인수를 완료했다.** 사용자가 이번 단계에서 제외한 독립 API/클라이언트/데이터 기능 시험을 PASS로 채우지 않는다. 선행 기능의 완료/제약은 각 이슈의 최종 기록을 따른다. #1467 취소 결정을 보존하며 다음 신규 기능 이슈에는 착수하지 않는다. Epic PR 병합과 통합 결정은 별도다.
