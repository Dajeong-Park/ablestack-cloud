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

# #1721 사이트간 VPN의 가상머신 UI 표준 적용 및 작업 수명 검증

31 GFS2·32 RBD에 UI 변경을 배포하고 실제 UI/API 검증을 완료했다. #1718 전체 완료를 의미하지 않는다. 다음 구현은 #1722(P3: 생성 후보·공인 IP 정책)이며 #1723 표시 수정/필터는 남아 있다.

## 구현 결과와 경계

- Breadcrumb와 InfoCard는 `publicip → vpcname → id`를 공통 적용한다. 목록에 VPC 링크와 프로젝트 문맥의 프로젝트 열을 제공하고 값 부재는 `-`로 표시한다. 이전 기본 3열 설정만 새 기본값으로 이행하며 사용자 지정 열은 유지한다.
- ResourceLayout/InfoCard/ResourceView/DetailsTab과 VM 표준 행·탭 간격, 공통 MoldDialog/MoldDialogActions를 사용한다. 상세/연결 탭을 URL로 복원하고 잘못된 탭은 상세로 정규화한다. Root 관리자에게만 사용자 표시 값을 읽기 전용으로 보여 준다.
- 연결 탭은 VPC와 소유/프로젝트 범위로 조회한 후 gateway ID를 대조한다. 필요한 필드만 보유하여 PSK를 저장하거나 렌더링하지 않는다. 기존 연결 상세로 이동하며 새 연결 reset/delete/PSK 작업을 복제하지 않는다.
- 전역 생성/삭제는 검증·제출·작업 추적·성공/실패/미확정을 구분한다. 동기 busy 가드와 customjobid를 사용하고 작업 성공 및 API 재조회가 일치해야 창을 닫는다. 미확정은 같은 작업만 다시 조회한다. 영수증에는 명령/작업ID/대상ID/소유 범위만 저장하며 키/세션/PSK는 저장하지 않는다. 사용자/역할/프로젝트/경로/권한 전환 시 이전 입력·응답을 폐기한다.
- 삭제 후 ID 검색이 삭제 대상이면 해당 ID만 제거하고 나머지 목록 범위를 보존한다. 동일 문맥의 조용한 갱신은 요약/탭/기존 데이터를 유지한다.
- #1719 검색 기반을 보존했고 #1720 백엔드 배포 클래스는 변경하지 않았다. VPC 내부 창은 공통 작업 ID/명령 검증 helper 소비 지점만 수정했다. 후보 제외·조건부 IP는 #1722, 사용자 표시 수정창/필터는 #1723 범위다.

## 소스·빌드·배포

작업 트리 `/home/ablecloud/work/dhslove/cloud-s2s-1721`, 브랜치 `dhslove/s2s-1721-vm-standard`. 원래 Windows/FTCTL 작업 트리와 로컬 ablecloud-team 저장소는 수정하지 않았다.

- 배포한 제품 소스: **80c83488c2a2e6e7f13de7da1ed21d5356228380**. #1721 구현 304af031979 및 80c83488c2a, 최신 Europa 도메인 보정 41fe8cb0dd0을 0980be43d85에서 통합했다.
- 미병합 #1719 PR #1724의 09085547d616 기반을 포함하는 후속 PR이다. #1720 PR #1725는 별도다. PR 병합은 실행하지 않았다. 현재 PR의 기준 브랜치 대비 diff에 #1719의 미병합 변경도 포함됨을 명시한다.
- **UI 모듈만** WSL ext4에서 빌드했다. 전체 Cloud/Maven/호스트 패키지 빌드 및 수동 GitHub Actions는 실행하지 않았다. 서버 JAR/서비스 재시작도 없다.
- 일반 production 빌드는 webpack-sources의 디버깅 소스맵 병합 단계에서 과도하게 지연돼 중단했다. 이 빌드들을 성공으로 계산하지 않는다. 최종 검증용 빌드는 productionSourceMap 및 Uglify sourceMap만 끈 별도 설정으로 성공했다. 제품 vue.config.js 및 의존성/lockfile은 수정하지 않았고 런타임 변환·압축은 유지했다.

```sh
cd /home/ablecloud/work/dhslove/cloud-s2s-1721/ui
VUE_CLI_SERVICE_CONFIG_PATH=../docs/validation/s2s-1721-20261119/build.config.js \
NODE_OPTIONS="--openssl-legacy-provider --max-old-space-size=8192" npm run build
```

재현 시 VUE_CLI_SERVICE_CONFIG_PATH는 절대 경로로 지정하는 것이 안전하다. 실제 실행은 ui/.s2s1721-build.config.js의 절대 경로를 사용했다. 배포한 번들과 소스/로케일 해시는 [ui-manifest.json](ui-manifest.json)에 있다. config의 docHelp postbuild 부산물은 복원했고 서버별 런타임 config는 덮어쓰지 않았다.

