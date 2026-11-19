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

# #1722 전역 VPN 게이트웨이 생성 후보·공인 IP 정책 검증

2026-11-20 KST. #1718의 S2S-04/P3를 구현하고 31 GFS2·32 RBD에서 변경 모듈만 배포·검증했다. [선행 #1721](https://github.com/ablecloud-team/ablestack-cloud/issues/1721)의 VM 표준 화면/작업 수명을 재사용한다. 다음은 **#1723/P3 Root 관리자 표시 설정 조회·수정 UI**이며 이번에 구현하지 않았다. Epic 전체 완료나 실제 터널 통신 성공을 의미하지 않는다.

## 구현과 소유 경계

- 현재 역할/프로젝트/소유 범위의 VPC를 페이지 끝까지 읽는다. 이름·ID·계정/프로젝트·Zone을 표시해 동명 후보를 구분한다. 페이지 한도에 도달하면 불완전한 후보를 사용하지 않고 범위 축소/재조회를 안내한다.
- 현재 VPC 상태와 VPC 오퍼링의 Vpn/SourceNat 제공자를 확인한다. 기존 GW 및 미지원/판별 불가 제공자는 사유와 함께 비활성화한다. Root는 기존 GW를 **fordisplay=true/false 각각 조회**한다. 제한 역할은 관리자 인자를 보내거나 숨김 GW 정보를 노출하지 않는다. 조회 가능한 범위의 사전 판별 뒤 서버 최종 중복 검증을 유지한다.
- SourceNat+VpcVirtualRouter는 할당된 Source NAT IP가 정확히 하나일 때 읽기 전용으로 표시하고 그 ID만 명시 전송한다. 0개·여러 개·다른 VPC/소유자/Zone·해제 중인 IP는 차단한다.
- Vpn+VpcVirtualRouter/SourceNat 없음은 기존 DomainRouter IP를 고정하거나, 적합한 미사용 VPC IP 및 서버 자동 할당을 조건부 노출한다. 임의 provider 전용/VM Static NAT/규칙 사용 중 IP는 후보가 아니다. 제공자 판별 실패를 일반 NAT 정책으로 대체하지 않는다.
- VPC 선택 변경은 IP를 즉시 지우고 세대 번호로 늦은 응답을 폐기한다. 제출 직전 VPC/소유자/오퍼링/기존 GW/IP를 다시 조회한다. 조회 실패 상태에서 이전 후보를 사용하지 않는다. VPC 선택은 오류 후 재조회에도 유지한다.
- API CreateVpnGatewayCmd의 vpcid 설명을 VPC ID로 정정했다. 폼에는 한국어 영구 label/helper를 사용한다. `customid`와 생성 `fordisplay` 옵션은 추가하지 않았다. Root 표시 수정/필터/생성 옵션은 #1723 범위다.
- 기존 MoldDialog md·세로 폼·MoldDialogActions·고정 footer/본문 스크롤·focus guard 및 job 추적을 유지했다. 실제 동시 생성 재현 중 발견한 중복 오류 안내는 한 번만 표시하도록 보완했다.

새 `s2sGatewayCreate.js`가 후보/제공자/IP 정책을 소유한다. 기존 gatewayRows/owner/context/job helper를 소비한다. 검증이 끝난 VPC 내부 생성창·PSK·Public IP 등 기존 메뉴는 변경하거나 전체 재검증하지 않았다. getIpAddressForVpcVr/configStaticNatForVpcVr 및 ApiResponseHelper의 **isForRouter → virtualmachinetype=DomainRouter** 계약을 따른다. `forprovider`는 외부 제공자 전용 범위 표시로, router 식별자와 혼동하지 않는다.

## 소스·변경 모듈 빌드

작업 트리 `/home/ablecloud/work/dhslove/cloud-s2s-1722`, 브랜치 `dhslove/s2s-1722-create-policy`.

