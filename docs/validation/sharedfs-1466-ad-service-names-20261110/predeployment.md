# #1466 배포 전 구현·검증 기록

이 문서는 로컬 구현과 배포 전 실증만 기록한다. 13번 제품 배포·실제 UI·새 Windows 인수는 이 시점에 아직 완료하지 않았다.

- 설계 기준: docs/design/sharedfs-1466-ad-service-names-20261110/README.md. 기준 브랜치 epic/1438-sharedfs, local/upstream Europa divergence 0/0 확인.
- 전용 AD 컨텍스트는 getStorageSmbServiceNameContext의 BaseResponse를 사용한다. 목록은 표준 ListResponse의 count/servicename[]를 유지한다. 공통 ApiResponseSerializer는 변경하지 않았다.
- 추가 DDL: cloud.storage_smb_service_name. id/uuid, instance_id(FK RESTRICT), name_kind/binding_type/endpoint_uuid, fqdn/canonical_hash, state/revision, desired_json/ownership_json/observed_json(MEDIUMTEXT length 16777215), created/updated(TIMESTAMP 매핑). uuid 및 instance_id/canonical_hash UNIQUE. schema-sharedfs-1466-smb-names.sql은 idempotent다.
- 이름 endpointid는 기존 SMB endpoint API와 동일한 UUID 문자열이다. instance/name UUID는 실제 EntityReference를 통해 내부 ID로 변환한다. 실제 ParamProcessWorker 요청 회귀로 공개 점검/실제 제출을 비교한다.
- 기존 configuration writer의 Creating 예약·검증 후 SQL 확정·동일 UUID 복구를 재사용한다. 원복의 실제 DNS/SPN 재조회와 확인된 자기 node 재생성만 영수증으로 갱신하고 desired/configuration revision은 원복 시 유지한다.
- DNS는 정확한 현재 RR을 삭제하고 원복 ADD만 기본 DNS_RPC_RECORD로 NDR 해석한다. SPN은 GSSAPI sealed LDAP의 값 단위 ADD/DELETE다. foreign/REUSED 데이터·컴퓨터 GUID/SID·외부 node 교체 보호를 유지한다.
- VM당 기존 AD 계정·hostname/netbios·계정/keytab·SMB 공유/ACL·DATA를 별칭 때문에 바꾸지 않는다. 이름 전용 작업은 renderer/Winbind/서비스 재시작 경로를 사용하지 않는다.
- 가입 후 선택 이름은 membership→SMB 적용/검증→이름 단계로 구분한다. 기존 신원을 유지한 재가입에서 누락된 이름만 같은 정상 이름 UPDATE 경로로 복구한다. 다른 컴퓨터나 다른 DNS 객체를 인수하지 않는다.
- endpoint/AD leave/SharedFS 삭제/동일 서비스 복원의 참조 보호를 조건부로 연결했다. 이름 메타데이터와 외부 AD 소유권을 다른 VM의 구성 백업으로 이전하지 않는다.

배포 전 근거:
- 실제 API 직렬화 fixture를 UI 컴포넌트가 사용한다. 기존 SMB 생성/편집 포함 컴포넌트 25건 통과, 변경 UI lint 통과.
- 기존 SMB/AD/원복/엔드포인트 및 실제 coordinator→MariaDB DAO를 포함한 백엔드 회귀 통과. 최종 package 테스트 로그에 정확한 건수를 기록한다.
- 실제 SystemVM Samba 회귀 통과. 전체 RuntimeAdapter/Transaction 주입에서 생성·동일 UUID 중복 방지·rename 뒤 의도적 실패·검증된 자기 원복 영수증·후속 삭제를 통과했다.
- 기존 transaction 회귀25건, 새 name adapter3건, runtime updater28건 통과. 새 payload18개 및 정확한 과거9개 signed layout을 검증했다.
- runtime baseline34의 관리 파일 hash를 실제 payload와 대조했다. 승인 request/before-image는 실행 자료와 분리해 원본을 보존한다.
- 테스트 credentials는 stdin·private kernel keyring 또는 메모리에만 사용한다. Cloud/게스트 저널·snapshot·코드·로그에 저장하지 않는다.

13번 준비:
- 기존 실행 JAR SHA256 aaf83406ddb48af5d0559cea9b1ca64f5dce4eee7e6aa1151ef2a113843d3335 확인.
- 관리 서버 공간 부족을 배포 전에 확인했다. 오래된 시험 빌드 JAR63개, 9,567,930,502 bytes만 정리해 여유 약9.6GiB를 확보했다. 사용 중인 JAR·DATA·설정·UI·runtime bundle은 제거하지 않았다.
- SystemVM/AD의 기존 선택 설정·계정/keytab hash·리스너 PID·원본 파일3개의 inode/uid/gid/mode/ACL/hash 및 computer GUID/SID/KVNO/원래 SPN은 주입 시험 후 동일했다. 시험 alias는 정상 삭제했고, 배포 인수용 일회성 operator는 인수 종료 후 정리할 예정이다.

후속 인수는 실제 Mold UI에서 실행한다. SPARSE 이상을 사용하고 새 Windows 클라이언트로 서로 다른 두 FQDN의 CIFS Kerberos ticket·접속·데이터, 충돌·소유권·원복·재시작 보존을 확인한다. 제품 오류는 원인을 분석하고 중단한다.
