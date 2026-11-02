# #1532 빈 버킷 삭제와 버전·명시적 정리 계약

일반 삭제가 RGW 관리자 removeBucket을 호출해 내용물과 이력까지 제거하던 문제를 수정한다. deleteBucket은 이제 **빈 버킷만 삭제**한다. 이전 클라이언트도 내용물 삭제가 필요하면 별도 purgeBucket으로 전환해야 한다.

## API와 권한

모든 아래 API는 POST 본문을 사용하고 no-store 응답 및 민감 요청/응답 로그 억제를 적용한다. Cloud 소유권·도메인/프로젝트 접근 검사는 provider 호출보다 먼저 수행한다. UI의 기능 표시나 버튼 비활성화만으로 권한을 보장하지 않는다.

| API | 계약 |
|---|---|
| deleteBucket(id) | 현재 객체·이전 버전·삭제 마커 존재 또는 조회 오류면 거부한다. 최종 S3 DeleteBucket도 원자적으로 빈 상태를 검사한다. 관리자 강제 삭제로 폴백하지 않는다. |
| getBucketDeletionImpact(id) | 현재 객체, 객체 버전(현재 포함), 삭제 마커, 검사 시각, 완전 집계 여부, 실제 RGW bucket ID와 차단 사유. 최대 100페이지이며 10초 경과 시 다음 페이지 조회를 중단한다(단일 SDK 요청 제한은 25초). 부분 값은 전체로 표시하지 않는다. |
| listBucketObjectVersions(id,keymarker,versionidmarker,limit) | 실제 S3 ListObjectVersions와 양쪽 연속 마커. 1~1000개. 전체 개수나 오프셋 페이지를 가정하지 않는다. |
| manageBucketObjectVersion(id,key,versionid,action) | 정확한 버전을 delete하거나 restore한다. 이전 객체는 해당 버전을 새 현재 객체로 복사해 이력을 보존한다. 삭제 마커 restore는 해당 마커만 제거한다. |
| purgeBucket(id,operationid,confirmname,includeversions,expectedexternalid,retry) | 클라이언트가 만든 canonical UUID, 정확한 이름, 버전 포함 동의, 검사한 실제 외부 ID가 필수다. 최초 요청을 영속 저장하고 백그라운드에서 처리한다. 실패 복구는 같은 UUID와 재확인으로 수행한다. |
| getBucketPurgeStatus(id,operationid) | 삭제한 개수·확인 가능한 진행 여부·마지막 처리 키/버전·최대 20개 실패 항목·오류 코드·작업 상태. 완료 후 소프트 삭제된 Cloud UUID로도 소유권 검사를 거쳐 조회/재전송할 수 있다. |

purge는 Cloud async job ID가 아닌 **영속 operationid**를 반환하는 비동기 계약이다. 기존 버킷 생성/할당량의 async job 계약은 유지한다. API id는 버킷 UUID 문자열이며, 완료된 purge의 상태 조회·중복 요청을 위해 제거된 메타데이터도 서버가 검증한다.

## 지속 상태와 실패 복구

기존 bucket_quota_operation 원장의 operation_type=PURGE와 추가 MEDIUMTEXT purge_progress를 사용한다. 배포 버전이 같아도 재적용 가능한 SQL과 schema upgrade hook을 제공한다. 기존 예약·할당량 원장은 공유하며 purge 자체는 새 용량 예약을 만들지 않는다.

Prepared → Applying → Prepared(다음 배치) → Committing → Succeeded. 오류는 NeedsReconcile로 남긴다. 정리 중인 버킷은 할당량/키 변경·중복 삭제·버전 변형과 충돌하지 않도록 저장소 분산 잠금과 활성 작업 검사를 사용한다.

