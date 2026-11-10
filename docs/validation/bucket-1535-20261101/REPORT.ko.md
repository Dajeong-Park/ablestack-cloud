# #1535 소유 계정·도메인·프로젝트 범위 검증

같은 `dhslove/epic-1527-buckets` 브랜치에서 개선하고 31 GFS2·32 RBD에 동일 실행 API JAR/UI를 반영했다. 두 Mold는 32번 Glue를 공유한다. PR #1541은 미병합이며 Epic #1527은 이번 이슈를 포함해 9/13 완료, 나머지 #1536~#1539는 OPEN으로 유지한다.

## 원인과 변경

기존 생성 UI에는 API의 account/domainid 매핑이 없었다. VM의 공통 OwnershipSelection에 opt-in safeScope를 추가해 버킷에서만 전체 페이지·정확한 도메인·활성 계정/프로젝트를 검증한다. VM의 기존 기본 동작은 유지한다. 실제 listAccounts는 isrecursive=false여도 하위 도메인 계정을 돌려주므로 전체 페이지를 확인한 뒤 domainid가 정확히 같은 계정만 후보로 삼는다. UI에는 최소 후보 속성만 보관하며 accountdetails/user는 투영하지 않는다.

Root와 Domain admin은 허용 범위에서 명시적으로 선택한다. 일반 사용자는 자기 소유자로, 현재 프로젝트는 해당 프로젝트로 고정한다. 본인 기본 생성은 소유자 인자를 생략하고, 다른 계정은 account+domainid, 프로젝트는 projectid만 보낸다. API는 불완전한 계정/도메인 쌍과 프로젝트 혼합을 431로 거부하고 기존 ACL·enabled 검증을 유지한다. 수정 전 실제 혼합 요청이 프로젝트를 무시하고 계정에 할당되던 재현도 별도 기록했다.

생성 전 소유자·저장소·요청 GiB와 계정/프로젝트 제한을 표시한다. 제한은 안내이며 상위 도메인·사용량·예약과 최종 ACL은 서버가 검증한다. 제한 조회 실패는 Unknown/재조회로 표시하며 무제한이나 0으로 간주하지 않는다. 옵션 조회 실패는 생성 자체를 막는다.

## 실제 UI·Cloud DB·Glue 대조

| 검증 | 31 | 32 |
|---|---|---|
| Root → 다른 도메인 일반 계정 생성, account/domainid 요청 | PASS | PASS |
| Domain admin → 같은 도메인 계정, 하위 도메인 계정 생성 | PASS | PASS |
| Domain admin 후보 도메인 = 자기 a + child, 외부 Root/b 제외 | PASS | API/UI 범위 확인 |
| 비활성 계정·비활성 프로젝트 제외, 정확한 도메인별 계정 | PASS | PASS |
| 일반 사용자 고정 자기 생성, 소유자 인자 생략 | PASS | PASS |
| 사용자 상단 프로젝트 전환 → 고정 프로젝트 생성 | PASS | PASS |
| 관리자 소유자 유형을 프로젝트로 선택 → projectid 단독 | PASS | PASS |
| 생성 결과의 Cloud account UUID = 실제 Glue bucket owner | 10건 PASS | 9건 PASS |
| 일반 사용자 자기 목록·프로젝트 목록 격리와 S3 접근 | PASS | PASS |
| 외부 계정의 목록 숨김·키/보호/삭제영향/수정/삭제 거부 | PASS | PASS |
| 본인 S3 목록200 / 외부 소유자 S3 목록403 | PASS | PASS |
| 버킷 수3 제한 거부 → 본인 빈 버킷 UI 삭제 → 한도 복원 | PASS | PASS |
| 용량4GiB 제한(기존2+요청3) 거부 → 요청1 재시도 | PASS | PASS |
| 도메인/계정/프로젝트 목록503 → 제출 차단 → 재조회 복구 | PASS | PASS |
| 두 소유자 제한 조회503 → Unknown/재조회, 소유자 보존 | PASS | PASS |
| 생성 전달 전503 → 입력·선택 보존 → 같은 계정 재시도 | PASS | PASS |
| 선택 후 계정 lock → 실제 서버 거부 → 후보 갱신 시 해제 | PASS | PASS |
| 계정 enable 후 재조회/재선택 → 같은 계정 생성 성공 | PASS | PASS |
| 이전 폼 계정 응답을 새 폼 뒤에 해제 → 새 admin 선택 유지 | PASS | PASS |
| 계정 상세·프로젝트 계정 상세 hash 보존 / 수동 counter 보정 없음 | PASS | PASS |

정상 생성은 실제 UI에서 19건 수행했고 각 요청 인자, Cloud 소유자 UUID와 Glue 소유자를 확인했다. 별도로 수정 전 혼합 요청 재현 버킷2개를 만들었다. 31번 Root 도메인의 별도 계정 생성 1건도 포함한다. 조작된 생성 요청17건씩(총34건)과 외부 버킷 조회/작업12건씩(총24건)을 API로 거부/숨김 검증했다. count 거부와 전달 전503에는 버킷이 할당되지 않았다. 일반 사용자가 Root 관리자가 자신에게 할당해 생성한 빈 버킷을 실제 UI로 삭제했다.

조회/전달 전503과 늦은 응답은 개발용 XHR interception으로 재현했다. 성공 응답은 실제 Mold/Glue 응답을 사용했다. 시험 뒤 모든 interception과 viewport override를 해제했다. 전송 여부가 불명확한 네트워크 단절이나 queued job의 비동기 실패를 인라인 복구 성공으로 주장하지 않는다. queued job은 기존 공통 작업 알림을 따른다.

