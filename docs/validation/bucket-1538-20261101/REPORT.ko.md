# #1538 표준 HEAD 객체 메타데이터 검증

2026-11-01, `dhslove/epic-1527-buckets`, Epic #1527 / PR #1541. 31 GFS2·32 RBD Mold와32번 Glue를 사용했다.

## 변경 결과

MinIO 확장 목록 metadata=true에 의존하던 상세를 Cloud의 `getBucketObjectMetadata(id, objectkey, versionid?)`로 교체했다. 소유 ACL을 먼저 확인하고 기존 tenant resolver로 표준 S3 HEAD를 실행한다. 필요한 key/versionid/sizebytes/Last-Modified/ETag/Content-Type/metadata/checked/status만 반환한다. 추가 관리자 키나 임의 endpoint/header를 받거나 반환하지 않는다. 일반 목록은 표준 listObjectsV2이며 상세를 선택할 때만 HEAD를 수행한다.

Available의 빈 metadata, NotFound, Forbidden, Timeout, Unavailable, Unsupported를 구분한다. Unsupported의 기본 목록 값은 HEAD 미검증으로 명시한다. HTML은 텍스트로 표시한다. 수동 URL decode/경로 정규화 없이 한글·공백·예약문자·%2F·선택 versionId를 보존한다. POST/no-store와 요청·응답 로그 보호를 적용한다. 기존 bucket.size KiB와 새 sizebytes를 구분하며 DB 크기/통계/할당량을 바꾸지 않는다.

패널은 계정/역할/세션/API 권한/project/bucket/URL/credential revision/key/version/tab/변경 revision으로 scope를 제한한다. 캐시는 인스턴스 메모리10초/20개 성공만 저장하고 강제 재조회·실패·변경에서 무효화한다. 동시 요청을 합치고 늦은 응답을 폐기한다. 닫기/탭 전환은 Drawer 자체를 제거해 mask·포털·인스턴스를 정리한다. [상세 계약](../../design/bucket-1527/1538-object-metadata.ko.md).

## 빌드·배포

- Java 실행 소스 `b57560dbd04b6c3c7280e4940d0d0636de4c08eb`, UI 실행 소스 `a7a9d277b15f5765bf2d91ab9ead490e9684a337`. 최종 문서 head와 실행 소스의 일치를 별도 hash로 확인했다.
- WSL ext4에서 api, engine/api, plugins/storage/object/ceph, server 변경 모듈만 빌드했다. Java109(Ceph37+server70+HTTP/로그 보호2), UI13 suites/212개와 lint/14개 Java 파일 checkstyle/UI production build 통과. 전체 Cloud/Actions/qemu 빌드는 실행하지 않았다.
- JAR SHA256 `4511c2f63800b9b46c2863a661f6e29b0fc6cc91be8cbf4d036a5a0ecbadc1ad`. 변경 클래스/marker26개 외 204625 ZIP entry의 byte hash가 같다. 양쪽9개 라이브러리가 일치하고8개 원본을 유지했다. schema 변경 없이 기존 nullable5 usage 열을 보존했다.
- UI `js/app.c38df04c.js` + `css/app.db82d5ce.css`, index SHA256 `4052ae941c7a8a9e0c15375ad038533057d9cb29ab026b6542f7c96dd158cfe9`, 정적 자산642개 양쪽 hash 검증. static allowlist만 배포해 WEB-INF·설정·서버 디렉터리와 Mold PID를 보존했다. /client/ HTTP200, host각3대 Up, Glue HEALTH_OK/RGW3대 running.
- 최초31 후보는 수동 command registry 누락으로 readiness Unknown API를 검출해 기존 JAR로 자동 원복했다. ManagementServerImpl 명시 등록 후 최종 양쪽 readiness에서 일반·0바이트·한글 과거 버전3건 실제 HEAD를 통과했다.
- 실제 UI에서 Drawer 포털 중첩과 상단 고정 경보 배너가 제목/닫기 클릭을 가리는 위치를 확인했다. 키보드 Escape 닫기는 정상인 반면 헤더 클릭이 가려지는 재현을 구분했다. 기존 --autoBannerHeight로 Drawer top/남은 높이를 조정하고 tab/deactivated/active guard와 실제 탭·선택 상태 v-if로 포털 수명을 제한했다. 설치된 Alert action 슬롯의 재시도 미표시는 독립32px 버튼으로 고쳤다. 실제 설치 컴포넌트의 포털 제거·버튼 렌더링/클릭 회귀와 최종 native 재검증을 수행했다. 포털 전체 측정에서 기존 공유 URL 복사 버튼3.24:1도 발견해 VM 공통 action/label token의 포털 적용 범위를 보완했다. 기능 회귀는 app.c38df04c.js/3193 소스에서 수행했고 이후 변경은 이 CSS 범위와 설계 문서뿐이다. 최종 스타일12뷰와 최종 핵심 상세/닫기를 새 bundle/CSS에서 재확인했다. 이전 대비 미달·중간·실패·중단 증적은 최종 스타일 PASS 집계에서 제외한다.

