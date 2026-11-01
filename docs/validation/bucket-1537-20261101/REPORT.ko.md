# #1537 버킷 사용량 수집·최신성·실패 복구 검증

2026-11-01, `dhslove/epic-1527-buckets`, 상위 Epic #1527 / PR #1541. 31 GFS2·32 RBD Mold와 32번 Glue를 사용했다. 사용자 보존 자원은 `qa-bkt-1540-32-files`다.

## 변경 결과

브라우저의 **목록 업데이트**와 **사용량 동기화**를 분리했다. 브라우저·요약·상세에 마지막 성공 시각/마지막 시도/최근 수집 성공·재수집 필요·수집 실패·미확인 상태를 표시한다. 업로드/삭제 성공 후 통계만 실패하면 별도 경고를 표시하고 통계만 재시도한다. 기존 size/storageused 단위는 KiB를 유지한다. 인프라 상세의 storageused만 표시 시 bytes로 변환한다.

Glue는 버킷 이름·소유자·instance를 검증하는 단일 버킷 통계 조회를 사용한다. 누락/오류/불완전 응답을 0으로 저장하지 않는다. 제공자 통계가 0인 경우 모든 버전의 논리 크기와 multipart를 추가 확인한다. 실제 빈 버킷과 0바이트 객체가 있는 버킷은 삭제 계약상 구분한다. 기존 제공자 fallback은 명시적으로 표시한다.

명시/주기 수집은 동일 coordinator를 사용한다. 요청별 소유 ACL을 먼저 적용한 뒤 같은 버킷의 요청을 합치고 기존 store GlobalLock을 공유한다. 성공 시 bucket·단일 통계 행·활성 버킷의 마지막 알려진 값으로 계산한 store 합계를 한 transaction으로 갱신한다. 실패 시 크기·마지막 성공 시각·카운터·예약을 유지하고 Error/시도 시각만 기록한다. provider I/O는 transaction 밖에서 제한된 worker와 timeout을 사용한다.

## 빌드·배포

- Java 소스/JAR 기준 `63114517e60973ef6339c425167a9a3b888ed6be`, UI 기준 `3a0cd947de161569d1edbcf37e83a7fc92ce007d`. 이후 검증 문서 커밋은 이 실행 소스와의 일치를 별도 hash로 확인한다.
- WSL ext4 clone에서 변경한 api, engine/api, engine/schema, engine/storage, plugins/storage/object/ceph, server 모듈만 빌드했다. Java 111개(13+4+30+64), UI 12 suites/183개 통과. 집중 lint/checkstyle와 UI production build 통과. 전체 Cloud/Actions/qemu 빌드를 요청하거나 실행하지 않았다.
- 실행 JAR SHA256 `d7809c909583b7316f1234c091d8f773d1d6aebd49e57be32fa6adfd9ad817e9`. 기본 JAR의 변경 대상 외 204626 ZIP entry를 byte 단위로 보존한 클래스/resource overlay다. 양쪽 9개 실행 라이브러리 hash가 일치하며 8개는 원본 그대로다.
- 최종 UI `app.35625b8f.js + app.a39f75e8.css`, index SHA256 `b7be9b9461d80ef5384c0e0130167534ca85416f36c949ac9d79fc15165ad996`, 정적 자산 642개를 양쪽에서 모두 hash 검증했다. `WEB-INF`·설정·서버 디렉터리를 보존하고 static allowlist만 배포했다. UI 배포 중 Mold PID는 바뀌지 않았다. qemu/호스트 패키지는 변경하지 않았다.
- 기존 Europa에는 같은 버전 재시작으로 upgrade hook이 실행되지 않아 첫 31번 배포가 readiness 실패 후 원본 JAR로 자동 원복됐다. 이후 명시적 멱등 SQL을 추가했다. 두 차례 실행 전후 기존 bucket 값 hash가 같았으며 nullable 5열만 추가했다. 기존 행을 실제 수집 없이 Fresh로 올리지 않는다.
- 실제 API 검증에서 발견한 Date bind 누락은 @Temporal(TIMESTAMP)로 수정하고 실제 GenericDao 바인딩 회귀를 추가했다. 레거시 날짜의 초 정밀도와 별도로 monotonically increasing ms 시도를 저장해 같은 초의 빠른 재시도/늦은 응답을 구분한다. 최종 readiness는 양쪽에서 같은 버킷을 2회 연속 실제 수집해 Fresh/Bucket/4KiB와 증가하는 ms를 검증했다. 최종 로그에 날짜 바인딩 오류 재발은 없었다.