- 매 차례 남아 있는 목록의 **첫 페이지**에서 최대 1000개 key/version 쌍을 명시해 DeleteObjects한다. 삭제하며 이전 페이지 마커를 계속 사용해 항목을 건너뛰지 않는다.
- 응답에서 확인된 정확한 삭제 건수만 누적한다. 일부 실패는 성공 항목 수와 실패 key/version을 저장한다. 응답 유실·재시작 Applying 상태는 누적 숫자가 전체 진행률을 뜻하지 않음을 표시한다.
- 실패나 중단은 이미 제거한 객체를 복원하지 않는다. 버킷 메타데이터·소유권·할당량은 유지하며, 사용자가 확인하고 같은 UUID로 남은 버전부터 재시도한다.
- 마지막 빈 목록 뒤 외부 ID를 다시 확인하고 비강제 DeleteBucket을 호출한다. 실제 외부 제거를 확인한 뒤에만 DB와 할당량/자원 카운트를 단일 트랜잭션으로 한 번 확정한다.
- S3 삭제 후 DB 실패도 원장을 보존한다. 재시도 시 실제 버킷이 없는 상태를 확인해 DB 확정만 수행한다. UUID 재전송은 새 정리나 중복 차감을 만들지 않는다.
- 30초 복구 worker와 최초 요청의 전용 작업 실행기를 사용한다. 실패 상태는 자동으로 재파괴하지 않고 명시적 재확인을 기다린다.

## 객체 잠금과 외부 클라이언트

실제 S3 Object Lock을 조회한다. 명확한 미설정 404만 미설정으로 해석하고 권한 부족·불명확한 응답·조회 실패는 삭제 가능으로 해석하지 않는다. 잠금이 켜진 버킷의 버전 변경과 purge는 보수적으로 차단한다. governance bypass나 RGW 관리자 purge는 제공하지 않는다. 비어 있는 잠금 버킷 자체의 비강제 삭제 가능 여부는 S3가 판정한다.

생성 요청에 ObjectLockEnabledForBucket을 전달하는 최소 수정은 실제 잠금 시험을 위해 포함한다. 암호화 적용·전체 보호 옵션 지원/표시 정합성은 후속 #1530의 잔여 범위다.

정리 중 UI 업로드·폴더 생성·객체 삭제를 비활성화한다. 외부 S3 클라이언트의 쓰기까지 차단하는 계약은 아니므로 새로 생긴 버전도 완료 전 대상이 될 수 있음을 확인 화면에 알린다. 계속 쓰는 외부 클라이언트는 운영자가 먼저 중지해야 한다. 화면을 닫아도 작업은 계속되며 취소로 이미 제거한 데이터를 되살리지 않는다.

## UI

상세의 일반 삭제는 영향 조회와 빈 상태 확인만 수행한다. 별도의 강제 정리 화면에서 정확한 이름 입력·버전 포함 선택·되돌릴 수 없음 동의를 요구한다. 실패 시 작업 ID·오류 항목과 상태 조회/재시도 동선을 유지한다. 네트워크 응답을 잃어도 동일 UUID로 상태를 확인하거나 재전송한다.

버전 탭은 현재/이전 버전과 삭제 마커를 표시하고, 선택 버전 삭제/복원 의미가 다른 확인창을 제공한다. 공통 MoldDialog, VM 메뉴의 Ant 버튼/14px 글꼴과 테마 토큰을 사용한다. 표는 내부 수평 스크롤, 작업 영역은 줄바꿈, 긴 키/UUID는 줄바꿈을 사용한다. 계정·프로젝트·경로·버킷 변경 시 늦은 응답을 폐기한다.

그룹 삭제도 기존 deleteBucket을 호출하므로 기본은 empty-only다. 그룹별 성공/오류 표시는 공통 ResourceView 작업 결과를 사용한다.

## 검증과 한계

실제 31/32 관리 서버와 32번 Glue에서 UI·Cloud API·DB·S3 이력을 대조한다. 전용 시험 자원만 제거하고 원래 확인용 버킷과 11개 객체는 보존한다. 최종 결과는 [검증 보고서](../../validation/bucket-1532-20261031/REPORT.ko.md)에 기록한다. Full Cloud 빌드/전체 CI, 다른 S3 제공자, 지속 외부 업로드의 종료 시간 보장은 이번 결과에 포함하지 않는다.

계약 참고: [S3 DeleteObjects](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObjects.html), [S3 DeleteObject](https://docs.aws.amazon.com/en_en/AmazonS3/latest/API/API_DeleteObject.html), [Ceph 객체 API](https://docs.ceph.com/en/latest/radosgw/s3/objectops/), [Ceph 버킷 API](https://docs.ceph.com/en/latest/radosgw/s3/bucketops/).
