<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# S2S-01 / #1719 VPN 게이트웨이 검색 구현 검증

대상: Epic #1718의 첫 하위 이슈 #1719. 기준 소스 dhslove ablestack-europa `055ea57b238746c65b66cc5600215b10f0087b23`, 작업 브랜치 `dhslove/epic-1718-s2svpn`.

## 구현 결과

- `listVpnGateways.keyword`를 공인 IP/게이트웨이 UUID/VPC 이름의 부분 일치로 구현했다. 공백 제거, 한글/대소문자, `%`/`_`/역슬래시 리터럴을 지원한다. 바인딩된 LIKE 인자를 사용한다.
- 게이트웨이를 기준으로 IP/VPC LEFT JOIN을 사용한다. 기존 ACL과 id/vpcid/표시 조건은 AND, 세 키워드 대상은 괄호 안 OR이다. 같은 SQL 조건을 count/페이지 조회에 사용하고 id 내림차순을 유지한다. null/삭제 참조에서도 UUID 검색을 유지한다.
- VM 공통 Breadcrumb/ListView/SearchView와 테마 도구 모음을 재사용했다. 기본 검색 및 ID/VPC/도메인/계정 고급 검색, 소유 범위 내 페이지 후보, 이름/UUID 구분, URL·페이지·필터 칩·상세 목록 복귀를 연결했다. 고급 검색 폼에는 VM과 같은 세로 label·Ant 입력·버튼·popover 배치와 공통 테마 토큰을 적용한다.
- 전역 프로젝트를 URL이 변경할 수 없다. 잘못된 UUID/지원되지 않는 인자/확인 실패 후보는 조회를 차단한다. 같은 문맥의 갱신 실패는 기존 행+오류/재시도를 유지하며, 소유 문맥 변경과 권한 소멸은 기존 행/선택/후보를 제거한다. 늦은 응답은 version+scope로 폐기한다.
- 실 UI 시험에서 발견한 제출 폼 model 누락, 중복 필터 칩, 공인 IP 링크의 복귀 인자 누락, 공통 프로젝트 URL watcher 충돌을 수정하고 관련 검증을 추가했다.

- 768px 이하에서 긴 생성 버튼이 검색 입력 폭을 없애던 문제는 기존 VM/볼륨 공통 도구 모음의 flex/줄바꿈 규격을 재사용해 수정했다. 화면 크기 변경 시 열린 팝오버를 닫아 이전 좌표가 화면 밖에 남지 않게 한다. 검색·지우기 아이콘에도 공통 테마 토큰을 적용한다.
- `listAccounts`는 `listall=true`일 때 `isrecursive=false`여도 하위 도메인을 포함한다. 새 계정 후보와 정확 이름 lookup은 `listall=false`+명시 domainid로 조회한다. 결과의 domainid 검증과 페이지/count는 유지한다. 계정 API 자체와 다른 화면은 수정하지 않는다.

## 변경 범위

Maven 변경 모듈은 `api`, `server` 두 개뿐이다. 새 검색 helper는 server 모듈에 두며 DAO/DB 스키마나 기본 ACL은 바꾸지 않았다. UI는 검색과 해당 목록·복귀 경계만 변경한다. 상세 제목/탭/CRUD 대화상자 전반은 #1721, updateVpnGateway 응답은 #1720, 생성 후보/IP와 표시 변경 UI는 #1722/#1723의 범위로 유지한다.

기존 네트워크/VPC/VNF/Public IP/ASN 기능 전체를 재시험하지 않았다. 공통 AutogenView에 대한 인접 기능의 집중 단위 시험만 수행했다. ISP/피어/특수 제공자 터널과 패킷 전달 시험은 수행하지 않으며 이 보고서의 PASS에 포함하지 않는다.

## 빌드·집중 시험

모두 WSL ext4 `/home/ablecloud/work/dhslove/cloud-epic-1718`에서 수행했다. 전체 Cloud 빌드와 수동 GitHub Actions 실행은 하지 않았다.

```sh
mvn -pl api -DskipTests -Dcheckstyle.skip=true -Drat.skip=true install
mvn -pl server -Dtest=Site2SiteVpnGatewaySearchTest,Site2SiteVpnManagerImplTest -DfailIfNoTests=false -Dcheckstyle.skip=true -Drat.skip=true package
python3 docs/validation/s2s-1719-20261119/checkstyle-changed.py
```

- API/server 모듈 빌드 성공. 실제 JDBC/DAO fixture 4개 + 기존 VPN 서비스 45개 = 49개 통과.
- 변경 Java 4파일 Checkstyle 0건. 변경 UI/새 시험 파일 lint 통과.
- UI 신규 검색 및 인접 공통 경로 7 suite 70개 통과(권한 소멸/역할 전환/프로젝트 라우트 회귀 포함).
- UI production 빌드 성공. 최초 기능/스타일 검증 UI 소스는 `c112f240e56`이며 `ui-final-manifest.json`에 기록했다. 최신 기준 통합 후 배포한 최종 UI는 `78749177a19`이며 `ui-integration-manifest.json`과 일치한다.