## 실제 UI/API/DB/Glue 결과

| 검증 | 31 | 32 | 근거 |
|---|---|---|---|
| 수정 전 실제 목록 갱신만으로 4KiB 파일/사용량0 재현 | PASS | PASS | before-list-only-*.json/jpg |
| 외부 S3에 2KiB 추가 후 목록에는4+2KiB, 사용량4 유지; 명시 수집으로6 반영 | PASS | PASS | list-only-drift, db-recovered, db-recovery-final |
| bucket/statistics/storeSUM/Glue 논리 KiB와 인프라 UI6.00KiB 일치 | PASS | PASS | api-owner-scope, db-recovery-final, store-used-kib-ui |
| 실제 빈 버킷0, 단일 통계 행; 비어 있지 않은데 provider0이면 기존 값 보존 | PASS | PASS | verified-empty, falsezero-preserved, false-zero-db |
| 503·불완전 통계·404·HTTP timeout 실패, 마지막 성공 값/파일/카운터 보존 | PASS | PASS | usage503/partial/timeout, after-ui-failure, missing-and-partial-db |
| 실패 후 native 재시도와 Fresh/수집 시각 복구 | PASS | PASS | usage503-recovered, db-recovered |
| DB 통계 UPDATE 강제 실패: Glue6인데 bucket/stat/store4로 atomic rollback, 별도 Error; 오류 제거 후6 복구 | PASS | PASS | db-rollback/db-recovery-final; QA 한 행 한정 trigger는 제거 |
| native 8KiB 업로드 성공+통계 실패 분리, retry에 PUT 재전송 없음 | PASS | PASS | upload-succeeded-usage-warning, upload-retry-without-put(각1PUT), raw S3 byte 검증 |
| native 객체 삭제 성공+통계 실패 분리 및 retry 복구 | PASS | PASS | delete-succeeded-usage-warning, delete-success-usage-failed, concurrency |
| 동시6요청→provider1회, 동일 ms 응답, 통계1행, 카운터 불변, foreign caller는 합류 전 거부 | PASS | PASS | concurrency.json |
| Root·일반 소유자·하위 도메인 관리자·프로젝트 구성원 수집 | PASS | PASS | 실제 native role 로그인/프로젝트 선택/수집, api-owner-scope |
| 외부 계정/도메인/프로젝트 비구성원 거부·수집 권한 없는 역할의 UI 액션 숨김+API432 | PASS | PASS | api-owner-scope, sync-denied-role |
| 대기 중 버킷/프로젝트 전환 후 이전 응답이 새 빈 버킷의0/목록을 덮지 않음 | PASS | PASS | late-response-empty, project-transition-after-pending |
| 마지막 성공 시각2h 경과 fixture를 실제 API/UI Stale로 표시, 수집 후 Fresh 복구 | PASS | PASS | simulated-age-stale, stale-age-ui (QA timestamp 조건 주입) |
| 명시적 수집하지 않은 별도 버킷의 첫 주기 수집 성공 | PASS | PASS | periodic-untouched-bucket (재시작 약60초 후 targeted GET/성공 시각/단일통계행) |

통계 지연/오류는 전용 QA Object Store에만 연결한 signed passthrough proxy로 주입했다. 사용자 보존 저장소는 변경하지 않았다. proxy는 통계 GET만 선택적으로 실패/지연/부분/잘못된 영점으로 만들고 일반 S3 작업을 통과시켰다. 정상 통계 반영 지연을 실시간 사용량 보장으로 표현하지 않으며 UI에도 이를 명시한다. 다중 관리 노드의 실제 분산 동시 실행은 별도 실행하지 않았고 공유 lock 경로와 재조회 회귀로 검증했다. 기존 제공자 fallback·중단을 무시하는 provider 상한·미완료 multipart/대규모 버전 경계는 단위 회귀이며 Glue live 성공으로 확대하지 않는다.

