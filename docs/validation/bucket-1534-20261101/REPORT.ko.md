# #1534 Object Store UUID 필터·소속 버킷 검증

기존 `dhslove/epic-1527-buckets` 브랜치에서 구현하고 31 GFS2/32 RBD에 동일 실행 JAR·정적 UI를 배포했다. 두 Mold 모두 32번 Glue를 사용한다. PR #1541은 미병합, Epic #1527은 8/13 완료 상태로 유지한다. 다음은 #1535 소유 계정·도메인·프로젝트 생성 UI다.

## 문제와 구현

실제 Object Store UUID가 기본 스토리지 entityType으로 해석되어 431로 거부됐다. ObjectStoreResponse로 고치고 QueryManager에 store ID·IDs IN 조건을 연결했다. 페이지 전체 count와 후보 ID 순서를 보존한다. UI는 저장소 이름 검색/선택, UUID URL, 상세 소속 버킷 탭과 삭제 전 종속 확인을 제공한다. 표의 상태·KiB/GiB·계정·프로젝트와 상세 연결을 확인했다. API가 도메인 이름을 주지 않는 기존 행은 `—`로 표시한다.

## 실제 API와 UI

| 검증 | 31 | 32 |
|---|---|---|
| Object Store 실제 UUID·없는 UUID·기본 스토리지 UUID | PASS | PASS |
| 저장소 A 일반3/프로젝트 포함5, B 일반1/포함2 | PASS | PASS |
| name/keyword/ids/account+domain 또는 project 교집합 | PASS | PASS |
| 2개씩 페이지 1/2/3 = 2/2/1, 전체5·중복/순서 보존 | PASS | PASS |
| 이름 변경 후 동일 UUID와 새 표시 이름 | PASS | PASS |
| 실제 목록·선택 목록 오류 안내와 재조회 복구 | PASS | PASS |
| A 조회 지연 중 B 전환: 대기 중 이전 행0, B 1행 유지 | PASS | PASS |
| 명시적 프로젝트 URL 인계·헤더 프로젝트 전환 | PASS | PASS |
| 일반 사용자 UI 자기 버킷3·관리자 저장소 선택 숨김 | PASS | PASS |
| 비어 있지 않은 저장소 삭제 차단·검색상0도 차단 | PASS | PASS |
| 최초 조회503은 Unknown, 성공0 후에만 삭제 가능 | PASS | PASS |
| UI 사전0 확인 뒤 새 버킷 생성 시 최종 서버 삭제 거부 | PASS | PASS |
| 실패 후 재조회→버킷1/차단, 비운 후 등록만 UI 삭제 | PASS | PASS |

API case 기록은 각각 23/23개다. 없는 Object Store·기본 스토리지 UUID와 id+ids 혼합은 431이다. 기존 REST dispatcher는 일반 사용자의 root 전용 objectstorageid 인자를 제거한다. 해당 사용자는 다른/없는 store UUID를 넣어도 동일한 자기 ACL 범위만 받는다. 이를 새 필터 허용이나 서버 거부로 오기하지 않는다. service layer의 비root 내부 store ID 거부도 단위 검증했다. default 목록은 일반 범위, projectid=-1/listall=true는 프로젝트 포함 범위다. account/project 동시 지정은 기존 계약대로 거부한다.

503은 CUA의 개발용 XHR fault injection으로 UI 실패·복구를 재현했다. 정상 결과는 실제 Mold/Glue 응답이며 성공 데이터를 조작하지 않았다. 시험 뒤 모든 interception과 viewport override를 해제했다. 이전 응답을 해제한 뒤 새 UUID 범위가 유지되는지와 generation/role/session 변경 단위 회귀를 확인했다.

최종 UI에서 기본 보기→명시적 projectid+store UUID 진입과 현재 프로젝트 URL 인계는 UUID를 유지한다. 헤더로 실제 프로젝트를 바꾸면 선택을 지운다. 역할·세션 변경은 명시적 프로젝트 URL이 있어도 초기화한다. 처음 실측에서 발견한 기본 보기 진입 필터 소실을 고치고 회귀 테스트를 추가했다.

## UI 표준과 테마

최종 배포 화면 37개에서 라이트 최소 4.97:1 / 다크 최소 5.19:1, 활성 텍스트 4.5:1 미달0건, 문서 가로 넘침0건, 대기 스피너0건을 확인했다. 360/768/1280px 소속 표, 필터와 삭제 대화상자, VM의 공통 조작·레이아웃 패턴을 비교했다. 새 탭·대화상자 버튼은 32px/14px, 툴바/하단은 줄바꿈하며 넓은 표는 포커스 가능한 내부 영역에서 스크롤한다. 프로젝트 스위치·선택 페이지·링크·placeholder는 공유 theme token을 따른다. 실제로 그려진 텍스트 노드·placeholder 색과 조상 배경 합성으로 측정했다. 비활성 조작, 장식용 breadcrumb 구분자와 aria-hidden 요소는 활성 텍스트 대비 기준에서 제외한다.