## 배포 보존

31 GFS2, 32 RBD 관리 서버의 기존 JAR를 기준으로 모듈 빌드 결과의 검색 메서드, API 설명, 새 helper 3클래스만 반영했다. 검색 메서드의 배포 전 명령열이 기준 소스와 같은지 먼저 검증했다. 서비스의 다른 47개 메서드/모든 필드와 API 명령의 다른 5개 메서드/설정을 보존했다. 두 배포 overlay 각각 `-Xverify:all`+JUnit 49개를 통과했다. 변경 클래스 외 JAR 엔트리 내용은 모두 일치한다. 이는 미리 존재한 클러스터 수정 사항을 덮어쓰지 않기 위한 배포 방식이며 제품 소스 빌드를 생략한 것이 아니다.

UI는 `/usr/share/cloudstack-management/webapp`에 정적 파일 허용 목록만 덮어쓰고 기존 파일을 백업했다. `WEB-INF`, `config.json`, 서버 JAR를 보존했으며 `rsync --delete`/webapp 전체 교체는 사용하지 않았다. 이전 FTCTL/ASN 표식과 새 S2S 검색 표식도 확인했다. 상세 해시·백업 위치·서비스 PID·HTTP 200은 배포 로그와 manifest에 기록했다.

## 실환경 API 결과

31/32 각각 25개(총 50개) 검색 API 검증과 전용 일반 계정의 소유 범위 음성 시험 각 4개(총 8개), 합계 58개 통과: IP, UUID, UUID 대문자+공백, VPC 대소문자/한글, 특수문자 리터럴, SQL 유사 문자열, 빈/미일치, id/vpcid 정확 조건과 키워드 교집합, 계정/도메인, 페이지 1/2 및 count, 특정 프로젝트와 전체 보기, 잘못된 UUID 거절. `projectid=-1`은 기존 API의 전체 보기(기본+프로젝트)를 유지하며 특정 프로젝트 조회와 구분했다.

시험 데이터는 클러스터마다 전용 VPC/게이트웨이 2개다. 관리 서버 재시작 직후 첫 생성은 호스트 재연결 중 용량 오류로 자동 정리됐고, 모든 호스트 Up/Enabled 확인 후 재개했다. 해당 실패는 검색 결함이나 성공 증거로 계산하지 않았다.

## 실환경 UI·VM 기준 비교

최종 배포 결과는 `ui-evidence-final.json`, `ui-matrix.json`, `capture-dimensions.json`, `screenshots/`에 기록했다.

| 대상 | 직접 UI 검증 | 결과 |
| --- | --- | --- |
| 31 GFS2 | 한글/복합 ID·VPC·도메인·계정 검색, 버튼 제출, 단일 필터 칩, 상세 breadcrumb 복귀, 페이지/count, 프로젝트 전환/다른 프로젝트 URL 차단, 잘못된 UUID 차단, 통제 403 후 기존 행 제거·재시도 | PASS |
| 32 RBD | IP/대문자 UUID/한글/리터럴 `%`/미일치, 페이지 1/2·상세 복귀·검색 page=1, 도메인/계정 선택·정확 lookup, 프로젝트 전환/URL 차단, 선택 후보 503 시 UUID 유지·제출 차단·재시도, 갱신 503 시 행 유지, 새 검색 뒤 늦은 이전 응답 폐기 | PASS |
| VM 기준 비교 | 양쪽 390/768/1280 × 라이트/다크, 같은 viewport·사이드바 폭·전역 알림 배너 오프셋의 VM/S2S 12쌍 | PASS |
| 작은 화면·키보드 | 검색 입력 폭 135~175px 유지, 모든 폼/버튼이 가로 화면 경계 안에 존재, 390×600에서 내부 스크롤/고정 footer, Escape 포커스 복귀, 크기 변경 시 popup 닫힘/조건 유지 | PASS |

스타일 비교용 24캡처는 시험 자원 정리 후 빈 기본 목록에서 전환 애니메이션이 끝난 다음 다시 촬영했다. 실제 검색 행/필터 결과는 정리 전 UI/API 증거에 별도로 남겼다. 추가 390×600 캡처 2개는 선택 후보 확인 중의 좁은 폼 상태/스크롤을 보여 준다. JPEG를 변환·확대하지 않았고 원본 치수와 DOM viewport를 대조했다. VM과 S2S의 후보/폼 내용 차이에 따른 폭·높이 차이를 기능별로 유지하면서 label/입력/버튼·배경·테마·공통 도구 모음/줄바꿈·스크롤 경계를 비교했다.

