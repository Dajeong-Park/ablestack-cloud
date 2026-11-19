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

# ASN-01 빌드·배포 증적

기준 소스: `10150bdead45260b58313879d27402383b6b9bf8` (`ablestack-europa`). 수정/빌드는 dhslove 전용 worktree에서 실행했다. 기존 Windows/WSL FTCTL 작업과 로컬 upstream은 수정하지 않았다.

## 로컬 변경 모듈·UI 검증

WSL ext4: `/home/ablecloud/work/dhslove/cloud-asnumbers-1708`. Java 17 / Maven 3.6.3 / Node 20.20.2. 전체 Cloud 빌드와 GitHub Actions 실행은 하지 않았다.

```sh
mvn -pl api -Dtest=ASNumberRangeValidatorTest,CreateASNRangeCmdTest -DfailIfNoTests=false -Dcheckstyle.skip=true -Drat.skip=true install
mvn -pl server -Dtest=BGPServiceImplTest,BGPASNumberRangeTransactionTest -DfailIfNoTests=false -Dcheckstyle.skip=true -Drat.skip=true package
python3 docs/validation/asn-1709-20261117/checkstyle-changed.py
cd ui
node node_modules/eslint/bin/eslint.js src/utils/asnRange.js src/views/infra/zone/AsNumbersTab.vue tests/unit/utils/asnRange.spec.js tests/unit/views/infra/AsNumbersTab.spec.js
node node_modules/@vue/cli-service/bin/vue-cli-service.js test:unit tests/unit/utils/asnRange.spec.js tests/unit/views/infra/AsNumbersTab.spec.js tests/unit/utils/listRefreshMixin.spec.js tests/unit/components/view/MoldDialog.spec.js --coverage=false --runInBand --forceExit
sh prebuild.sh
NODE_OPTIONS=--openssl-legacy-provider node ../docs/validation/asn-1709-20261117/build-production.cjs
sh postbuild.sh
```

- API 7개, 서버 8개, 최종 UI 4 suites/55개 PASS. UI lint/production build PASS.
- 서버 4개 통합 fixture는 실제 TransactionLegacy/JDBC/H2 트랜잭션과 행 잠금을 사용한다. DAO adapter는 테스트용 SQL/Mockito이며 전체 MySQL DAO·스키마 통합을 대신하지 않는다. 두 번째 번호 persist 실패의 전체 rollback/재시도, 1000 허용/1001 거부, 동시 겹침, 다른 Zone 독립성을 검증했다. 실제 MySQL 동시 겹침은 31/32에서 별도 검증했다.
- 변경 Java 6개에 repository cloud-style.xml/Checkstyle 8.18 검사 PASS. 전체 API 모듈 Checkstyle은 변경하지 않은 다른 파일의 46개 위반으로 실패했다. 전체 모듈 Checkstyle·전체 UI 회귀·RAT·전체 Cloud CI 통과로 보고하지 않는다.
- 기존 icon 중복 등록 경고, Jest open-handle 종료 안내와 Browserslist 구버전 경고가 있다. `--forceExit` 사용, 전체 open-handle 원인 분석은 하지 않았다.
- production source maps를 끄는 기존 검증 방식의 builder를 사용했다. runtime config.json은 배포하지 않고, pre/postbuild의 로컬 config.json 변경은 복원했다.

## 기존 런타임 보존

31/32의 관리 UberJar는 서로 다른 기존 빌드다. 배포 전 BGPServiceImpl의 할당/해제/조회 등 일부 메서드가 기준 소스와 다른 것을 발견해 전체 클래스 교체를 중단했다. 테스트 서버에는 **등록 메서드와 해당 lambda 2개만** 모듈 빌드 결과에서 옮긴 overlay를 적용했다. PR의 제품 소스는 정상 Maven 빌드를 위한 소스 변경이며 이 overlay는 기존 테스트 배포를 보존하기 위한 전용 증적이다.

`OverlayRegistration.java`는 ASM instruction/annotation/frame/exception 정보를 포함한 Textifier 비교로 기존 다른 메서드 19개 보존과 등록 메서드 2개 일치를 확인한다. 기존 클래스의 필드/클래스 메타데이터를 유지한다. overlay를 server target/classes에 일시 적용한 상태에서도 같은 서버 테스트 8개가 통과했고 원래 target class를 복원했다. 배포 이후 로드된 클래스 바이트 SHA를 다시 확인했다. 이 배포는 저장소 전체 또는 관리 JAR 전체를 새로 빌드한 결과와 동일하다고 주장하지 않는다.

관리 JAR의 기존 모든 ZIP entry는 아래 2개 교체와 1개 추가 외 바이트가 동일함을 배포 스크립트에서 검증했다. 각 서버 원본 JAR을 보존하고 HTTP 건강성 실패 시 원본 복원하도록 했다.

| 클래스 | 배포 SHA-256 |
|---|---|
| `com/cloud/bgp/BGPServiceImpl.class` | `b2346dca770a84674dd2cf04603a2c7e08068b6b371665463c8f3b21fb51e5c9` |
| `com/cloud/bgp/ASNumberRangeValidator.class` | `995e597e53aafcb5ba333a29b11583dfe6f78716b2eb98e98767a4c9e2010f50` |
| `org/apache/cloudstack/api/command/admin/bgp/CreateASNRangeCmd.class` | `5112a5ea4f74c3be80f2e53e8f373da616c8ecc59d5fe9a0def3b1f8cfafeb50` |