프로젝트·계정·도메인 변경의 지연 응답, 역할/세션/권한 API map 변경, 중복 검증·불변 draft·명시적인 입력 잠금·unmount/늦은 write 완료는 집중 UI 단위 테스트로도 확인했다. 실제 프로젝트 전환은 폼을 닫고 상단 헤더를 전환해 새 프로젝트 고정 폼으로 확인했고, 실제 지연 응답 해제는 이전 폼 닫기/새 폼 열기 시나리오로 확인했다.

## VM 표준·다크모드

실제 31번 가상머신 생성 화면의 공통 소유자 선택을 열어 비교했다. 같은 컴포넌트와 FormItem label/icon/select를 사용하며 입력 높이32px·글자14px·모서리4px가 일치한다. Root 상세 선택 폼은 양쪽에서 light/dark × 360/768/1280px 12화면을 확인했고, 일반 사용자/Domain admin/프로젝트·오류 화면도 대조했다. 작은 화면은 모달 내부 세로 스크롤로 하단 취소/확인에 접근할 수 있다. 실제 키보드 포커스와 360px 헤더/하단 화면을 별도 기록했다.

최종 배포본의 스크린샷45개에 원본 JPEG 시그니처·SHA256·디코딩 픽셀 크기를 기록했다. 활성 실제 텍스트 노드/placeholder의 대비는 light 최소7.56:1, dark 최소4.58:1(보존 브라우저 포함), 생성 폼 dark 최소7.13:1이다. 4.5:1 미달0건·문서 가로 넘침0건·최종 캡처 loading0이다. 비활성 입력은 활성 텍스트 대비 기준에서 제외한다. CSS viewport와 native 이미지 픽셀을 구분했다. 원본 이미지를 재인코딩하거나 확대하지 않았다.

## 빌드·배포·보존

WSL ext4에서 변경 Maven api 모듈만 빌드했다. API 소유자9건·변경 Java2개 Checkstyle, UI10 suites/152건·변경 UI lint·production build를 통과했다. build 로그의 기존 중복 아이콘 등록 warning은 테스트 실패가 아니다. 전체 Cloud/Actions/qemu 빌드는 실행하지 않았다.

API build source `2b47787346e57b927610b3a894c0e6fc2f02b757`, UI build source `34ee9f9818b31c3b2ac6a72a52741ab4255f3a1c`. 현재 production 소스 hash와 일치한다. JAR `44cf9ac136c45053bea6ab64591ff65950987d55af1f2b93437fdd3e41528f9d`, index `c9252a3c2fe815a5b76fc4ecba456f7e6f70dd6caa1175862e3724266453736c`. 변경 class+marker2개만 overlay하고 원본204639 records hash를 보존했다. 양쪽 실행 라이브러리9개·정적 파일642개 hash가 같다. WEB-INF/설정 보존·HTTP200/Mold active, host각3Up·Glue HEALTH_OK/RGW3/3을 확인했다. backend 재시작이 필요했으며 UI 정적 배포 중 PID는 유지됐다. 이번 변경은 추가 schema나 qemu/호스트 패키지 변경을 요구하지 않는다.

QA 버킷21개(19 UI+2 수정 전 재현)·Object Store2·일반/도메인 관리자 계정12·프로젝트6·도메인6과 해당 QA RGW 사용자/키를 정리했다. 잔여 credential/reservation/pending operation/QA domain0, 수동 DB counter 보정0을 확인했다. 기존 Windows/WSL FT 작업본의 HEAD·상태·추적 diff를 보존했다. WSL은 untracked 파일 hash도 대조했다. 시험 키 26개 값의 관리 로그·journal 노출0건이며 공개 source/증거/본문도 검사한다.

[확인용 qa-bkt-1540-32-files](http://10.10.32.10:8080/client/#/buckets/3e952d59-a311-4a2b-86fe-d66ed38f050c?tab=browser) 하나와 원래11개 raw 객체 byte SHA256·계정 상세·키·요청/실제 보호 설정을 유지했다. 실제 UI 브라우저 최상위8행·loading0·신규 번들도 확인했다.

## 호환성과 다음 작업

API에서 domainid만 보내거나 account만 보내던 불완전 요청과 프로젝트 혼합은 이제431이다. 다른 계정은 쌍, 프로젝트는 단독, 본인 기본은 생략하도록 호출부를 맞춰야 한다. 이외 소유자 ACL과 한도/예약 경로는 기존 서버 계약을 유지한다. VM 공통 선택은 safeScope 기본 false로 유지된다.

다음 OPEN 작업은 **#1536 버킷 생성 저장소 이름 검색과 빈 목록·조회 오류 안내 수정**이다. 저장소 선택의 이름 검색·빈 목록·최초/재조회 오류 UX는 이번 완료 범위에 포함하지 않았다. HTTPS/KMS 암호화 성공 등 기존 #1530의 검증 한계와 전체 Cloud CI 미실행도 유지한다.

[최종 설계](../../design/bucket-1527/1535-owner-scope.ko.md) · [누적 진행](../../design/bucket-1527/README.ko.md) · [Epic #1527](https://github.com/ablecloud-team/ablestack-cloud/issues/1527) · [PR #1541](https://github.com/ablecloud-team/ablestack-cloud/pull/1541).