- [31 라이트 1280](screenshots/31-s2s-light-1280-search.jpg), [VM 기준](screenshots/31-vm-light-1280-search.jpg)
- [31 다크 390](screenshots/31-s2s-dark-390-search.jpg), [VM 기준](screenshots/31-vm-dark-390-search.jpg)
- [32 라이트 768](screenshots/32-s2s-light-768-search.jpg), [VM 기준](screenshots/32-vm-light-768-search.jpg)
- [32 다크 390](screenshots/32-s2s-dark-390-search.jpg), [VM 기준](screenshots/32-vm-dark-390-search.jpg)

통제 503/403/응답 지연은 개발자 네트워크 시험으로 주입했으며 실제 장애로 분류하지 않았다. 주입 설정을 모두 해제했다. 프로젝트 변경 후 공통 프로젝트 선택기가 대시보드로 이동하는 기존 동작을 유지하고, 해당 메뉴 재진입 때 새 프로젝트만 조회함을 확인했다. #1721 상세 제목·탭·생성/삭제창 전반의 표준화 완료를 주장하지 않는다.

## 정리·최종 상태

클러스터별 전용 VPC 2개·게이트웨이 2개와 일반 계정 1개, 총 VPC 4개·게이트웨이 4개·계정 2개를 삭제했다. 기존 기본 보기와 모든 기존 프로젝트의 VPC/GW/연결/고객 GW 및 기본 Public IP의 UUID/선택 주요 설정 비교가 일치했다. `31/32-cleanup-preservation.json`을 참조한다. 비밀값이나 DB 이력/모든 호스트 파일의 전수 동일성을 주장하지 않는다.

최종 기본 목록은 양쪽 GW 0건이다. UI에서 빈 목록과 원래 다크 테마/기본 프로젝트 복원을 확인하고 viewport override를 해제했다. 관리 서버는 active, HTTP 200, WEB-INF 존재, 호스트 3대씩 Up/Enabled, runtime 클래스 hash 일치를 재확인했다.

이슈 #1719만 구현 완료 대상으로 보고한다. 다음 순서는 P2 #1720 `updateVpnGateway` 비동기 결과 반환/실패 계약이며 구현하지 않고 대기한다. PR 병합은 실행하지 않는다.

## 최신 기준 통합·추가 검증

PR 등록 시 작업 중 병합된 최신 Europa `61d39d7cd2dd6b1caaa6634eef16e8757f1cc05a`(KISO #1703)와 충돌이 발견되어 `78749177a19`에서 병합했다. 충돌 5파일의 양쪽 검색 분기·목록 복귀·문맥 가드·번역을 보존했다. PR의 기준 대비 변경은 #1719 소스/증거로 한정된다.

- VPN 소유 Java 4파일, 검색 helper/컴포넌트와 테마 CSS는 최초 배포본과 바이트가 같다. Java를 다시 변경하거나 서버 JAR를 재배포하지 않았으며 기존 runtime 클래스 hash를 재확인했다.
- 공통 UI 통합 검증은 기존 70개에 KISO 검색/레이아웃·읽기 전용 VM 경계 시험을 추가한 **10 suite 98개 통과**, 충돌/공유 UI 파일 lint·production build 성공이다. `ui-integration-tests.log`, `ui-integration-lint.log`, `ui-integration-build.log` 참조.
- 통합 UI를 양쪽에 정적 자산만 다시 배포했다. WEB-INF/config/JAR/PID를 보존했고 HTTP 200을 확인했다. `31/32-ui-integration-deployment.log`, `ui-integration-manifest.json` 참조.
- 기존 프로젝트의 게이트웨이로 추가 **API 7개씩 총 14개** 읽기 전용 재확인과 실제 UI 프로젝트 전환·IP 검색 1건·미일치 0건·상세/breadcrumb 조건 복귀·고급 검색을 확인했다. 기존 자원은 변경하지 않고 기본 프로젝트·다크/viewport를 복원했다. `31/32-integration-api.json`, `ui-integration-evidence.json`, `screenshots/31/32-postmerge-search.jpg` 참조.
- 앞의 전체 VM 스타일 행렬은 통합 전 기능 검증본의 증거다. 통합에서 VPN 전용 폼/helper/테마 CSS는 그대로 보존했고, 통합 후에는 충돌한 공통 읽기/복귀 경로를 집중 재검증했다. 최신 통합본에서 해당 행렬 전체를 새로 실행했다고 주장하지 않는다.

원격 CI는 별도다. `78749177a19`의 충돌 검사는 통과했다. [License Check](https://github.com/ablecloud-team/ablestack-cloud/actions/runs/44483800654)는 4,077개 기존 파일로 실패했다. 해당 모든 파일이 최신 기준 브랜치에도 존재하고 blob hash가 같음을 대조했으며 이번 변경 파일의 신규 지적은 0건이다(`ci-license-baseline.json`). Lint는 보고 시점 진행 중이므로 전체 CI 성공이나 병합 완료를 주장하지 않는다. 전체 Cloud 빌드/수동 Actions는 실행하지 않았다.

텍스트 로그/증거는 LF와 행 끝 공백만 정규화했다. 캡처는 원본 JPEG를 유지했다.
