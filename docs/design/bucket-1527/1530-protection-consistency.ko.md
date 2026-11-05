# #1530 버킷 보호 설정의 실제 적용과 표시 정합성

기존 API는 요청한 boolean을 실제 적용 결과처럼 저장했다. 암호화 provider의 false 반환을 무시했고, 객체 잠금 인자를 S3 생성 요청에 전달하지 않았다. 이번 변경은 저장소 지원 상태와 요청값·실제 확인값을 구분하며 실제 검증 이후에만 요청값을 확정한다. [검증 보고서](../../validation/bucket-1530-20261101/REPORT.ko.md).

## 제공자 계약과 기능 제약

- `BucketProtectionProvider`는 capability 및 실제 보호 snapshot을 반환한다. 미구현 제공자는 Unknown이며 기본 false를 성공으로 취급하지 않는다. ObjectStoreDriver/Entity의 기본 계약으로 기존 제공자와 호환한다.
- `listObjectStoragePools`의 실제 QueryManager 응답 경로에도 비밀 정보 없는 capabilities를 넣었다. versioning/objectlocking은 Ceph 구현 계약을 제공한다. HTTP 암호화는 `Unsupported/ENCRYPTION_REQUIRES_HTTPS`, HTTPS는 `Unknown/ENCRYPTION_KMS_NOT_VERIFIED`이다. Glue 버전·주소의 scheme만으로 KMS 준비 완료를 선언하지 않는다.
- Ceph 암호화의 AES256 설정·해제·조회 요청을 구현했다. 현재 HTTP Glue 환경에서 기본 암호화나 암호화 객체 쓰기의 성공을 제공한다고 선언하지 않는다. TLS/KMS 준비 확인 후 capability를 승격하는 작업은 별도 검증 대상이다.
- versioning/encryption/object-lock의 알려진 설정 없음 응답만 비활성으로 해석한다. 권한 거부, 타임아웃, 알 수 없는 404는 Unknown이다. 일부 조회만 성공한 경우에도 불완전한 실제값을 확정하지 않는다.
- 신규 객체 잠금은 S3 CreateBucket의 lock 인자를 전달하고 versioning=true를 요구한다. 실제 lock+versioning 재조회 후에만 생성 성공·할당량 확정을 처리한다. 기존 잠금의 추가·해제, 잠금 버킷의 버전 관리 중단은 거부한다. `UpdateBucketCmd.objectlocking`은 기존 값의 반복만 허용한다.

## API와 저장 계약

`BucketResponse`의 기존 encryption/versioning/objectlocking boolean은 호환성을 위해 요청값이다. `protectionverificationstate`와 `protectionverifiedat`, 중첩 protection snapshot으로 실제 의미를 표시한다. snapshot에는 requested/effective 3종, Verified/Mismatch/Unknown, checked/verified 시각, Off/Enabled/Suspended, 알고리즘, capability, operation UUID/state를 제공한다. Unknown에서는 실제 boolean을 누락해 false로 오인하지 않게 한다.

`getBucketProtection(id)`와 `reconcileBucketProtection(id, operationid, acceptactual)`는 owner ACL을 먼저 검사하는 POST/no-store API이다. 일반 quota reconcile은 보호 작업을 복구하지 못한다. 복구는 작업 UUID와 현재 외부 bucket identity를 검사한다. acceptactual은 명시적으로만 수행하며 자동 보정은 없다.

`bucket.protection_snapshot MEDIUMTEXT`를 nullable로 추가한다. 업그레이드 SQL/Java helper는 기존 값·객체를 변경하지 않으며 재실행해도 안전하다. 기존 boolean은 실제 조회 없이 Verified로 승격하지 않는다. 배포 전 additive DDL을 적용하고 변경 모듈의 class/schema를 기존 실행 JAR에 반영했다.

## 변경·실패·재조정

