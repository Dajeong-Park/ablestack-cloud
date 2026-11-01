# #1538 표준 HEAD 기반 객체 메타데이터 설계

## 문제와 범위

Glue의 표준 객체 목록에는 개별 사용자 metadata가 없다. 기존 MinIO 목록 확장에 의존해 UI에서 업로드한 qa-note가 실제 HEAD에는 존재해도 상세 drawer는 비어 있었다. 브라우저에서 직접 HEAD를 추가하면 CORS expose headers와 추가 자격 증명 처리가 필요하다. 이번 변경은 Cloud가 기존 account/store credential resolver와 소유 ACL을 재사용해 표준 S3 HEAD를 수행하고 필요한 값만 UI에 전달한다. 기존 #1529/#1533 키 보호·#1532 버전/삭제·#1537 사용량 계약은 유지한다.

## API·제공자 계약

`getBucketObjectMetadata(id, objectkey, versionid?)`는 POST 전용이다. 등록된 Cloud bucket UUID를 조회해 caller의 account/domain/project ACL을 먼저 확인하며 Created/활성 버킷만 읽는다. 임의 endpoint/HTTP header/관리자 키는 입력받지 않는다. UTF-8 objectkey를1024byte까지 허용하고 empty/NUL/잘못된 Unicode를 거부한다. 버전 ID는 선택한 값 또는 문자열null 버전을 그대로 전달한다. 파일시스템 경로 정규화나 URL decode를 하지 않으며 SDK가 딱 한 번 인코딩한다. 폴더 prefix/삭제 marker에는 UI 조회 액션을 실행하지 않는다.

응답 `objectmetadata`는 `key`, `versionid`, `sizebytes`(기존 bucket.size KiB와 별개), `lastmodified`, `etag`(주변 따옴표 제거), `contenttype`, 사용자 `metadata` map, `checked`, `status`다. S3 response/임의 raw header/Authorization/키/request-id는 직렬화하지 않는다. metadata는 최대64항목/32KiB로 제한한다. Content-Length/ETag/Last-Modified가 없거나 누락 metadata 신호가 있으면 성공/빈 값으로 간주하지 않는다.

상태는 Available/NotFound/Forbidden/Timeout/Unavailable/Unsupported로 구분한다. 빈 metadata map은 Available 상태에서만 사용자 metadata 없음으로 표시한다. provider403은 존재 여부를 확정하지 않으며 권한 확인을 안내한다. 선택한 delete-marker 버전의405는 NotFound다. 에러 본문/키/endpoint 진단을 API나 로그로 반환하지 않는다. 새 command를 기존 POST/no-store·요청/응답 로그 보호 정책에 등록한다. GET은 전역 enforce-post 설정과 무관하게 거부한다.

선택 capability `BucketObjectStoreProvider.objectMetadata`를 추가한다. Glue 구현은 기존 계정/저장소별 tenant client로 표준 HEAD 한 건을 실행하며 선택 versionId가 실제 응답과 일치하는지 확인한다. 기존 연결5초/소켓15초/전체25초 제한과 client shutdown을 사용한다. metadata read에 store 쓰기 lock/SQL transaction을 잡지 않는다. 기존 제공자가 capability를 제공하지 않으면 Unsupported를 명시한다. 원래 metadata 확장 목록 대신 표준 listObjectsV2를 사용하되, Unsupported UI는 기존 목록 크기/시각을 HEAD 미검증이라고 분리해 유지한다. 목록의 metadata를 HEAD 성공으로 위장하지 않는다.

## UI 수명·캐시·버전

공통 BucketObjectMetadata 패널을 브라우저 drawer와 버전 탭 drawer에서 사용한다. 상세를 열거나 다시 조회할 때만 HEAD를 보내며 목록 N행에 N개 HEAD를 보내지 않는다. 로딩·성공·진짜 빈 metadata·삭제/권한/시간 초과/일시 실패·미지원을 구분하고 허용된 상태에 재시도를 제공한다. 파일 목록·사용량은 메타데이터 실패로 지우지 않는다. 값은 Vue 텍스트 interpolation으로만 표시한다.

캐시는 패널 인스턴스 메모리에10초/최대20개 성공 결과만 유지한다. 계정/역할/세션/API 권한/project/bucket/등록 URL·credential revision/objectkey/versionid 범위를 포함한다. 강제 재조회는 캐시를 우회하고 실패한 조회의 이전 캐시도 제거한다. 업로드/삭제/기존 metadata 변경 경로는 revision으로 무효화한다. scope 변경/닫기/unmount 또는 빠른 객체 선택 전환 이후 도착하는 결과는 generation과 현재 query를 확인해 버린다. 진행 중 같은 조회는 하나의 promise로 합친다.

버전 탭은 각 실제 객체 버전에 metadata 액션을 제공하며 삭제 marker에는 비활성화한다. 선택한 버전 ID를 명시해 최신 버전으로 잘못 조회하지 않는다. 버전 조회/삭제·복원 후 목록을 갱신하면 metadata 선택·캐시도 무효화한다. drawer는 기존 VM/Ant Design32px·14px 제어와 테마 토큰·스크롤/줄바꿈을 유지한다.

## 검증과 배포

수정 전 실제 HEAD에 qa-note가 있는 객체의 UI 누락을31/32에서 재현한다. 전용 버킷/계정/프로젝트로 한글·공백·특수문자/%2F/중첩 key, 객체 버전,0바이트, metadata 없음, HTML 문자열, 빠른 선택·버킷/project/권한 전환, 실제404·provider403/503/timeout/부분/미지원과 재시도를 검증한다. proxy의 HEAD 수를 세어 목록 갱신이 N HEAD를 발생시키지 않는지 확인한다. 기본 제공자 미지원 계약은 단위/모의 경로와 실제 Glue 경로를 구분해 보고한다.

변경 모듈 api/engine-api/Ceph/server만 WSL ext4에서 빌드한다. schema 변경은 없다. 기존 실행 JAR의 변경 클래스만 overlay하고 다른 entry를 byte 비교하며, UI static allowlist만 배포해 WEB-INF/설정/8개 원본 library를 보존한다.31·32 런타임 hash/HTTP200/host/Glue 상태와 사용자 확인용11객체/키/보호 설정을 검증한다. 사용자 보존 버킷은 유지하고 전용 QA 자원과 오류 주입 proxy/임시 firewall만 정리한다.

참고: [S3 HeadObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)는 본문 없이 metadata를 읽고 버전 ID를 받는다. [사용자 metadata 규칙](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html)은 표준 x-amz-meta 및 missing-meta 의미를 설명한다. HTTP403/404의 의미와 delete-marker405를 구분하며 CORS 조회에 의존하지 않는다.

실제 버전 탭 검증에서 KeepAlive로 남아 있는 브라우저 drawer가 과거 버전 drawer와 겹치는 경우를 확인했다. 부모는 route tab/deactivated에서 상세를 닫고 숨겨진 file trigger로 focus를 되돌리지 않는다. 공유 패널 scope에도 tab을 포함하고 각 부모의 active 조건을 실제 탭으로 제한해 이전 결과를 폐기한다. 이 보완은 API/HEAD 계약을 바꾸지 않는다.