| 항목 | 31 GFS2 | 32 RBD |
| --- | --- | --- |
| 최종 정적 파일 백업 | /root/s2s1721-ui-20261119-152443 | /root/s2s1721-ui-20261119-152503 |
| 관리 PID(전후 동일) | 2852430 | 3173376 |
| 보존 API 클래스 SHA256 | 44fab23a3bd1da902f4d99ee99f754f1caca876f02f773c0414b79040b3238ed | 동일 |
| 최종 index SHA256 | 8b152ba74dadfe7a765101bb9ec01fc266bdd5a1874714b99c9ebc448963c1a5 | 동일 |
| UI payload SHA256 | f90047c474b85d198d2559cebe2b30b082e99f61142061095de96982c7ab6168 | 동일 |
| 배포 후 | HTTP 200 / WEB-INF 보존 | HTTP 200 / WEB-INF 보존 |

활성 `/usr/share/cloudstack-management/webapp`의 정적 경로만 갱신했다. 서버 디렉터리 전체 파일과 config, 기존 JAR, PID를 전후 대조했다. rsync --delete 또는 webapp 전체 교체는 사용하지 않았다. 기존 FTCTL/Search/ASN 표식과 새 S2S 표식을 실제 배포 자산에서 확인했다. 최초 배포 후 실제 관찰로 발견한 기본 열/번역/간격을 보완하여 최종 재배포했다. initial/pilot 증거는 최종 배포 증거와 구별한다.

## 로컬 검증

- 집중 UI 회귀 **129건/6 suite PASS**: 새 S2S 수명·연결·표현 49건, 기존 검색·ResourceView·VPC 소비 경계 80건. [tests-final.log](tests-final.log)
- 통합한 upstream 도메인 수명 회귀 **16건 PASS**. [domain-integration-tests.log](domain-integration-tests.log)
- 변경 JS/Vue ESLint와 git diff --check 통과. [lint-v2-final.log](lint-v2-final.log), [lint-verified.log](lint-verified.log)
- 최종 production UI 빌드 성공. [ui-build-verified.log](ui-build-verified.log)
- 미확정/응답 유실/작업2/잘못된 작업·대상/읽기 실패/권한·사용자·토큰·프로젝트·경로 전환/늦은 응답/중복 클릭·Ctrl+Enter/진행 중 취소 방지는 통제 fixture에서도 검증했다. 전체 UI suite 또는 전체 CI 성공을 주장하지 않는다.

## 양쪽 실제 UI/API 검증

| 경로 | 31 | 32 | 판정 근거 |
| --- | --- | --- | --- |
| UI 생성 → 미확정 → 같은 작업 재조회 | PASS | PASS | 생성 POST 각 1건. 31은 조회 응답 차단에 의한 timeout, 32는 query 503 3회. 각각 재조회로 job=1 및 실제 gateway ID 대조 |
| 실제 customjobid | PASS | PASS | 서버 접수 작업ID와 요청 UUID 일치, 최종 생성 job=1 |
| 확정 중복 오류 | PASS | PASS | 기존 GW VPC에 431 반환, 선택 VPC·오류·창 유지. 후보 제외는 #1722 예정이며 이 단계의 결함으로 확대하지 않음 |
| 목록/제목/복사/상세/탭 | PASS | PASS | Public IP 제목·breadcrumb, VPC/계정/도메인/프로젝트, default 상세, invalid tab→details, empty 연결 상태 |
| 프로젝트 연결·상세 이동 | PASS | PASS | 소유 project/VPC/gateway ID 일치. 전용 passive 연결 1개, 기존 상세로 UI 이동 |
| 연결 새로고침 오류/복구 | PASS | PASS | 통제 listVpnConnections 503, 기존 행 1개 유지·오류 안내, 재조회로 복구 |
| 일반 사용자 | PASS | PASS | 자기 GW 조회 및 소유 범위 검증, 관리자 사용자 표시 필드 0개, 잘못된 tab 정상화 |
| UI 삭제 → 목록 복귀 | PASS | PASS | 삭제 POST 각 1건, job=1 success=true, GET 부재 대조 후 창 닫기. 삭제 대상 ID 필터 제거, 나머지 범위 보존, 허위 조회 오류 없음 |

