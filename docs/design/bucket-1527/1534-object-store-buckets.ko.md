# #1534 Object Store UUID 필터와 소속 버킷 조회

`ListBucketsCmd.objectstorageid`가 기본 스토리지 응답 타입을 참조해 실제 Object Store UUID를 431로 거부했다. UUID 변환을 고쳐도 QueryManager에는 저장소 조건과 IDs IN 조건이 빠져 있었다. 목록 전체 건수도 페이지 크기로 반환했다. [검증 보고서](../../validation/bucket-1534-20261101/REPORT.ko.md).

## API·검색 계약

- UUID entityType은 ObjectStoreResponse이다. ROOT admin 전용 매개변수와 기존 Bucket ACL을 유지한다. service layer도 root가 아닌 caller의 내부 store ID 사용을 거부한다.
- 기존 REST dispatcher는 비관리자의 관리자 전용 인자를 제거한다. 따라서 비관리자에게 objectstorageid를 넘기면 해당 필터를 새로 허용하거나 타 계정으로 범위를 넓히지 않고 기존 자기 소유 범위로 조회한다. 알려진/다른/없는 저장소 UUID의 결과가 동일한 자기 범위인지 검증한다. UI는 관리자에게만 저장소 선택을 제공한다.
- object_store_id, name, id/ids, keyword와 account/domain 또는 project의 ACL 조건을 모두 DB 검색 전에 결합한다. id/ids 상호 배타, account/project 상호 배타는 기존 API 계약을 따른다.
- 일반 목록의 기본 프로젝트 범위는 그대로이다. projectid=-1과 listall=true는 프로젝트를 포함한 전체 권한 범위이다. 특정 projectid 또는 account/domain과 저장소 필터는 교집합이다.
- IDs 조건은 SearchBuilder에 idIN을 선언한 뒤 값을 바인딩한다. 값 바인딩만으로 SQL 조건이 생긴다고 가정하지 않는다.
- 페이지별 distinct ID와 필터링한 전체 count를 함께 반환한다. hydration 결과를 후보 ID의 오름차순으로 재배열해 DAO 재조회 순서에 따라 페이지가 뒤섞이지 않게 한다. 빈 페이지도 전체 건수를 유지한다. 임의의 새 전역 정렬 계약은 추가하지 않는다.

## 목록 필터와 프로젝트 인계

BucketStoreFilter는 기존 목록 헤더에 저장소 이름 검색/선택과 재조회 버튼을 제공한다. URL에는 objectstorageid UUID만 넣고 다른 검색 조건을 보존하며 page=1로 이동한다. 선택 이름이 바뀌어도 UUID는 유지한다. 저장소 선택 목록을 페이지별로 끝까지 읽고 실패/중복/불완전한 응답은 조용히 일부 목록으로 확정하지 않는다.

조회 실패는 선택 UUID를 지우지 않는다. 이름 chip 조회 실패도 UUID로 돌아가며, 선택 목록 실패 안내와 재조회가 제공된다. 존재를 확인할 수 없는 선택도 자동으로 전체 버킷 필터로 바꾸지 않는다.

계정/역할/세션/프로젝트 범위가 바뀌면 선택·목록을 초기화한다. 명시적인 projectid+objectstorageid URL로 기본 보기에서 들어오거나 같은 프로젝트를 현재 문맥으로 인계하는 과정은 헤더의 실제 프로젝트 전환과 구분한다. 같은 보안 주체의 명시적 선택을 유지하되 역할·계정·세션 변경은 URL에 projectid가 있어도 초기화한다. 프로젝트 범위에서는 account/domain 고급 검색을 제공하지 않아 기존 상호 배타 계약과 맞춘다. 서버의 최종 ACL을 우회하지 않는다.

