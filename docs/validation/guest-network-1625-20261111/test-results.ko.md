# 빌드·배포·검증 결과와 한계

## 로컬 빌드

빌드는 모두 WSL ext4 `/home/ablecloud/work/dhslove/cloud-epic-1554`에서 수행했다. `/mnt/c` 빌드, 전체 Cloud 빌드, 수동 GitHub Actions 실행은 없다.

변경/의존 모듈: `api`, `core`, `engine/orchestration`, `engine/schema`, `engine/storage/volume`, `plugins/backup/ablestack-commvault`, `plugins/backup/ablestack-nas`, `plugins/backup/ablestack-netbackup`, `plugins/backup/ablestack-veeam`, `plugins/hypervisors/kvm`, `plugins/integrations/kubernetes-service`, `server`, `plugins/backup/veeam`.

| 검사 | 결과 | 증거 |
|---|---|---|
| 13 Maven 모듈 패키지 | 성공. clean 재빌드 중 시험이 중단한 나머지 7개도 clean/package 재수행 | modules-build-result, remaining-package-build-result |
| AppCookie/VirtualRouter/프로젝트 보안 집중 Java | 64건 중62통과·기존 skip2 | tests-build-result |
| UI lint·관련12 suite | 149/149 통과 | tests-result |
| SourceBased 기존 재열기 | 집중 회귀 통과 | source-reopen-result |
| Vue production build | 성공, 675 정적 파일 | build-result, manifest |
| 확대 Java 시험 | 전체 녹색 아님 | expanded-initial-build-result, clean-tests-build-result, baseline-comparison |
| 전체 UI 시험 | 초기 322 suites, 5134통과/11실패. 동일 기존 Epic 기준 9실패 재현. 나머지2는 수정·집중 재검증 | full-tests-result, baseline-comparison |

확대 server 시험의 UserVmManagerImplTest10·BackupManagerTest6 실패는 pristine upstream45944c40에서도 동일 재현했다. 이 두 클래스를 제외한 server 표본1042건(기존 skip2)은 통과했다. KVM LibvirtComputingResourceTest의 PVLAN DHCP delete 기대값(기존 가드의 성공 no-op과 불일치), User VM 시작 시 backup lock/호스트 경로 의존 시험2건은 확대 실행 실패로 남긴다. 패키지 성공·집중 회귀를 전체 시험 통과로 표현하지 않는다. UI 신규 실패2개는 SourceBased fixture의 제공자 조회 stub, upstream 실행 중 PCI 설정 저장 조건을 현재 변경과 정합하게 반영해 집중 시험에서 통과했다.

## 병합 결과물 배포

관리 서버의 기존 fat JAR은 소스 merge base보다 오래돼 첫31 배포의 변경 클래스만 갱신한 후보에서 시작 의존 클래스 누락이 발생했다. 즉시 기존 JAR로 rollback하고 HTTP/API·VM·TLS를 확인했다. 그 뒤 **빌드한 13개 모듈의 전체 클래스/자원 6513개**를 합성하고 classpath jdeps 검사를 통과한 후보로 양쪽에 배포했다. 기존에도 없던 SnapshotImageMetadata 참조1개 외 **새 누락 타입0**, 시작 의존 클래스 포함, 나머지198355개 JAR 항목은 보존했다. 이 초기 실패와 복구는 `31-first-deployment-rollback.json`에 기록했다. 서버 DB의 idempotent 업그레이드 단계는 실행됐으며 DB 백업과 코드 백업을 별도 비공개로 보관한다.

최종 관리 JAR SHA256: `3f4de1380fa2695460c4d8e483c47196ec96378d05dfa98873c982a1a2144d97` (31·32 동일). 호스트6대는 각각 설치된 관련 모듈 JAR6개를 교체하고 해시·서비스·Cloud Up을 확인했다. 런타임 스크립트48개를 갱신하고 기존 netbackup-host-policy.conf를 보존했다. 활성 webapp의 WEB-INF/META-INF, 서버 JAR/설정/PID를 보존하고 정적 UI만675개 갱신했다. root 디렉터리 교체나 rsync --delete를 쓰지 않았다. 최종 현재 부팅 이후 class loading 오류0·서비스 active·API 로그인·HTTP200, 대상 VR health15/15이다.

## 실제 시험 (31·32 동일 수행)