| 클러스터 | 이전 JAR SHA-256 | 이후 JAR SHA-256 | 원본 JAR 백업 |
|---|---|---|---|
| 31 | `50099ed65a179c25d8b5e5ed7d6f4284f875eca729b6f93ad35f0b2ef6f03153` | `2ea1bdb5d6582704546b0eb10621b5a377574d2a6bb0a2a16fcc8c4357faa3c9` | `/root/asn1709-server-20261117-043436/cloudstack-before.jar` |
| 32 | `37af4160d3f0cad958a04b27b10e077f56c52acb948e233a84ce75ece6f68b75` | `acd95db24f941248fb70d7444ff8c717366a73660ed66246596121345bd49e0a` | `/root/asn1709-server-20261117-043612/cloudstack-before.jar` |

최종 UI archive SHA-256: `2c51e1a76d41441a11432007124cbcd6550be040cbe47757aadd2d81c3689e74`. `/usr/share/cloudstack-management/webapp`의 정적 allowlist만 갱신했다. WEB-INF, 기존 META-INF 유무, runtime config.json과 이전 정적 파일을 보존했고 삭제 동기화를 사용하지 않았다. 양쪽 HTTP 200/mold active, 기존 FTCTL markers `blockingLoadingState`/`fetchSyncProgress`/`extractJobId` 및 `asn-range-create` marker를 확인했다. FTCTL 런타임 전체 검증은 수행하지 않았다.

최종 정적 파일 백업: 31 `/root/asn1709-ui-20261117-044431`, 32 `/root/asn1709-ui-20261117-044443`. 첫 배포 전 백업도 각각 `/root/asn1709-ui-20261117-043557`, `/root/asn1709-ui-20261117-043756`에 유지했다. 이전 hash 파일을 남기고 변경되는 기존 파일만 tar로 백업했다. 신규 hash assets를 삭제할 필요 없이 기존 index/덮어쓴 정적 파일을 복원할 수 있다.

```json
{
  "uiPayloadSha256": "2c51e1a76d41441a11432007124cbcd6550be040cbe47757aadd2d81c3689e74",
  "sourceSha256": {
    "ui/src/views/infra/zone/AsNumbersTab.vue": "c2fa0c2f70a0e51a911681d45ce9db47411db6d6b1dcdea57ee0da5949073c25",
    "ui/src/utils/asnRange.js": "c64d0bfe3a409f0d74df644ff8304de8a8ca319f632a1bf3a494d44ec5625bde",
    "ui/public/locales/en.json": "f60598a8a3dc0e7bb5d11e43b68ca75ee9c88b331f54e108c600f094ce0bb23a",
    "ui/public/locales/ko_KR.json": "1a384828d875399281cefa99a33425957163d70e65d6830600b12625c43a4e58"
  }
}
```

제품 소스 변경의 Java hash(검사/빌드 입력 대조):

```json
{
  "api/src/main/java/com/cloud/bgp/ASNumberRangeValidator.java": "51bb208071332dbbcf81bf55b11b6f9e67e7041b65ef2539af5b9dd7585b777c",
  "api/src/main/java/org/apache/cloudstack/api/command/admin/bgp/CreateASNRangeCmd.java": "44f4483b99fa227340cab878930b8b1fb0be72068e63cf909182529b5b5a9952",
  "api/src/test/java/com/cloud/bgp/ASNumberRangeValidatorTest.java": "6af7f80c5dc752a2210d0dfa18658fcd9f3f63f0ed70a8a33ada02b371ba297e",
  "api/src/test/java/org/apache/cloudstack/api/command/admin/bgp/CreateASNRangeCmdTest.java": "b33a8800d7ecf318c8a128454fd4805e6a2a9a0e0fe6eb6a63519fd0d8ebc615",
  "server/src/main/java/com/cloud/bgp/BGPServiceImpl.java": "cb24bbb3e0e14debd3cb48872dd5fb766d9e9a4cd574fcc06f39368fecba3d69",
  "server/src/test/java/com/cloud/bgp/BGPASNumberRangeTransactionTest.java": "30ae88cccef4d9448c0938a1c0df48a6eda45c30b1ebbf6aa35041e8bac3cd0c"
}
```

## 증적 재실행 조건

API 스크립트는 `MOLD_PASSWORD` 환경변수를, SSH 스크립트는 `SSHPASS` 환경변수를 사용한다. 비밀번호나 세션 키를 저장하지 않는다. `live-api.py`는 최초 범위가 비어 있는 전용 테스트 Zone에서만 시작하며 반환된 시험 범위 ID만 삭제한다. `audit.py before/after`, `verify.py`는 주요 설정 보존 비교용이다. SSH/배포 도구는 WSL ext4에서 실행한다.

`deploy-both.py`는 사전 수집한 기존 JAR/class와 hash manifest, 컴파일한 overlay가 있어야 실행된다. 원래 baseline은 서버 백업으로 복구할 수 있다. 이미 변경된 JAR에는 preflight hash guard가 작동하므로 재실행을 위해 guard를 제거해서는 안 된다. 바이너리·전체 API 인벤토리·원본 로그는 로컬 검증 폴더에 보관하며, 본 PR에는 검토에 필요한 결과와 재현 도구만 포함했다.