## 기능 검증

| 항목 | 31 | 32 | 근거 |
|---|---|---|---|
| 수정 전 실제 HEAD의 qa-note가 UI에는 누락 | 재현 | 재현 | before-* |
| 최신/과거/null 버전의 key/versionid/size/ETag/type/map/time 실제 HEAD 정합 | PASS | PASS | metadata-api-qualification, final-version/unicode/null |
| 한글·공백·+·%2F·#?&·중첩 경로 보존 | PASS | PASS | final-unicode, nested |
| 0바이트·진짜 metadata 없음·HTML literal 안전 표시 | PASS | PASS | zero, no-metadata, html |
| UI metadata 입력/덮어쓰기 후39바이트·ui-updated 표시 | PASS | PASS | ui-upload-updated, ui-upload-head-comparison |
| 실제404·403/503·timeout·부분·501/Unsupported 및 복구 | PASS | PASS | actual-404, head-*, metadata-api-failures |
| 오류와 빈 metadata 분리·목록 유지·실제 재시도 버튼 복구 | PASS | PASS | 최종 failure/recovery 증적 |
| Root·일반 소유자·하위 도메인 관리자·프로젝트 멤버 | PASS | PASS | API ACL, native 로그인/프로젝트 선택 |
| 외부 계정/도메인/비멤버 거부·제한 역할 UI 안내/API432 | PASS | PASS | ACL, restricted-role, role-metadata-denied |
| 선택·닫기·탭·버킷 전환의 늦은 응답 폐기 | PASS | PASS | final-late/tab 및 UI 회귀 |
| 목록 갱신/폴더 탐색의 per-object HEAD0 | PASS | PASS | list-no-per-object-head, 최종 재검증 |
| GET400/no-store·비밀 로그 보호·읽기 전후 ledger 불변 | PASS | PASS | API qualification/security tests/hash |

오류는 전용 QA Object Store의 signed passthrough proxy에서 선택 HEAD만 조작했다. 일반 S3 작업·사용자 보존 저장소는 정상 경로다. 기존 provider 기본 Unsupported는 단위 경로, live501은 모의 미지원 응답이며 실제 Glue 미지원으로 확대하지 않는다. 기존5초 연결/15초 소켓/25초 client 요청 제한을 쓰며 네트워크와 UI 스케줄링 전체를25초로 보장하지 않는다. 정상 목록에 N HEAD가 없고 조회는 읽기 전용이다.

## VM 표준·테마·반응형

양쪽 VM 메뉴에서 공통 Ant Design·14px/32px 기준을 직접 비교했다. VM 주 작업은 round toolbar이고 내부 상세 작업은4px 모서리 제어다. 기존 VM 공통 theme token과 Drawer·MoldDialog를 사용한다.

최종 light/dark×360/768/1280×2클러스터12개 화면에서 파일 목록과 **포털 Drawer 안** dt/dd/설명/오류/재시도/긴 key를 포함해 합성 배경 대비를 계산했다. 최소 **4.97:1**, 대비 미달0건, 문서 가로 넘침0건. Drawer 본문 내부 스크롤로 긴 값을 볼 수 있고 화면 밖 제어0이다. disabled 제어는 대비 집계에서 제외한다. native JPEG를 재인코딩하지 않고 서명·SHA256·decoded 치수/viewport를 검증했다.

## 정리·보존·후속

전용 QA12버킷/4저장소/12계정/6프로젝트/6도메인/2역할 및 모든 버전·삭제 표식·QA RGW 사용자, proxy와 정확한 임시 firewall 규칙을 제거했다. 활성 QA/credential/예약/진행 중 quota operation은0이며 수동 카운터 보정은 하지 않았다. 원래3개 RGW 사용자와 확인용 버킷 하나만 남는다. 기존 Windows/WSL FT 변경의 HEAD/status/diff를 보존했다.

**qa-bkt-1540-32-files** 기존11객체의 이름·크기·raw S3 SHA256/계정 상세/Glue 키/Private·비암호화·객체 잠금 해제 설정을 보존했다. UI에서 **메타데이터 확인 1538.txt**61바이트·qa-note=standard-head-1538 예제 한 개를 추가해 현재12객체다. 원래 baseline과 별도 추가 객체 hash를 합쳐 정확히 검증했다. [확인용 브라우저](http://10.10.32.10:8080/client/#/buckets/3e952d59-a311-4a2b-86fe-d66ed38f050c?tab=browser).

#1538 완료 후 Epic **12/13**, 다음은 **#1539 Object Store 용량 단위·수정 초기값과 연결 상태 관리 개선**이다. PR #1541은 OPEN·미병합, Epic #1527도 OPEN이다. 집중 검증을 전체 Cloud CI 성공으로 확대하지 않는다.

참고: [AWS HeadObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html), [사용자 metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html).