[31 API](31-api-checks.json), [32 API](32-api-checks.json) 및 create/delete-network.json에 민감정보를 제외한 요청·최종 작업 결과를 기록했다. API 스크립트의 최초 실행에서 31 network 증거가 list인 형식을 object로 가정한 오류를 수정했다. 최종 결과는 삭제 후 실제 부재와 불변 생성/삭제 영수증을 함께 확인한다. 생성된 customer의 비동기 응답을 fixture 스크립트가 동기 개체로 가정했던 초기 오류도 기존 전용 개체 조회로 복구했으며 추가 생성으로 재전송하지 않았다. 제품 결함/통과로 혼동하지 않는다.

## VM 화면 6구역 비교

**31·32 × 390/768/1280 × light/dark = 12문맥, 720항목 PASS.** [ui-matrix.json](ui-matrix.json), [ui-captures.json](ui-captures.json), [SHA256](ui-evidence-sha256.json). 원본 PNG와 DOM/CSS 측정 파일을 함께 제공한다. 텍스트 증거는 LF/행 끝 공백만 정리했고 PNG 바이트는 변경하지 않았다. 실제 viewport와 PNG 크기를 대조했고 이미지를 확대/축소하거나 합성하지 않았다. 동일 사이드바 폭과 테마를 유지한다. VM 편집 창은 열기/취소만 수행해 기존 VM을 변경하지 않았다.

- breadcrumb: 공통 글꼴/line-height/간격, 실제 gateway 표시자 및 모바일 줄바꿈.
- 목록: VM과 동일 14px 글꼴·12px 8px 셀 padding·테마 색상, 내부 표 스크롤. 문서 가로 넘침 0.
- 상세: 동일 요약/본문 비율, 18px 제목, 본문 카드24px, 상세 행12px 0px. 필드 수에 따른 높이는 서로 다르다.
- 탭/콘텐츠: VM과 동일 breakpoint에서 390은 위쪽, 768/1280은 왼쪽. 카드 대비 위쪽22px 간격, rail 최소100px(실제 VM100.25px, 0.25px 허용), 텍스트/내부 표 경계 확인.
- 대화상자: desktop md720px/본문24px28px/footer16px28px, 모바일366px/본문16px 등 공통 반응형 토큰 일치. 본문 auto scroll와 화면 안 footer, 상시 label·취소/위험 동작 구분을 확인했다.
- 키보드/focus: VM 편집 입력 자동 focus 및 취소, S2S 공통 focus guard/복원, 진행 중 Ctrl+Enter·Escape의 중복/닫기 방지, 각 조건의 닫기/재열기 경계를 확인했다. 자동 측정720개가 모든 키보드 동작 수를 뜻하지 않으며 단위와 실제 동작 기록을 함께 인수한다.

표본: [VM 31 dark1280](screenshots/31-1280-dark-vm-detail.png) / [VPN 31 dark1280](screenshots/31-1280-dark-s2s-detail.png), [VM 모바일 창](screenshots/31-390-light-vm-dialog.png) / [VPN 모바일 창](screenshots/31-390-light-s2s-delete.png). 고정된 720px 높이는 모든 비교에 동일하게 사용했다. 브라우저 viewport API가 기존 탭 실제 viewport를 바꾸지 않는 사전 시도 및 잘못된 크기의 예비 캡처는 최종 matrix에서 제외했다.

## 정리·보존 및 검증 한계

전용 qa-s2s1721-31/32 account·VPC·project·GW·customer·passive 연결을 모두 정리했다. UI로 account GW를 삭제한 뒤 API로 연결→customer→project GW→VPC→project→account 순으로 정리했다. UUID/이름 prefix를 확인해 기존 자원은 대상으로 삼지 않았다.

- [31 postcheck](31-postcheck.json): 35개 자원 문맥, [32 postcheck](32-postcheck.json): 27개 자원 문맥 보존. 기존 project의 Connected VPN 및 기본 GW/conn/customer 0개와 원래 VPC·공인 IP·계정/프로젝트 설정을 대조했다. 두 VM 기준 자원은 이름/상태/소유가 동일하고 각 호스트3대 Up/Enabled다.
- WEB-INF/config/JAR/PID 및 HTTP200, 클래스 로딩 오류 부재를 확인했다. 프로젝트 기본 보기·원래 dark 테마·viewport·조회 오류 주입을 복원했다. 최종 UI 빈 목록을 실제 확인했다.
- ISP/외부 peer는 없다. 전용 passive 연결은 **Disconnected 표시용 fixture**이며 실제 터널·암호화 패킷·BGP·처리량·장애 전환 성공을 검증하지 않았다. 관련 기존 메뉴/PSK/VPC 작업의 전체 재검증도 수행하지 않았다.
- full build, 전체 Cloud/UI suite, 수동 Actions 및 운영 병합은 수행하지 않았다. 자동 PR 검사 상태는 PR 보고에서 별도로 기록한다.