| 시험 | 결과 | 주요 evidence 파일 |
|---|---|---|
| UI AppCookie 생성 | 실제 job1, 지원 값 재열기 | 31-ui-create-request/actual-job, 32-ui-review-create-request/actual-job |
| API AppCookie | job1·현대 stick-table·문법0·appsession 없음 | policy-*-job, runtime-* |
| 사전 거부13종 | 각각431·job없음, live config SHA/TLS 보존 | preflight-rejections/preservation |
| 요청 학습 false/true | match/on 분기·응답 학습·요청 전용 key 유무 일치 | runtime-request-*, request-*-traffic |
| 정확한 이름·길이·만료·기본값 | 접두 쿠키 무시, length4 절단, 1s 만료, 기본52/3h | runtime-exact-name/truncation/defaults, expiration-atomic |
| 단일 백엔드 쿠키 매핑 | 실제 table key·server_id=1·TLS HTTP200/본문 | runtime-offering-*, tls-* |
| LbCookie / SourceBased SSL | 실제 job1·insert/IP stick-table·TLS HTTP200 | policy-lb-cookie/source-based-job, runtime-*, *-traffic |
| SourceBased TCP | 실제 job1·IP stick-table·문법0·SSH-2.0 배너 | tcp-source-based-runtime/traffic, tcp-regression-result |
| 읽기전용/비구성원 API | 양쪽 각4개 생성/삭제 거부,401/432·job없음 | policy-role-denials |
| 읽기전용 UI | 정책 변경 메뉴 disabled, 모바일 조회 가능 | readonly-policy-guard, readonly-mobile-dark |
| CA 체인·TLS | Root/hostname 신뢰 curl0/TLS0·문법0·점검0, 미래 만료 검증 실패 | tls-appcookie-ca, tls-offering-* |
| 오퍼링 왕복 | 8192/keepalive true → 원래4096/false, 각 job1·새VR 동호스트·정책/TLS 정상 | offering-*-job/state, placement-*, tls-offering-* |
| 기존 SSL/VPN | 기존 인증서 지문 복원·TLS200, VPN 재접속 ICMP5/5·TCP3/3 | tls-final, multi-2-final/after-final-lb, vpn-lb-final-continuity |
| UI 레이아웃·탐색 | 1280/768/390 × 밝음/다크·즉시테마·프로젝트 왕복·VM 표준 | updated-*, instant-theme-*, project-form-id-verified, vm-* |

TCP18871은 기존 인바운드 방화벽 항목이 없어 기본 상태와 SourceBased 적용 상태 모두 SYN timeout이었다. 동일 허용 CIDR `10.10.0.0/16`의 전용 임시 방화벽을 만든 뒤 양쪽 실제 TCP/SSH 배너가 통과했다. 임시 항목은 실제 delete job1 후 제거하고 원래 방화벽 ID 집합을 검증했다. 기존 보안 정책을 영구적으로 넓히지 않았다.

CA 시험에서는 기존 인증서가 붙은 상태의 교체 요청이 기존 정책대로 실패했다. 명시적 해제→할당의 성공 job 후 체인을 검증하고 원래 인증서로 복원했다. LB 변경 전후 VPN 설정 해시/mtime·xl2tpd/pppd PID가 같고 실제 통신이 유지됐다. 오퍼링 변경에 의한 VR 재생성은 의도적 중단/재접속 시험이며 무중단으로 주장하지 않는다. 새 VR의 #1621 configure.py와 #1624 HAProxy health checker 소스를 재확인/반영했다.

## 한계·분리

- 단일 backend key→server_id와 실제 통신을 검증했다. 여러 backend의 affinity/분산·부하 측정은 사용자 요청대로 제외했다. stick-table reload 간 데이터 영속성을 주장하지 않는다.
- #1626 비동기 job 실패·결과 불명 입력 복구와 중복 방지는 후속이다. 이번 길이0 UI 사전 오류에서는 전송없음·초안 유지·수정 재시도를 확인했다.
- 기존 목록의 설정 드롭다운을 연 상태에서 1280→390으로 강제 변경하면 열린 팝업의 이전 좌표로 overflow가 한 번 관찰됐다. 팝업을 닫으면 페이지 overflow0이었다. **이 열린 팝업 resize까지 통과했다고 주장하지 않는다.** 이번 AppCookie 모달 자체의12배치는 모두 통과했다. 후속 UI 회귀에서 팝업 재배치를 검토한다.
- 독립 외부 VPN client2대, CRL/OCSP, Health Monitor 제공자는 기존 사용자 확인대로 없다. #1569의 해당 조건부 항목은 여전히 준비가 필요하다. backendssl verify none을 backend CA 검증으로 표현하지 않는다.
- 32번에는 실행 중 별도 tj-isolated-net / tj-vm-1·2 및 관련IP·VR가 추가 관찰됐다. 이번 작업에서 생성·변경·삭제하지 않았고, 기존 자원 ID의 보존과 해당 추가를 구분했다.
- 보호된 Native8개/12791파일·WSL14개/107파일의 HEAD·staged/unstaged diff·개별 파일 해시가 동일하다. 공개 증거에는 비밀번호/API key/세션 key/PSK/개인키를 게시하지 않는다.

## Git 상태와 등록 CI 구분

검증/증거 커밋 `9351c6f80d50f3614d8b99eb43fe7f7232b0b279`에서 Native·WSL·origin Epic 브랜치를 일치시키고 clean을 확인했다. WSL 빌드용 소스 15개는 최종 소스와 일치하는지 검사한 뒤 작업 전용 stash에 보관하고 fast-forward했다. 다른 보호 worktree는 변경하지 않았다. 원격 upstream 최종 확인도45944c40으로 동일하다. PR1577은 Draft/Open/MERGEABLE이다.

등록 PR Merge Conflict Check는 실충돌이 아닌 GitHub 연동의 옛 status:has-conflicts 라벨 제거403으로 실패했다. 인증된 gh로 해당 stale 라벨만 제거했다. License/Lint는 관측 시점 상태를 `evidence/github-checks-observed.json`에 그대로 기록했다. 로컬 집중 시험/패키징과 등록 CI·전체 Cloud CI를 구분하며 전체 CI 통과로 보고하지 않는다.
