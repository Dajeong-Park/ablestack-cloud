# #1462 구성 백업·복원 최종 인수 — 2026-11-09

## 판정과 경계

13번의 실제 Mold UI로 백업 다운로드·업로드·검토·승인·적용, 같은 서비스 복원과 **원본 VM/ROOT 제거 후 새 VM/ROOT 복원**, 마지막 정상 구성 수동 복원, VM/관리 서비스 재시작을 완료했다. 실제 Linux noVNC 클라이언트에서 NFS·SMB 로컬 인증·iSCSI·NVMe-oF의 접속/권한/데이터와 동시 I/O를 확인했다. 클론을 사용하지 않았다.

프로토콜별 왕복은 **통합 서비스에서 NFS/SMB/ISCSI/NVME_OF 하나씩만 선택한 독립 복원 범위**로 수행했다. 별도 단일 프로토콜 VM 네 대를 시험했다는 뜻은 아니다. 부팅/관측의 비본질적인 표시 차이는 아래 UI 정리 항목으로 남겼다. 승인한 제약인 **실제 서비스 전체 리슨을 확인한 NFS만 복원**하며, 특정 IP 리슨을 지원한다고 확대하지 않는다. 기존 온라인 NFS CLIENT-only 정책 변경 경로는 유지한다.

원문 진행·중단·후속 해결 이력은 [이슈 진행 기록](https://github.com/ablecloud-team/ablestack-cloud/issues/1462#issuecomment-6717587877)에 보존한다. 이 문서는 최종 판정이며 과거 중단 기록을 소급 성공으로 바꾸지 않는다.

## 구현 경계

- ZIP v1 세 고정 엔트리(manifest/desired/effective), 해시·압축/크기·소유권·schema·경로 보호. 파일/블록 데이터·인증 비밀·DB dump·원문 설정을 내보내지 않는다.
- manageStorageConfigArtifact의 전송·검토·계획과 applyStorageConfigRestore의 단일 writer를 기존 coordinator/게스트 Transaction/프로토콜 renderer에 연결했다. 승인 대상·revision·계획/요청 해시를 실행 직전 재검증한다. SQL은 동일 트랜잭션에서 하나씩 준비→실행→닫는다.
- 실제 DATA serial/UUID/크기, 파일시스템 UUID·마운트·inode/부모 탐색 권한, 공용 정책/바인딩을 검증한다. 승인 구성은 불변이며 관측·원복 보조 정보는 실행 복사본에만 넣는다. DATA 재포맷·전역 umask 완화·기존 ACL 확대를 하지 않는다.
- 네 엔진별 적용 영수증을 묶어 확인하고 DB/게스트 확정 후에만 LKG를 갱신한다. 후속 실패 때 구성·정책 등록을 함께 원복하며 최초 실패와 원복 실패를 분리한다.
- 실제 리스너 신원/주소/포트·준비 상태를 대조한다. 활성 네임스페이스/연결을 기준으로 삭제·drain 보호를 유지한다. 실행 전 차단 사유와 후속 복구를 VM 표준 UI에 연결했다.
- bootstrap 이후 활성 release의 무결성을 확인해 snapshot/rollback 양쪽을 같은 release에서 실행한다. verifier 변경은 저장 validation을 UNKNOWN으로 바꾸고 단조 revision을 증가시킨 뒤 VM에 동기화한다.
- iSCSI READ_ONLY를 실제 MappedLUN.write_protect에 적용·재조회한다. 자동 RW 매핑을 끄고 명시 정책을 먼저 확인하며 기존 CHAP를 유지한다.

### 이번 마지막 WWN 수정

기존 부팅 authoritative rebuild는 관리 backstore를 지운 뒤 새로 만들어 WWN을 다시 발급했다. 이제 resource UUID에 **독립 검증한 DATA volume UUID·전체 bytes·WWN**을 root 전용 /var/lib/ablestack-storage/iscsi-identities/identities.json(0600, 부모0700)으로 연결한다. 장치명은 신원으로 저장하지 않는다.

기존 native 신원 또는 root 보호 saveconfig의 관리 대상/IQN/LUN과 기존 desired의 UUID·크기 관계를 검증한 경우만 채택한다. 신규 대상만 최초 한 번 발급한다. 삭제 전 DATA/ROOT/마운트/세션/인증을 확인하고, 재생성 후 LUN 게시 전에 같은 WWN과 쓰기 보호를 확인한다. 다른 DATA/축소/충돌/미확인은 거부하며 검증한 동일 DATA 확장은 WWN을 유지한다.

이 수정은 과거 잘못 변경되기 전 WWN을 임의로 덮어쓰지 않는다. 현재 검증된 9c9b3cf1-940a-489a-9845-13831ffb1f3e를 채택했고 그 뒤 두 번의 실제 VM 재시작에서 동일했다. 새 VM의 별도 대상이 원본 VM의 WWN까지 복제된다는 계약은 추가하지 않았다.

## 사전 실증·로컬 빌드·배포

| 항목 | 결과 |
|---|---|
| 구현 전 실제 SystemVM 주입 | /var/tmp/issue1462-wwn-pre-p68yz_ev: 실제 boot_reconcile.Runtime.prepare→authoritative CLI warm/반복/cold 레거시 복원 PASS |
| 신원·인증/보호 | 과거 장치명 재배치·UUID/크기/ROOT 거부, RO+CHAP 반복 재구성, RW/원래 인증 복귀, 후속 실패 원복 PASS. DATA 쓰기0·활성 코드/파일/ACL/CHAP 보존 |
| 마지막 로컬 Python 회귀 | WWN13 + MappedLUN6 + transaction25 + NFS40 + updater28 = **112 PASS** |
| 서버 이전 회귀 | 실제 MySQL DAO/백업 저장 재조회/API 계약25, 카탈로그 서버→DAO→실제 VM 정책19 PASS. 뒤의 WWN 변경은 Java/API/DB/UI 소스를 변경하지 않음 |
| UI | 실제 API fixture를 쓰는 복원 컴포넌트8·관련 lint·로컬 production build PASS. 최종 app.5dcfbf70.js 유지 |
| 로컬 모듈 | Maven19모듈 package PASS. 전체 저장소 Checkstyle/CI 통과를 뜻하지 않음; 기존 wildcard import baseline5개 유지 |
| 빌드 Actions | **0**, 로컬 빌드만 수행 |
| 최종 제품 commit | a7442b3a310b3b9dfaa0a26e84c1f72eab74ff7b |
| 런타임 | 정상 서명 1462.iscsiid.1 / baseline26 / 관리파일15, 마지막 변경 CLI·transaction2개 |
| bundle SHA256 | cbfeb1dce57cf7058b0b180aecbc0b7f17d4a4aade926521924c2e3496ea2b40 (174982 bytes) |
| manifest SHA256 | 8369dfeb8c869a30e4c9826998e9e690576887e49b381384c19a162b559f8bf6 |
| CLI / transaction SHA256 | 5d61ef695a2dbd19197d72c23440662eafaac4e1247ae64403eb81492b452737 / 163e2ce326c3a516b14be840e7ee5900b79065f9e0c1a56685be9ff5bfde7e3d |
| 관리 JAR SHA256 | a82e218eed0c4e4a7feb98f298798a317d13e0abd9174686f4f931776768d9ad. 마지막 profile/manifest만 반영, 기타92603항목 보존 |
| UI index SHA256 | 356159dcd8080168db29a5c69afb59d7296bb57b8476faf7f9706863bc3fdb43, 운영 config 보존 |
| 보호 updater13 SHA256 | f54907911f5e3156351d809544407dfb7035b3c63c21e073638b0de0e7a40a82 |
| 실제 UI runtime 적용 | catalog87034747-76b0-4d27-b65b-7717cdc875bb VERIFIED/PUBLISHED → upgrade747486a9-9040-4cf9-938f-c03c94f6cb6d COMPLETE |

개인키는 보호된 서명 경로/RAM으로만 사용했다. 비밀 원문·평문 개인키 파일을 저장하지 않았다. 기존 Golden 템플릿을 임의 교체하지 않고 새 VM을 만들고 **실제 UI의 서명 runtime 업데이트**로 최종 코드를 적용했다.

DB migration은 cloud.storage_service_config_artifact 한 테이블이다. id/uuid/kind/state/source_uuid/target_uuid/account_id/domain_id/zone_id/revision/created_by/created_ms/expires_ms/sha256/byte_count/metadata/payload/active_lkg_instance_id와 UUID·활성LKG 고유키,source/target 인덱스다. EuropaStorageConfigArtifactUpgrade의 idempotent 마이그레이션을 사용한다. 마지막 WWN 수정에는 추가 migration이 없다.

## 실제 자원과 데이터

현재 SharedFS edff302a-84bc-4e80-9b14-1884f9d13d49 / instance2b6eab19-b339-40fd-b62a-e84d056844db / VM52478e8d-47d4-30f7-93ee-8299a52e9dfe / 신규 ROOTe23dbfc1-6e63-4701-934c-ff3074d54e27(10GiB SPARSE)이다. 클라이언트464a0a92-18f1-4bbf-b0d9-b52cf81f4a52도 이번 라운드에서 새로 만들었다. MAC 수동 변경0·THIN0·클론0이다.

| DATA | 크기·형식 | 확인 |
|---|---|---|
| 3940999e-3065-488b-9d64-ef483d9af506 | 8GiB SPARSE XFS | FS UUID36235ee2-485b-4eca-9a30-b524ddd9a7f4, inode4194432,65534:65534/0775, named/default ACL user1001:rwx 유지 |
| a59c2c54-02ee-4a4a-8132-47967728d1bc | 2GiB SPARSE raw iSCSI | WWN9c9b3cf1-940a-489a-9845-13831ffb1f3e, client ID_SERIAL360014059c9b3cf1940a489a984513831 유지 |
| d647e089-ef59-4187-b608-8196cd9e646a | 2GiB SPARSE raw NVMe | namespace UUID170b7ff5-9716-423f-8030-0e105b077466 유지 |

파일 원본/백업 이후 추가분 모두 보존했다. 재시작 비교의 원래24개 파일 해시·UID/GID/mode/inode/ACL·SMB 계정 hash·private0700·정규화한 의도가 일치했다. 최종 쓰기 검증 파일2개를 의도대로 추가해26개다. raw는1MiB 원본과3/4/6MiB 백업 이후 표식, 최종8MiB 새 쓰기/재읽기를 각각 확인했다. 관측 /dev 경로의 재배치는 정규화 비교에서 제외하되 매 실행 UUID·serial·크기로 다시 검증했다.

## UI 왕복과 API·클라이언트 대조

다운로드 ZIP 0efd1208-d3e6-4c8d-b623-f058a59b7856는 실제 Chrome 저장(사용자 확인) 후 동일 파일을 UI 업로드했다. 2650bytes/SHA256359eb5f1ea88c127965c3acd4c3e0d38d0d68b1547a03025680fcc99b48c66db. 검증을 위해 숨은 API로 리스너/볼륨 준비를 대신하지 않았다. API는 읽기 전용 대조이며 클라이언트는 실제 Mold noVNC다.

| UI 시나리오 | 확정 작업·결과 |
|---|---|
| 동일 원본 서비스 전체 ZIP 복원 | 4590bcf5… COMMITTED, revision22→23. NFS/SMB 변경값 복귀·네 클라이언트 접근/데이터 확인 |
| 원본 VM·ROOT 제거→새 VM·SPARSE ROOT | 사용자 승인 UI 제거, DATA3 보존. 이전 복원 VM도 제거한 뒤 새 현재 VM에서 f556097c-1d22-4e81-a55d-507d5342782f COMMITTED,9→10, 네 영수증·접속/데이터 PASS |
| NFS 범위 | RO 변경→원본 ZIP의 NFS만 복원6ec190ea-457b-4a38-8f00-0081d8774d74,11→12. 실제 RW 쓰기/원본 SHA PASS |
| SMB 범위 | 로컬 ACL RW→RO의 put 거부 확인→SMB만 복원487c532d-6b39-43de-96e4-422ea849fa66,13→14. 로컬 인증·원본읽기/새쓰기 PASS |
| iSCSI 범위 | 실제 RO=1/쓰기거부→ISCSI만 복원703e7446-114d-49b1-9520-3ed541cf6fe9,16→17. 실제 RW=0/원본·새쓰기 PASS |
| NVMe 범위 | HostNQN 변경의 기존host접속거부→NVME_OF만 복원41d4f0f0-f6f6-41bb-9d6e-d486d11f74e2,18→19. UUID·원본/백업이후·새쓰기 PASS |
| 수동 LKG 전체 복원 | 탐색옵션 변경20→정상지점19 복원3613f136-65ea-48ee-90ce-56af9c398409,20→21,4영수증·SMB 옵션 복귀 |
| 최종 WWN/RO 재시작 | UI RO98da8b57-8ae2-4414-bcf3-31c341596081,21→22. VM boot a1cd…→872f…; WWN·store·RO·ACL·모든파일13비교항목 TRUE. 실제 client ID_SERIAL 동일/RO1·읽기/쓰기거부 |
| 최종 RW 전체 LKG·재시작 | 8dbad970-7270-4d50-b2ce-9e98629a316b COMMITTED,22→23,최초실패{}·4영수증. boot872f…→f6bd8cfb-7214-463b-90ac-4fe3f77425d4.13비교항목 TRUE·client ID_SERIAL/RW0·NVMeUUID·네프로토콜 원본/후속 데이터·새쓰기 PASS |
| 관리 JVM 재시작 중 동시 I/O | UTC20:29:23→20:30:25 네 작업각12×5회. restart20:29:37.913→HTTP20020:30:08.416,PID1708578→1709314. 종료코드 **0,0,0,0** |
| 관리 UI 재로그인 | Running/revision23/protectionfalse, 정상지점23 ACTIVE·네 OBSERVED, 이전21/19/17/14/12/10·작업24개 보존. 최종UI 작업상세에서같은8dbad970…/75f4f885… 확인 |

마지막 UI 검증 후 클라이언트는 sync/umount/iSCSI logout/NVMe disconnect를 정상 완료했고 임시 암호 변수를 해제했다. 데이터/서비스 자원을 삭제하지 않았다.

## 실패 원복·거부·남은 한계

- 실제 네 엔진의 SMB직전 통제 실패는 /var/tmp/issue1462-iscsiwp-four-rollback-qw1vt5f7에서 ROLLED_BACK/SUCCEEDED, 네 before 영수증·불변 승인·실행힌트·파일/블록/계정/ACL/WWN 보존을 확인했다. 이번 WWN 후보 주입에서도 실제 post-verify 실패의 원복과 같은 신원/권한 유지가 통과했다. 계획된 회귀 실패와 예상하지 못한 제품 오류를 구분한다.
- schema99 UI 업로드는 UNSUPPORTED_ARCHIVE_SCHEMA로 적용 전 거부했다. 손상/경로/크기/hash/owner·미해결 인증/매핑·revision·활성연결 drain은 회귀/실제 차단 기록으로 확인했다. 모든 악성 조합을 실제 UI로 각각 실행했다고 확대하지 않는다.
- 이 백업은 구성 백업이다. 원본 DATA를 삭제한 후 데이터를 복구하거나 디스크 snapshot을 복원하지 않는다. 기존 보존 DATA를 검증해 재사용한다.
- SMB 로컬 인증 비밀은 다시 입력한다. AD 가입·도메인 재구축은 이 이슈 인수 범위 밖이다.
- NVMe는 현재 kernel의 DH-HMAC-CHAP 제약을 유지하고 명시적 HostNQN ACL을 검증했다. 미지원 보안을 성공으로 표시하지 않는다.
- 최종 WWN 수정에는 UI/API/schema 변경이 없다. 기존 VM breadcrumb/목록/상세/세로탭/공통 MoldDialog·고정 헤더/푸터·콘텐츠 스크롤·AntD 라이트/다크 토큰을 유지했다.
- 표시 전용 잔여: 백업 생성일 Invalid Date, 성공 작업 NOT_NEEDED의 오해 가능한 원복 문구, 일부 중복 제목/콜론/범용 안내. **#1468 최종 UI 정리 HOLD**에 모아두며 지금 수정하지 않았다. 기능/진단/보호를 우회하지 않았다.
- Epic Draft PR은 병합하지 않았다. 이 결과는 #1462의 완료 근거이며 Epic 전체·전체 CI의 완료가 아니다.

원문 API·신원·재시작 비교는 [final-state.json](final-state.json), 실제 UI/콘솔 화면은 images/와 [화면 목록](images/README.md)에 있다. 테스트 원문은 logs/에 첨부한다.

로그 사본은 저장소 검사를 위해 행 끝 공백만 제거했다. 원래 실행 로그는 로컬 준비 디렉터리에 보존했다.