Autogen의 버킷/Object Store 조회는 preserveOnFailure·timeout과 scope/generation을 사용한다. 역할과 세션도 scope에 포함한다. 같은 조건의 일시적 실패는 마지막 성공 목록과 실패 안내를 보존하고, 다른 조건이나 권한 실패는 이전 목록을 비운다. 실패한 목록의 선택·변경 작업은 제한한다.

## Object Store 소속 버킷 탭

ObjectStoreBuckets는 현재 저장소 UUID로 listBuckets를 호출한다. ROOT admin에게 계정과 프로젝트를 포함한 소속 버킷을 제공하기 위해 projectid=-1/listall=true를 명시하고 현재 프로젝트 자동 주입을 막는다. 전역 전체 목록을 받아 프런트에서 저장소별로 필터링하지 않는다.

버킷 이름의 상세 연결, Created 상태의 텍스트/배지, 사용량 KiB와 할당량 GiB, 계정·프로젝트, 검색·페이지·페이지 크기·업데이트를 제공한다. 검색과 페이지 크기 변경 시 페이지를 초기화한다. 응답의 각 objectstorageid가 현재 UUID와 같은지도 확인한다.

서버의 정상적인 빈 list 응답은 count=0 필드를 생략한 빈 envelope일 수 있다. 해당 정상 envelope는 빈 상태로 해석하되 응답 누락/오류/잘못된 count를 빈 상태로 취급하지 않는다. 조회 전/실패의 total은 Unknown이다. 일시적 재조회 실패는 같은 조건의 성공 목록을 남기되 최신/검증됨으로 주장하지 않는다. 권한 실패·범위 불일치 응답은 지운다. 이전 저장소·계정·프로젝트의 늦은 응답은 무시한다.

## 저장소 삭제와 실패 복구

DeleteObjectStore는 같은 ObjectStoreBuckets 조회를 사용한다. 전체 소속 조회가 성공해 같은 UUID의 total=0임을 확인했을 때만 삭제를 제공한다. 검색 결과가 0이어도 전체 소속 버킷이 없다는 뜻으로 사용하지 않는다. 조회 중/조회 실패/권한 없음은 삭제 가능 상태가 아니다.

소속 버킷이 있으면 삭제 불가 이유와 소속 버킷 보기 동선을 제공한다. UI 사전 확인 이후 버킷이 만들어져도 backend의 최종 종속 검사를 유지한다. 삭제 오류 후에는 확인 상태를 무효화하고 다시 조회한 뒤 재시도하도록 한다. 기존 일반 버킷 삭제·명시적 purge 계약과 혼동하지 않으며, 이 동작은 빈 저장소 등록을 삭제하는 것이다.

## UI와 배포·검증

VM 메뉴의 목록/상세 조작 구조와 공통 대화상자, 32px·14px 조작 규격 및 theme token을 사용한다. 표는 내부 가로 스크롤과 지역 focus를 제공하고 좁은 화면에서 툴바·하단 조작은 줄바꿈한다. 라이트/다크의 프로젝트 스위치·페이지 선택·링크·placeholder에는 명시적인 테마 토큰을 적용한다.

실제 31 GFS2/32 RBD에서 동일 backend/UI를 반영하고 두 Mold 모두 32번 Glue를 사용한다. 변경 Maven 모듈(api/server)만 WSL ext4에서 빌드한다. 전체 Cloud/GitHub Actions/qemu 빌드는 하지 않는다. 기존 실행 JAR의 나머지 records를 보존하고 WEB-INF·설정·다른 라이브러리를 보존하는 정적 UI 배포를 사용한다.

검증에는 두 저장소, 여러 소유자와 프로젝트, IDs·이름·keyword·계정/프로젝트 교집합, 없는/기본 스토리지 UUID, ACL, 페이지 전체 건수·순서, 목록 실패와 재시도, 늦은 응답, 삭제 직전 새 버킷 생성 경계를 포함한다. 전용 QA 자원만 정리하고 기존 확인용 버킷과 원래 객체·계정 상세·키·보호 설정은 유지한다.
