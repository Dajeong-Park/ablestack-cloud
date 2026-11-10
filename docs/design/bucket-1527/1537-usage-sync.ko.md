# #1537 버킷 사용량 수집·최신성·복구 설계

## 문제와 범위

목록 조회와 사용량 수집은 별개인데 UI가 구분하지 않았고, 명시적 수집은 누락 결과를0으로 저장했다. 주기 수집과 다른 갱신 경로가 버킷/통계/Object Store 합계를 따로 변경했다. Glue 전체 버킷 조회 대신 단일 버킷 통계가 필요하다. 이 변경은 기존 #1529·#1531·#1533·#1534·#1535·#1536의 자격 증명/소유 ACL/할당량/선택 수명을 유지한다.

## 데이터·API 계약

`bucket.size`, `bucket_statistics.size`, `object_store.used_size`와 응답 `size`/`storageused`는 기존 **KiB**를 유지한다. byte로 단위를 바꾸지 않는다. 저장소 상세 UI의 사용량만 KiB→bytes로 명시 변환한다. #1539의 total/allocated 용량·수정 초기값·연결 상태는 후속이다.

bucket에 nullable `usage_last_updated DATETIME(3)`(마지막 성공), `usage_last_attempt DATETIME(3)`(성공/실패 마지막 시도), `usage_status VARCHAR(16)`, `usage_source VARCHAR(32)`, `usage_last_attempt_ms BIGINT`를 추가한다. 기존 size는 유지하고 성공 시각을 역산하거나 기존 행을 Fresh로 올리지 않는다. additive/idempotent Java migration을 Europa 버전 업그레이드 hook에 연결한다. 이미 Europa인 클러스터는 같은 버전 재시작으로 버전 업그레이드 hook을 다시 실행하지 않으므로 [명시적 배포 SQL](../../../engine/schema/src/main/resources/META-INF/db/schema-bucket-usage-1537.sql)을 JAR 반영 전에 적용한다. 배포기는 서비스 정지 중 기존 bucket 전 열/행 hash를 저장하고 SQL을2회 적용해 멱등성과 기존 값 보존을 검증한다. 실패하면 기존 JAR로 원복하고 추가한 nullable 열은 유지해 역호환을 보장한다.

BucketResponse는 `usagelastupdated`, `usagelastattempt`, `usagestatus`, `usagesource`와 날짜 직렬화의 초 단위 정밀도 손실 없이 응답을 비교하는 `usagelastattemptms`를 제공한다. DAO Date 필드에 TIMESTAMP 매핑을 명시한다. 기존 DAO의 날짜 저장/읽기는 초 단위이므로 정밀한 응답 순서는 별도 nullable BIGINT 시도 시각(ms)으로 함께 저장한다. 이 값은 이전 값보다 최소1ms 증가하게 해 같은 초와 시계 보정 중에도 순서가 역전되지 않으며, 다른 관리 노드의 lock 후 재조회도 최초 snapshot의 이 값과 비교한다. 서버 시각 기준 성공 후1시간까지 Fresh, 이후 Stale, 실패 Error, 성공 기록 없는 기존 행 Unknown이다. 미래 시각도 Fresh로 표시하지 않는다. Fresh는 최근 수집 성공이며 제공자 통계가 즉시 실물 변경을 반영했다는 보장은 아니다. UI가 Glue 통계 지연 가능성을 설명한다.

## 제공자 조회·일관성

engine API의 BucketUsageProvider 계약을 ObjectStoreDriver가 구현한다. Glue는 기존 제한시간/서명 검증을 가진 Admin GET `/admin/bucket?bucket=...&stats=true&format=json`을 사용한다. 응답 버킷 이름/owner UUID/instance id를 확인한 뒤 각 usage category의 정수/비음수 `size_kb` 합계를 사용한다. 존재가 검증된 `usage:{}`도 바로0으로 확정하지 않는다. 0인 경우 S3 버전/marker 목록을 최대100페이지×1000개 범위로 끝까지 확인하고 모든 논리 크기가0이며 미완료 multipart가 없는 경우만0을 확정한다. 양수 버전이 있거나 목록/커서가 불완전하면 지연/실패로 보고 마지막 값을 보존한다. 확인된 0byte 객체·marker의0KiB는 실제 빈 버킷과 구분하며 empty-only 삭제 조건을 완화하지 않는다. 404/누락/부분/잘못된 소유자/음수/소수/합계 overflow는 실패다. quota read는 실제/논리 byte 최대값을 사용하는 기존 안전 계약을 유지하며 통계 read와 혼동하지 않는다.