## VM 표준·테마·반응형

현재 VM 메뉴를 양쪽에서 직접 열어 공통 Ant Design 동작과 글꼴/버튼 기준을 비교했다. VM 주 작업은32px/14px의 round toolbar, VM 검색은4px 모서리의 small control이며, 버킷 내부 작업은32px/14px/4px 일반 컨트롤을 유지한다. 공통 VM 테마 action/link/text token을 사용한다.

최초 라이트모드 검증에서 기존 경로/상단 링크 대비3.24~3.35:1을 발견해 버킷 범위의 링크·breadcrumb도 VM 공통 token으로 개선했다. 최종 배포 후 양쪽 light/dark×360/768/1280 화면에서 상태·성공 시각·오류·재시도·목록·placeholder·링크를 다시 측정했다. 최소 대비 **4.97:1**, 대비 미달0, 문서 가로 넘침0, 화면 밖 제어0. 표 내부 가로 스크롤은 허용하며 문서 폭을 확장하지 않는다. 증적 JPEG는 재인코딩 없이 native capture를 저장하고 실제 viewport/decoded image 치수·서명·SHA256을 확인했다. 이전 bundle/수정 전 대비 미달 증적은 최종 PASS 집계에서 제외한다. 전체 WCAG 인증은 주장하지 않는다.

## 정리·보존·후속

검증 전용12버킷/4스토어/12계정/6프로젝트/6도메인/2제한 역할 및 해당 RGW 사용자만 정리했다. 활성 전용 자원·자격 증명·예약·진행 작업·fault trigger0. 전용 proxy process와 workstation 한정 임시 firewall rule도 제거했다. 수동 리소스 카운터 보정은 하지 않았다. 원본 확인용 버킷과11객체(raw byte/SHA256)·키·계정 상세·보호 설정/Private을 보존했다. Root/default project/dark mode와 viewport를 복원했다. 양쪽 Mold HTTP200/WEB-INF, 3개 호스트Up, Glue HEALTH_OK/RGW3개 running을 확인했다. 기존 Windows/WSL FT 변경은 전후 비교가 일치한다. 로그 약5GB를22개 관찰 키로 검사해 key matches0이었다.

- [확인용 버킷](http://10.10.32.10:8080/client/#/buckets/3e952d59-a311-4a2b-86fe-d66ed38f050c?tab=browser)
- [최종 설계](../../design/bucket-1527/1537-usage-sync.ko.md)
- [누적 진행 문서](../../design/bucket-1527/README.ko.md)
- 다음 **#1538 Glue 객체 상세 메타데이터를 표준 HEAD 경로로 조회**. 그다음 #1539 용량 단위·수정 초기값·연결 상태다. #1537은 기존 storageused의 사용량 표시 변환만 반영하며 #1539 전체를 해결한 것으로 처리하지 않는다.

Epic은11/13 완료·OPEN, PR #1541은OPEN·미병합으로 유지한다. 집중 테스트 통과와 등록된 GitHub checks/Actions 유무는 구분하며 전체 CI 성공을 주장하지 않는다.

## 화면 증적

- [보존 버킷과 전체 파일 목록](ui/review-browser-final-full.jpg) · [화면 측정](ui/review-browser-final-full.json)
- [라이트모드360px](ui/final-style-31-light-360.jpg) · [다크모드1280px](ui/final-style-32-dark-1280.jpg)
- [모바일 실제 하단 스크롤/페이지 접근](ui/final-mobile-bottom-32.jpg) · [12개 화면 대비 요약](evidence/final-ui-styles-summary.json)
- [원본 JPEG 서명/실제 디코딩 치수/SHA256](ui/evidence-images.json) — 10px 스크롤바를 제외한350/758/1270px 원본 캡처이며 확대·재인코딩하지 않았다.
