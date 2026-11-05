# #1535 버킷 생성 소유자·권한·문맥 설계

생성 API는 account/domainid와 projectid를 받지만 기존 CreateBucket UI는 이 값을 전달하지 않았다. Root/Domain admin의 명시적인 다른 소유자 선택과 일반 사용자·프로젝트의 고정 소유자를 구분한다. [검증 보고서](../../validation/bucket-1535-20261101/REPORT.ko.md).

## API와 호환성

`CreateBucketCmd.getEntityOwnerId`는 account+domainid 쌍, projectid 단독, 소유자 생략의 세 경로만 받는다. 한쪽만 지정하거나 프로젝트와 계정/도메인을 섞으면 finalization·예약·provider 호출 전에 431로 거부한다. 생략은 기존 caller account를 유지한다. enabledOnly=true 계정/프로젝트 결정과 기존 ParamProcessWorker의 account ACL을 유지한다. 서버의 할당량·계정/도메인/프로젝트 예약·Glue 생성 처리는 기존 coordinator가 담당한다.

실제 수정 전 두 Mold에서 account+domain+project 혼합 요청은 account 우선으로 생성됐다. 새로운 계약은 모호한 요청을 허용하지 않는다. domainid만 사용하거나 프로젝트와 다른 소유자 인자를 함께 보내던 외부 클라이언트는 쌍 또는 projectid 단독으로 수정해야 한다. 권한을 완화해 이를 우회하지 않는다.

## 공통 소유자 선택

VM의 OwnershipSelection을 embedded+safeScope로 재사용한다. 기본 모드의 VM/볼륨 동작은 유지하고, 버킷의 opt-in 모드에 전체 페이지 조회·오류/재시도·문맥 토큰·안전한 선택 이벤트를 적용한다. Root와 Domain admin은 API가 허용한 도메인과 활성 계정 또는 프로젝트를 선택한다. 일반 사용자는 자신의 계정으로 고정하며 필요 없는 listDomains/listAccounts 권한을 요구하지 않는다. 현재 프로젝트는 변경 불가능한 소유자로 표시하고 projectid만 전송한다.

listAccounts는 실제로 isrecursive=false여도 자식 도메인 계정을 반환한다. 따라서 허용된 API 응답의 모든 페이지를 읽은 뒤 선택한 domainid와 정확히 같은 활성 계정만 제공한다. 프로젝트 계정(accounttype=5)을 일반 계정 선택에 넣지 않는다. 프로젝트는 Active이며 같은 도메인인 행만 제공한다. 계정 user/accountdetails 등 불필요한 응답 자료를 선택 상태에 보존하지 않는다. 이름 검색·아이콘·세로 폼과 조작 구조는 공통 VM 선택기를 따른다.

현재 계정은 최초 정상 초기화에서 기본값이 될 수 있다. 도메인/소유자 유형 변경은 이전 선택을 즉시 무효화한다. 실패하면 ready=false와 오류/재시도를 제공하고 이전 행이나 admin을 대신 제출하지 않는다. 재조회 시 이전에 선택한 계정이 여전히 해당 범위에서 유효한 경우에만 복원한다. 없는/비활성 선택을 다른 계정으로 자동 대체하지 않는다. 이전 도메인·역할·세션의 지연 응답과 unmount 후 응답은 무시한다.

## 확인·제한·제출 수명

소유 계정/도메인 또는 프로젝트, 저장소 이름, 요청 GiB를 제출 전에 확인할 수 있다. 같은 소유자로 listResourceLimits의 bucket(14)·object_storage(15)를 조회한다. 프로젝트 조회에 account/domainid를 혼합하지 않는다. null/잘못된 범위/실패/부분 응답은 Unknown이며 -1과 구분한다. 제한 조회는 안내용이며 실패 시 소유자를 바꾸지 않는다. 상위 도메인 제한·현재 사용량·예약을 포함한 최종 검증은 서버에서 수행한다. 소유자 변경 시 제한과 저장소 용량 표시를 무효화해 다시 조회한다.

생성 요청은 ownerParams와 immutable form snapshot을 사용한다. 자기 계정 기본 생성은 account/domainid 생략을 유지하며, 다른 계정은 쌍을 넣고, 프로젝트는 projectid만 넣는다. ignoreproject는 프런트 interceptor에서 상단 문맥 자동 주입을 막은 뒤 제거한다. validation/전송 중 필드를 명시적으로 비활성화하고 중복 제출을 차단한다. 즉시 API 거절은 선택·입력을 보존한다. 큐 등록 후 비동기 작업은 기존 공통 job 알림을 따른다. 모호한 네트워크 결과를 무조건 재전송하지 않는다.

계정·역할·세션·조회/생성 권한 프로필·프로젝트 문맥이 바뀌면 열린 폼을 폐기한다. 이미 승인되어 전송된 서버 작업을 취소했다고 주장하지 않는다. 오래된 validation/전송 완료로 새 문맥에 알림·성공을 적용하지 않는다.

## 배포와 검증 범위

변경 Maven 모듈은 api뿐이며 WSL ext4에서 빌드한다. 기존 실행 JAR의 CreateBucketCmd와 빌드 marker만 바꾸고 나머지 records를 보존한다. UI는 WEB-INF·설정과 다른 실행 라이브러리를 유지하는 정적 배포를 사용한다. 전체 Cloud/Actions/qemu 빌드는 실행하지 않는다.

Root·Domain admin·일반 계정·프로젝트의 실제 31/32 UI 생성, Cloud/Glue 소유자 UUID, 후보·ACL·비활성·계정 상세 보존, 조회/쓰기 실패와 재시도, 지연 응답, 계정/프로젝트 제한을 확인한다. VM 공통 폼·라이트/다크·좁은 화면·키보드를 비교한다. QA 계정·프로젝트·버킷·저장소·도메인만 정리하고 기존 확인용 버킷과 원래11개 객체·키·설정을 보존한다. 저장소 이름 검색·미등록/오류 상태 구분은 후속 #1536 범위로 남긴다.