기존 제공자는 전체 저장소 map에서 요청한 이름의 명시적인 유효 값만 허용하며 `StoreFallback`을 응답/화면에 드러낸다. provider read는4개 daemon worker/대기열 없이25초 deadline, Glue HTTP 연결5초/읽기15초/응답1MiB 제한을 사용한다. 취소를 무시하는 제공자도 무제한 작업/대기열을 만들지 않는다. 늦은 read는 DB를 직접 변경하지 못한다.

명시적/주기적 수집은 한 coordinator를 사용한다. 호출자별 ACL을 먼저 검증하고 같은 버킷의 진행 요청을 합친다. 기존 store GlobalLock을 공유해 생성/수정/삭제와 충돌하지 않으며 다른 관리 노드의 겹친 요청은 lock 획득 후 last attempt를 다시 확인한다. 제공자 I/O 동안 SQL transaction을 열지 않는다.

성공 후 짧은 transaction에서 버킷 size/성공·시도 시각/상태, 해당 소유자의 단일 BucketStatistics 행, 활성 Created 버킷의 마지막 성공 size 합계를 함께 갱신한다. 합계에 증분을 더하지 않아 재시도 중복 집계를 피한다. 일부 버킷이 실패해도 다른 버킷의 마지막 알려진 값은 유지한다. 실패/불완전 응답을0으로 바꾸지 않는다. resource_count/할당량/예약은 변경하지 않는다. DB 실패도 성공 transaction을 rollback하고 별도 Error/시도 시각만 기록한다. 비밀 값·제공자 예외 본문은 API/로그에 노출하지 않는다.

## UI 수명·복구

브라우저에서 `목록 업데이트`와 `사용량 동기화`를 분리한다. 파일 목록과 기존 사용량은 수집 대기/실패 중 유지한다. 동기화 중 중복 클릭은 같은 promise를 사용한다. API 권한이 없는 사용자는 액션을 보지 못하며 메서드 guard도 요청을 막는다. 서버 ACL이 최종 경계다.

브라우저와 요약 카드에 마지막 성공 수집 시각/상태를 표시하고 상세 탭에서도 metadata를 확인할 수 있다. 오류 후 재시도는 통계만 다시 수집한다. 파일 업로드/삭제 성공은 먼저 알리고 파일 목록을 갱신한다. 이후 통계 실패는 별도 경고와 복구 경로를 제공하고 업로드 전체를 실패로 바꾸거나 파일을 재전송하지 않는다.

계정·역할/API 권한·세션·프로젝트·버킷 scope가 바뀌거나 unmount되면 이전 promise 결과/오류를 폐기한다. 이전 부모 metadata가 새 성공 수집을 덮지 못한다. 파일 배치 작업도 시작 scope/클라이언트/버킷을 유지해 다른 bucket/context로 이어 실행하지 않는다.

VM 공통 버튼/폼·테마 token을 사용한다. 양쪽 light/dark·360/768/1280px에서 본문·상태·오류·재시도·하단 접근을 검증한다. 전체 WCAG 인증이나 전체 Cloud CI 성공으로 확대하지 않는다.

## 검증 계획

외부 S3 PUT/DELETE 후 목록만 갱신한 stale 재현, 명시 수집의 UI/요약/API/DB/Glue/저장소 합계 일치, 빈 버킷, 부분 응답/HTTP 실패/DB rollback, 중복 수집과 주기 경로, 본인/하위 도메인/프로젝트·제한 역할 ACL과 scope 전환, 동기화 실패 후 실제 업로드 성공 유지 및 명시적 복구를31·32에서 검증한다. 원본 확인용 버킷과11객체/키/보호 설정을 보존하고 전용 QA만 정리한다.

실제 라이트모드 검증에서 기존 상단 ID/계정 링크와 경로 대비가 3.24~3.35:1로 확인되어 버킷 화면 링크 및 경로도 VM 공통 테마 토큰으로 통일한다. 원본 수집 기능 검증과 별도로 수정 UI 빌드 배포 후 다시 측정한다.
