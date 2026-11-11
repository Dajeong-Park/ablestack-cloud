# Epic #1438 후속 작업 재개 준비 — 2026-11-11 KST

## 병합과 소스 기준선

- 독립 VM/KVM PR #1623을 병합했다. merge commit: `2250b0e7fb87dea26ab8442f52c69dce763c079b`.
- upstream fetch → 로컬 `ablestack-europa` fast-forward → local/upstream 차이 0/0 확인 후 기존 `epic/1438-sharedfs`를 로컬 기준 브랜치 위로 rebase했다.
- 갱신 전 Epic: `d6f02aafbf9b4a3df0a4f25bf13feb862846b3f9`. 보존 ref: `dhslove/backup-epic1438-before-pr1623-20261111`.
- 갱신 후 제품 코드: `960ad446887e7cdd760c1713bf541cf995732258`.
- 이전 Epic와 새 기준선을 merge-tree로 결합한 tree와 rebase 결과 tree가 모두 `fcd82212b271a1034cc6c31466980b1601be7597`로 일치했다. 이전 Epic 대비 차이는 #1623의 19개 파일에 한정된다.
- #1436 작업 전 보관했던 #1466 패키징 도구 3개를 복원했다. 이전 stash 및 기존 작업 자료는 보존했다. 제품 기능의 추가 변경은 하지 않았다.
- Epic PR #1470은 Draft·미병합 상태를 유지한다. #1623의 이미 병합된 변경은 Epic PR의 신규 변경으로 다시 제시하지 않는다.

## 이번 통합 확인

- 갱신된 Epic 코드로 로컬 41개 의존 모듈 package 성공. PCI 정책·실제 DAO 저장/재조회·Start wrapper/실제 XML/응답 직렬화·NIC 오류 경로 회귀 37건 통과, 실패/오류/생략 0.
- #1466 패키징 회귀 5건 통과, 생략 0. 기존 잘못 조립한 JAR의 실제 참조 누락/Spring 실패와 현재 13번 실행 JAR와 동일한 최종 JAR의 참조/Spring 정상 초기화를 대조했다. 단순 XML 구문 검사로 대신하지 않았다.
- 격리 로컬 MariaDB만 사용했으며 시험 종료 후 정리한다. GitHub Actions와 13번 새 배포·기능 변경·신규 자원 생성은 실행하지 않았다.
- 이 결과는 다음 기능 인수를 시작할 소스/패키징 준비 근거다. #1466의 Windows·Kerberos 인수 완료를 뜻하지 않는다.

## 13번의 현재 확인 값

| 대상 | 현재 관측 |
|---|---|
| 관리 JAR SHA-256 | f077b695d8851c090d18d89ccf79cc61b22c4e442afffe535c8052ea20e7c365 |
| 관리 UI index SHA-256 | 5a81ec8c82ded8ddd1379bf81bbee42b002c4997e60ebfc8a88595a0bb2c1493 |
| 서비스/호스트 | mold.service active, UI HTTP 200, Agent 3대 Up |
| SharedFS AD member | VM d9c423e9-ce89-3ba9-9cd8-f48cdb791da2 / 10.10.13.220 / 13.2 / Running |
| AD DC | VM eed7f477-e439-4d8a-a932-3642aac0359e / 10.10.13.247 / 13.3 / Running |
| SMB 서비스 이름 테이블 | cloud.storage_smb_service_name: 0행 |
| 공간 | 관리 서버 / 약8.1GiB, /nfs 약162GiB 여유 |

현재 관리 JAR는 #1466 전용 Spring bean 교정 배포본 `b8097619315baf80feb1cedf90140378414fbd381565ac05d24a4cd29fceb171`에 #1436 클래스를 보존 적용한 결과다. 따라서 과거 이슈의 'Spring 실패 후 원복·미배포' 문구는 당시 이력이며 위 현재 값과 구분한다.

**과거 #1466의 전체 patch JAR를 그대로 다시 배포하지 않는다.** XML 전용 overlay 도구의 base 인자만 바꿔도 나머지 patch 엔트리가 자동으로 최신이 되는 것은 아니다. 추가 배포가 필요하면 현재 실행 JAR `f077…`를 기준으로 최신 Epic에서 빌드한 변경 클래스/리소스를 조립하고, #1436 프로파일·관리 hook·새 클래스와 비대상 엔트리가 모두 유지되는지 검증한다. 최종 JAR의 모든 변경 Spring XML 참조·실제 context 초기화도 다시 통과해야 한다.

## 다음 대상: #1466의 남은 인수

1. 현재 모듈·런타임 버전과 실제 UI 진입을 대조한다. 추가 배포가 필요한 경우 위 기준선 보존 검사를 먼저 수행한다.
2. 실제 Mold UI에서 새 Windows VM·SPARSE ROOT를 생성하고 정상 부팅·고유 컴퓨터 이름·AD/DNS 준비를 확인한다. #1436 시험 VM이나 부팅 실패했던 이전 Windows VM을 인수 클라이언트로 대체하지 않는다. 기존 AD/SharedFS/DATA는 보존한다.
3. #1466 범위의 별칭 추가·수정·삭제, DNS/SPN 충돌·소유권·실패 원복·같은 작업 재개를 실제 UI와 API 대조로 확인한다. 서로 다른 두 FQDN의 실제 Windows CIFS Kerberos ticket·SMB 접속·권한·데이터 보존을 검증한다.
4. 재시작 후 이름·소유권·클라이언트 재접속과 기존 서비스 보존을 확인한다. 제품 오류는 원인·증거를 보존해 중단한다. 정상 통과 후에만 #1466 완료 기록·Epic PR 반영·종료를 수행한다.

이번에는 위 인수를 시작하지 않았다. GitHub의 실제 sub-issue 상태를 조회한 결과 #1439~#1465는 CLOSED(27개), #1466~#1468은 OPEN이다. 각 종료 이슈의 검증을 이번에 전부 재실행했다는 의미는 아니다. 이어지는 순서는 #1466 → #1467이며, #1468 전체 UI 정리는 착수 직전 보고·별도 지시 대기를 유지한다. 백업 기능이나 다른 이슈로 작업 범위를 확장하지 않는다.