1. store 분산 잠금과 active_bucket_id의 기존 영속 원장으로 보호/할당량/삭제/회전을 조율한다. PROTECTION은 용량 예약을 추가하지 않는다.
2. 실제 snapshot을 새로 읽어 요청값과 일치하는지 확인한 뒤 Prepared를 기록한다. DAO update에는 DAO에서 다시 읽은 entity를 사용한다.
3. Applying을 영속화하고 provider 변경 → 실제 재조회 → DB 요청값 반영 순서로 처리한다. 성공은 Succeeded이며 snapshot은 Verified이다.
4. 실패 시 변경 전 실제 설정으로 복원한다. 원래 값과 target 어느 쪽도 아닌 외부 변경은 덮어쓰지 않는다. 정확히 복원되면 Failed로 끝내며 실패 이전 요청값을 유지한다.
5. 최초 Off에서 Enabled로 바뀌면 S3에서는 Suspended로만 돌릴 수 있다. boolean이 false여도 정확한 Off 복원이 아니므로 NeedsReconcile을 유지한다. 사용자는 확인 후 실제 상태를 명시적으로 수용한다.
6. 복원·조회·DB 확정 실패와 재시작 후 미완료 작업은 NeedsReconcile에 남는다. 같은 operation UUID로 복구하거나 실제 상태를 수용한다. 성공/복원 후 같은 UUID의 재전송은 새 작업·provider 쓰기를 만들지 않는다. 자동으로 보호를 낮추는 worker는 없다.
7. pending PROTECTION 중 quota/policy/삭제와 UI 업로드·폴더 생성·선택 삭제를 제한한다. 읽기 실패는 기존 실제 상태를 성공으로 재사용하지 않는다. 서버 오류는 자격 증명을 제외한 operation UUID/state만 전달한다.

## 화면과 운영 의미

신규 생성 폼은 선택한 저장소의 기능 제약을 안내하고 Unsupported/Unknown을 비활성화한다. 잠금을 선택하면 버전 관리를 켜고 끄지 못하게 한다. 기본 policy는 Private이다. 수정은 quota/protection/policy를 각각 별도로 변경하며 잠금 버킷의 versioning switch도 비활성화한다.

보호 설정 탭과 수정 대화상자는 요청값과 Glue 확인값을 나란히 보여준다. Unknown은 ‘확인할 수 없음’, Mismatch는 불일치, pending은 작업 ID와 명시적 복구/수용을 안내한다. 현재 버킷의 boolean·credential revision·operation metadata가 바뀌면 같은 탭에서도 자동 재검증한다. 확인 시각만 바뀌는 것은 재조회 loop를 만들지 않는다. account/project/bucket 전환·unmount 후 늦은 응답은 무시한다. 복구 성공은 부모 상세도 갱신한다.

VM 메뉴의 32px/14px 조작 규격, 공통 MoldDialog 720px/모바일 여백, theme token과 폼 라벨을 따른다. 좁은 화면에서는 표 내부만 가로 스크롤하고 페이지·대화상자는 넘치지 않는다. 기본 암호화는 기존 객체 암호화나 KMS 상태를 보증하지 않으며 lock 활성화도 각 객체의 retention/Legal Hold 존재를 뜻하지 않는다는 범위를 화면에 표시한다.

## 검증 범위와 배포

31·32의 실제 UI 생성·설정 변경·복구, DB와 Glue S3 조회를 교차 검증한다. HTTP 암호화 거부와 plaintext 미생성, 잠금 생성·COMPLIANCE/Legal Hold의 정확한 버전 삭제 거부를 확인한다. owner ACL, POST/no-store, 잘못된 lock 인자, 실제 S3 권한 거부/SDK timeout, 적용 후 확인 실패, DB commit 실패, 정상 서비스 재시작, legacy mismatch의 명시적 수용을 포함한다.

Cloud 변경 모듈만 WSL ext4에서 빌드했다. 전체 Cloud/Actions/qemu 빌드는 수행하지 않는다. 배포는 WEB-INF/설정/라이브러리 보존과 정적 파일 whitelist를 사용하며 두 클러스터의 실행 JAR·정적 파일 hash를 맞춘다. 전용 QA 자원은 일반 empty-only 삭제로 정리하고 원래 확인용 버킷과 11개 객체·키·보호 설정은 유지한다.