- 기준: #1721 증거 커밋 `afbf6f26f14cfdb22cedb65d746c0a3f18784b2e`, Europa `41fe8cb0dd0c05e95c4ef6d110dafc26b85a01e2`.
- 제품 커밋: `e4ed59452bb`(후보/IP 정책·API 설명), **ebe84e0c1fe76768eebab764c4b3c0c37f46bf09**(오류 안내 중복 제거).
- 미병합 [#1738](https://github.com/ablecloud-team/ablestack-cloud/pull/1738)을 기반으로 하며 그 조상 [#1724](https://github.com/ablecloud-team/ablestack-cloud/pull/1724) 변경도 기준 브랜치 대비 PR diff에 포함한다. [#1725/#1720](https://github.com/ablecloud-team/ablestack-cloud/pull/1725)은 별도이며 배포된 UpdateVpnGatewayCmd를 보존했다. PR 병합은 수행하지 않았다.
- Maven **api 모듈만** WSL ext4에서 package. 변경 Create 명령 클래스 1개만 배포했다. UI 모듈만 production 빌드·정적 파일 배포했다. 전체 Cloud/server/호스트 패키지 빌드·수동 Actions는 실행하지 않았다. 원래 Windows FTCTL 변경 3개와 로컬 ablecloud-team 작업 트리는 수정하지 않았다.

```sh
mvn -pl api -Dtest=CreateVpnGatewayCmdMetadataTest -DfailIfNoTests=false -Dcheckstyle.skip=true -Drat.skip=true package
cd ui
VUE_CLI_SERVICE_CONFIG_PATH=/home/ablecloud/work/dhslove/cloud-s2s-1722/ui/.s2s1722-build.config.js \
NODE_OPTIONS="--openssl-legacy-provider --max-old-space-size=8192" npm run build
```

앞 단계와 동일하게 디버깅 소스맵만 제외한 별도 설정을 사용했다(productionSourceMap=false/Uglify sourceMap=false). 제품 vue.config.js·의존성·lockfile은 수정하지 않았고 런타임 변환/압축은 유지한다. [재현 설정](build.config.js)은 docs 경로용 require로 정리한 동일 설정이다. postbuild의 public/config.json 부산물은 복원했고 서버별 config를 덮어쓰지 않았다.

- [UI 회귀](ui-tests-verified.log): **169건/7 suite PASS**. 새 정책32건·기존 S2S 수명/추가 분기57건과 검색/ResourceView/VPC 경계80건. 전체 UI suite가 아니다.
- [API package](api-package.log): **3건 PASS**. 필수 VPC UUID/옵션 IP/Root 표시 권한/기본값 계약을 검증했다. api JAR의 실제 클래스와 추출 배포 클래스 바이트가 같고, 양쪽 기존 클래스와 javap 메서드 바이트코드는 동일하다. 변경은 설명 메타데이터다. [보존 증거](preservation-check.json)
- 변경 JS/Vue ESLint PASS. [lint-final.log](lint-final.log). [최종 UI build](ui-build-final.log) PASS.
- [Checkstyle 감사](checkstyle-audit.json): 변경 Java2개 오류0. api 모듈 전체는 2,159개 파일 중 **기존22파일/46건**으로 실패했다. 전부 기준 afbf6f26과 Git blob이 동일하며 변경2파일도 실제 검사에 포함됐음을 XML로 대조했다. 모듈 전체 통과로 표현하지 않는다.

## 배포·런타임 보존

| 항목 | 31 GFS2 | 32 RBD |
| --- | --- | --- |
| API JAR 백업 | /root/s2s1722-server-20261119-160048/cloudstack-before.jar | /root/s2s1722-server-20261119-160206/cloudstack-before.jar |
| 최종 UI 정적 백업 | /root/s2s1722-ui-20261119-161941 | /root/s2s1722-ui-20261119-161959 |
| 재기동 후 PID | 2900836 | 3221445 |
| 현재 JAR SHA256 | 9d3958219d781111ece30e7e9aeb83ec29f6b98b9c42ffe4a9fded4950a3c841 | 4c2835aa06e63503ec4cbff65c09b01b911024b474fe5d974823c864f48811f1 |
| Create 클래스 SHA256 | d55596c5577806457b1b93c096c150495b2be58fae76215e279753abb01d73d6 | 동일 |
| 최종 UI index SHA256 | c1e8dff222f145658b3100a16309cfb18244712b3601a4ae3c51569c01cabd9e | 동일 |
| 최종 UI payload SHA256 | 91a09e78484649f4c23ad9a4d15dd9f3a7c3029e3a473670cff1291d3e58b82f | 동일 |

명령 클래스1개 외 **모든 JAR 항목의 비압축 바이트가 동일**함을 검증했다. API 메타데이터 반영을 위해 관리 서비스만 재기동했고 listApis의 vpcid 설명을 양쪽에서 확인했다. 기존 #1720 Update 클래스와 #1719 검색 및 FTCTL 코드는 보존했다. UI는 활성 `/usr/share/cloudstack-management/webapp`의 정적 파일만 갱신하며 WEB-INF/config/기존 JAR를 보존한다. webapp 전체 교체나 rsync --delete는 사용하지 않았다. FTCTL/Search/ASN/새 S2S 표식을 확인했다.

[31 JAR 배포](31-deployment.json), [32 JAR 배포](32-deployment.json), [UI manifest](ui-manifest.json), 각 ui-deployment.log 및 postcheck.json 참조. UI/API 원래 배포와 최종 UI 보완을 pilot/final 로그로 구별한다. UI 최종 배포에서는 JAR/PID를 다시 변경하지 않았다.

## 양쪽 실제 UI/API 인수

| 시험 | 31 | 32 | 근거/판정 |
| --- | --- | --- | --- |
| 기존·숨김 GW 후보 차단 | PASS | PASS | Root true/false 조회 및 숨김 전용 VPC 비활성 사유. 제한 역할에는 false 조회/관리자 인자 미전송 |
| 미지원 오퍼링 | PASS | PASS | 전용 no-VPN 오퍼링·VPC를 실제 생성해 사유와 함께 비활성화 |
| 후보 없음 | PASS | PASS | 일반 사용자 소유 VPC3개가 기존 GW/미지원이 된 상태에서 생성 가능 후보 없음 안내·제출 차단 |
| IP 조회503/Source NAT 0개 | PASS | PASS | 통제 API 응답. 이전 IP 제거·제출 차단·VPC 선택 유지, 재조회 복구 |
| 선택 뒤 다른 관리자가 생성 | PASS | PASS | 선택 후 별도 API 생성, UI 제출 직전 재조회에서 차단, UI create POST0. 최종 보완본 오류 안내1개 |
| 확정431→재조회→성공 | PASS | PASS | 제한 역할에게 숨김 GW 정보 없이 서버 최종431 거부. 입력 유지, 전용 숨김 GW 정리 뒤 재조회 및 생성 |
| Root 계정/프로젝트/일반 사용자 생성 | PASS | PASS | 각3회 UI 생성. 표시 IP·ipaddressid 요청·job=1·저장 GW publicip/owner 일치, 정상 단계마다 POST1 |
| 소유 문맥 전환 | PASS | PASS | IP 응답 보류 중 취소→프로젝트 전환, 새 프로젝트 IP만 표시하고 실제 생성. 늦은 콜백 폐기는 단위 fixture에서도 별도 검증 |

[31 독립 API 결과](31-api-results.json), [32 독립 API 결과](32-api-results.json), [runtime 계약](31-api-contracts.json), create-network/controlled-network 파일에 민감정보를 제외한 요청과 결과를 남겼다. 실제 Root/일반 사용자 새 분기만 집중 검사했고 DomainAdmin의 관리자 인자 미전송 등은 unit fixture에서 검증했다.

다른 관리자의 **사전 검증 뒤~POST 사이** 경쟁까지 원자적으로 막는다고 주장하지 않는다. 서버의 최종 중복 거부가 계속 기준이다. 이 경계의 확정 거부/입력 보존은 실제 일반 사용자의 숨김 GW 431과 단위 POST 거부 fixture로 확인했다. unknown/중복 클릭/Ctrl+Enter/취소/영수증 등 #1721 수명 회귀도 집중 suite에 포함했다.

## 비 Source NAT·외부 제공자 검증 한계

양쪽 브라우저에서 **통제된 읽기 API 응답만** 사용해 다음 화면 분기를 확인했고 생성 POST는 모두0이다.

- SourceNat 없는 VR의 기존 DomainRouter IP는 읽기 전용.
- 기존 router IP가 없는 VR은 서버 자동 할당을 기본값으로 표시하며 적합한 미사용 IP를 수동 선택할 수 있다. 새 IP/할당량 확인 안내를 표시한다.
- 외부 제공자는 일반 Source NAT로 대체하지 않고 사유·후보 비활성·제출 차단.

예시 `198.51.100.31/32`와 00000000 UUID는 이 UI 응답 fixture의 값이며 실제 할당/생성 결과가 아니다. 자동 할당 시 ipaddressid 생략, 수동/고정 IP 전달, 소유/Zone/상태/정적 NAT/규칙/IP 변동 검증은 unit에서 확인했다. SourceNat 없는 실제 제공자/ISP/피어가 없어 **실환경 자동 IP 할당·Static NAT 설정·실제 터널/패킷/장애 전환은 미검증**이다. 이 항목은 UI–API·소스/fixture 계약으로 범위를 제한한다.

## VM 표준 6구역·반응형 인수

31·32 × 390/768/1280 × light/dark **12문맥/720항목 PASS**. [ui-matrix.json](ui-matrix.json), [검사 로그](ui-matrix-check.log), [원본 기록](ui-captures.json), [해시](ui-evidence-sha256.json). 원본 PNG159개와 DOM/CSS를 제공한다. 같은 조건의 최종 관찰을 조건별로 하나씩 인수했고, 예비/중복 오류 단계 캡처는 제외했다. PNG는 확대·축소·합성하지 않았다. 텍스트 증거는 LF/행 끝 공백만 정리했다.

- breadcrumb·목록·상세·탭·탭 본문·생성/삭제창을 VM과 같은 viewport/테마/사이드바 폭으로 비교했다. VM 편집창은 열기/취소만 수행했다.
- 목록14px/셀12px8px, 제목18px, 본문24px/상세 행12px0px, 390 상단 탭·768/1280 왼쪽 탭, 탭 상단 간격22px 및 rail 최소100px을 대조했다. VM의 실제100.25px과 차이0.25px은 1px 허용 범위다. 업무 필드 수에 따른 높이는 다르다.
- 새 생성창 desktop md720px/본문24px28px/footer16px28px, mobile366px/본문16px 등 VM 공통 토큰 일치. 영구 VPC/IP label, 읽기 전용 IP, 후보별 사유·소유 구분을 확인했다.
- **12조건 모두 실제 본문 스크롤 이동**, 화면 안 footer, Tab의 제출 버튼 이동, Escape 닫기/생성 버튼 focus 복원을 확인했다. [create-matrix-actions.json](create-matrix-actions.json). 문서 가로 넘침은 없고 넓은 표만 내부 스크롤한다.
- VM 기준 캡처는 #1721 UI80c83488에서 수집했다. VM/공통 레이아웃·대화상자 스타일 파일은 이번 제품 커밋에서 바꾸지 않았으며 최종 VPN UI와 실제 CSS/치수를 직접 비교했다. 최종 S2S 캡처와 인수는 UI ebe84e0c1fe76768eebab764c4b3c0c37f46bf09에서 수행했다.

[VM mobile dialog](screenshots/31-390-light-vm-dialog.png) / [새 생성 mobile](screenshots/31-390-light-s2s-create.png), [새 생성 dark](screenshots/32-1280-dark-s2s-create.png), [숨김·미지원 후보](screenshots/31-390-dark-s2s-options.png). 캡처는 시험 당시 화면이며 시험 개체는 남겨 두지 않았다.

## 정리와 보존

전용 qa-s2s1722-31/32의 계정1·프로젝트1·VPC4·no-VPN 오퍼링1 및 최종 GW3씩을 모두 정리했다. 초기 숨김 GW와 경쟁 재현 GW도 각각 정리했다. UUID/이름 prefix/소유자 확인 후 GW→VPC→오퍼링 비활성/삭제→프로젝트→계정 순으로 처리했다.

- [31 보존](31-postcheck.json): 36개 자원 문맥. [32 보존](32-postcheck.json): 28개 문맥. 기존 default/project VPN UUID·IP·owner·상태와 VPC/계정/프로젝트/공인 IP 보존.
- [오퍼링 전체 필드](offering-preservation.json): 기존7개씩 전체 필드 동일(서비스/제공자 목록 순서만 정규화). 기준 VM의 이름/상태/owner와 호스트 각3대 Up/Enabled 확인.
- WEB-INF/config/최종 JAR/클래스/PID 및 HTTP200, 최근 클래스 로딩 오류 부재 확인. 기본 프로젝트·원래 dark 테마·viewport·통제 API 응답을 복원했고 최종 UI0건을 실제 확인했다.

전체 Cloud/UI/API suite나 전체 CI 통과를 주장하지 않는다. 자동 PR License/Lint/충돌 검사 상태는 PR/이슈 완료 보고에서 별도로 기록한다. 기존 FTCTL·스토리지·호스트 패키지와 ISP 데이터 경로는 변경하지 않았다.

증거 수집기의 중첩 자격정보 필드 마스킹을 강화하고, 이번 PR에 추가되는 선행/신규 검증 JSON의 해당 값도 마스킹했다.

## 후속 원본 캡처 감사·보완

최종 보고용 이미지를 직접 열어 확인하다 32번의 1280px light/dark 원본20장 모두 x=901 이후 왼쪽 화상이 정확히 반복되는 현상을 발견했다. VM 기준 캡처에도 같았다. 종전159장 치수/SHA 검사는 파일 무결성 검사이며 이 반복 화상까지 판별한 것이 아니었다. 해당20장은 시각 인수에서 제외하며 원본은 이력으로 보존한다.

동일 배포본에서 브라우저 viewport를 1280×720으로 다시 지정한 뒤 두 테마의 VM 목록/상세/편집창과 VPN 목록/상세/연결 탭/삭제창/후보/생성창/스크롤을20장 다시 수집했다. 정상 전체 화면 배치를 브라우저 화면과 PNG로 확인했고 VM의 본문 폭/여백/글꼴/색·탭·dialog 본문/footer 규격을 다시 대조했다. [재관찰 DOM/CSS](32-1280-recheck-captures.json), [제외 목록·SHA·인수](32-1280-recheck-audit.json) 참조. 최종 사용 가능한 시각 증거는 기존139장+재수집20장=159장(보존 원본 포함 총179장)이다. 이미지 합성/리사이즈/보정은 하지 않았다.

전용 fixture는 이미 정리됐으므로 보완 관찰은 기존 VPC Source NAT IP10.10.32.101, 기존 프로젝트 GW10.10.32.151/Connected 연결 및 같은 기준 VM을 읽기만 했다. 생성/수정/삭제는 제출하지 않았으며 편집/삭제창은 취소했다. 자동 스크롤은 양쪽 테마76px을 확인했고, 기본 범위·다크·일반 viewport로 복원했다. 제품 소스/배포 변경은 없으며 새 빌드는 필요하지 않았다.