목록의 VM 공통 breadcrumb는 부모 패딩 밖으로 펼쳐지는 기존 구조이며 root scrollWidth 수치만으로 문서 넘침으로 판정하지 않는다. 실제 문서 폭, 새 조작의 경계와 내부 표 스크롤을 함께 확인했다. JPEG 원본 시그니처·SHA256·디코딩 픽셀 크기를 별도 기록했다. CSS viewport와 native 이미지 픽셀 크기가 다를 수 있다. 화면 이미지는 원본이며 재인코딩·확대하지 않았다.

## 빌드·배포·보존

변경 Maven 모듈 api/server만 WSL ext4에서 빌드했다. Backend 집중/이웃·키 보안 22건, 변경 Java3개 Checkstyle, UI9 suites/133건, 변경 UI lint와 production build를 통과했다. 전체 Cloud/Full CI/GitHub Actions/qemu 빌드는 실행하지 않았다. 전체 소스 coverage 수집은 중단했고 집중 테스트는 coverage=false로 정상 종료했다.

Backend source `272c021eb076c64425ebd7ebd2247da715026ff2`, UI source `c44543cb697bc95694cc0851e4ccb3c25cf11982`. 현재 source와 Java/UI production hash 일치를 별도 검증했다. 양쪽 JAR `cf67f9c0a16df6bf87d00c2af0e7eb99bec3f2231db15d76818c0726567bcc13`, index `aff08c995b97a92aadf0955a433c007553403b059869f625d0fe1aad9e2af8ae`. 실행 라이브러리9개와 static 642개 hash가 같다. WEB-INF·설정·나머지 라이브러리·UI 배포 전후 management PID를 보존하고 HTTP200/Mold active를 확인했다. 변경 JAR4 records를 overlay하고 나머지204636 records 원본 hash를 보존했다. RPM 버전 메타데이터나 호스트 패키지는 변경하지 않았다. 32번 root 여유는 최종 581971968 bytes이며 UI staging은 /nfs를 사용했다.

초기 배포 readiness 요청에서 pagesize만 지정하고 page를 생략해 431이 났고 안전 rollback이 실행됐다. probe에 page=1을 명시한 뒤 새 배포와 실제 필터를 검증했다. 또한 ids 검색이 SQL에 빠져 있던 기존 결함을 실측으로 발견해 조건 선언을 추가했다. 최초 재현/중간 배포 기록과 최종 결과를 구분한다.

QA 버킷16·Object Store6·일반 계정4·프로젝트4와 해당 프로젝트 계정 자격 증명·QA RGW 사용자9개를 정리했다. 수동 DB counter 보정 없이 잔여 credential/reservation/pending operation0, 원래 account details hash를 확인했다. Mold별 host3대Up, Glue HEALTH_OK/RGW3/3이며 기존 FT Windows/WSL 작업본의 HEAD·상태·diff를 보존했다. 시험 키 20개 값의 관리 로그·journal과 공개 source/증거/본문 노출0건이다. 삭제 race 전/후 DB/API/실제 S3의 버킷과 저장소 존재를 확인했다.

[확인용 qa-bkt-1540-32-files](http://10.10.32.10:8080/client/#/buckets/3e952d59-a311-4a2b-86fe-d66ed38f050c?tab=browser) 하나와 원래11개 raw 객체 byte SHA256·계정 상세·키·요청/실제 보호 설정을 보존했다. 브라우저 최상위8행과 loading0을 실제 UI에서 재확인했다.

공개 텍스트(JSON·로그)는 읽기 편하게 LF와 줄끝 공백만 정규화했다. 원본은 비공개 검증 경로에 유지했다. 현재 HTTP Glue의 암호화 지원 제한 등 #1530 검증 한계는 변경하지 않는다. 외부 고객 테넌트·도메인 관리자 전체 조합, 전체 Cloud CI를 이번 완료로 주장하지 않는다.

[최종 설계](../../design/bucket-1527/1534-object-store-buckets.ko.md) · [누적 진행](../../design/bucket-1527/README.ko.md) · [Epic #1527](https://github.com/ablecloud-team/ablestack-cloud/issues/1527) · [PR #1541](https://github.com/ablecloud-team/ablestack-cloud/pull/1541).
