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

# 빌드·런타임 보존·배포

WSL ext4 `/home/ablecloud/work/dhslove/cloud-asnumbers-1711`에서 변경 모듈만 빌드했다. Windows 원본 FTCTL 작업과 upstream 로컬 저장소는 수정하지 않았다.

## 모듈 검증

```bash
mvn -pl api -Dtest=DeleteASNRangeCmdTest,CreateASNRangeCmdTest,ListASNumbersCmdTest,ASNumberRangeValidatorTest,ASNumberQueryValidatorTest -DfailIfNoTests=false -Dcheckstyle.skip=true -Drat.skip=true install
mvn -pl engine/schema -Dtest=ASNumberDaoQueryTest -DfailIfNoTests=false -Dcheckstyle.skip=true -Drat.skip=true -Dskip.download=true install
mvn -pl server -Dtest=BGPASNumberRangeDeletionTest,BGPASNumberRangeTransactionTest,BGPASNumberQueryTest,BGPServiceImplTest,ASNListCountSerializationTest,ApiResponseSerializerTest -DfailIfNoTests=false -Dcheckstyle.skip=true -Drat.skip=true package
python3 docs/validation/asn-1711-20261118/checkstyle-changed.py
```

API 19개·schema 5개·서버 23개 PASS. schema는 template metadata 다운로드를 skip했고 template download failure 무시 안내가 있었다. 이는 release/SystemVM 또는 전체 Cloud 빌드가 아니다. Checkstyle은 변경 Java 9개만 저장소 cloud-style.xml/8.18로 PASS했다.

UI는 Node 20.20.2에서 기존 node_modules를 재사용했고 최종 70개 테스트가 PASS했다. 변경 파일 lint와 생성/삭제/유틸/공통 대화상자 4개 suite를 `--runInBand --coverage=false`로 검증했다. 전체 소스 coverage 수집을 시작한 최초 실행은 선택 suite 통과 후 불필요한 전체 계측 단계에서 종료했고, 최종 선택 검증은 정상 종료했다. 기존 Vue 아이콘/지시자 중복 등록 경고가 있다. 재현 명령:

```bash
cd ui
npm run test:unit -- --runTestsByPath tests/unit/views/infra/AsnRangeDeleteDialog.spec.js tests/unit/views/infra/AsNumbersTab.spec.js tests/unit/utils/asnRange.spec.js tests/unit/components/view/MoldDialog.spec.js --runInBand --coverage=false
bash prebuild.sh
NODE_OPTIONS=--openssl-legacy-provider node ../docs/validation/asn-1711-20261118/build-production.cjs
bash postbuild.sh
```

Production sourcemap을 끈 동일 빌더를 사용했다. buildVersion은 기존 `V4.0-4.0.15`를 유지한다. 처음 실환경에서 발견한 취소 포커스 오류와 Teleport footer의 Ctrl+Enter 누락은 수정 후 회귀 테스트에 포함했다.

## 관리 JAR 보존

기존 관리 JAR은 Epic 소스 전체와 동일하지 않으므로 통째 교체하지 않았다. 수정 전 소스의 소유 메서드 instruction과 현재 두 서버의 소유 메서드가 같은지 먼저 비교했다. 그 뒤 모듈 빌드의 아래 메서드만 ASM 7.3.1로 overlay했다. 선택 외 method Textifier와 모든 field가 동일하며, 다른 JAR ZIP entry byte는 모두 동일하다.

| 클래스 | 교체 | 보존한 다른 메서드 |
| --- | --- | --- |
| DeleteASNRangeCmd | execute | 3개와 기존 Admin 한정 annotation/fields |
| BGPServiceImpl | allocateASNumber, 트랜잭션 helper, deleteASRange와 해당 lambda | 18개, 기존 생성/조회/해제/피어 동작 |
| ASNumberDaoImpl | listAllocatedByASRange | 7개, #1710 Long 조회 포함 |
| ApiResponseSerializer | JSON/XML 목록 직렬화와 ASN count helper | 10개, 기존 unescape 포함 |

`BGPServiceImpl$1`과 다른 class는 원본을 유지한다. 모듈 classpath에 원본의 미사용 익명 nest member가 없으면 Mockito inline spy 재정의가 NestMembers 오류로 실패했다. 실제 JAR에 존재하는 원본 `$1`도 테스트 classpath에 포함한 뒤 overlay schema 5개·서버 23개가 PASS했다. 테스트 후 모듈 target을 원래 빌드 class로 복원했다.

| 클러스터 | 반영 JAR SHA-256 | 원본 백업 |
| --- | --- | --- |
| 31 | `c815a3ddc6e1bf986d78dab748bfd7c529e2d5e72e91db739fcd63e127330a1a` | `/root/asn1711-server-20261118-105851/cloudstack-before.jar` |
| 32 | `b5081d7f5b823397b6d7708230a55af3cf554413e9924aac635c6c025200e9f1` | `/root/asn1711-server-20261118-110011/cloudstack-before.jar` |

Java payload SHA-256: `1deef4266ac16cf05cb2f9faf54db807b5479d029c8769ad34cbd207738b3fa1`.

기존 JAR hash guard와 서명/중복 entry 검사, 백업, mold 재시작, HTTP 200/active 확인을 수행했다. 건강성 실패 시 원본 복원 경로를 배포 스크립트에 포함했다. 자동 복원은 필요하지 않았다. #1709 등록 class와 #1710 정확 조회 class/interface의 hash도 유지했다.

## 정적 UI 배포·복원

활성 경로 `/usr/share/cloudstack-management/webapp`에 index/assets/css/js/locales 등 정적 파일만 갱신했다. `WEB-INF`·존재 시 `META-INF`, `config.json`을 교체하지 않았다. `rsync --delete`를 사용하지 않았으며 원래 hash 이름의 asset도 남겼다. 전후 서버 디렉터리/설정 hash와 HTTP 200, FTCTL 세 marker를 확인했다.

최초 UI 백업은 31 `/root/asn1711-ui-20261118-110216/static-before.tgz`, 32 `/root/asn1711-ui-20261118-110231/static-before.tgz`다. 이후 UI 수정본도 각 배포 직전 덮어쓴 파일을 별도 백업했다. 최종 UI 백업은 31 `/root/asn1711-ui-20261118-112555`, 32 `/root/asn1711-ui-20261118-112607`이다. 최종 정적 artifact와 index hash는 결과 표에 기재한다. 할당 실패 예외 전달 보완의 직전 JAR 백업은 각각 `/root/asn1711-server-20261118-112153`, `/root/asn1711-server-20261118-112315`이며, 최초 백업은 위 표의 경로에 유지했다.

복원이 필요하면 해당 클러스터의 위 원본 JAR을 `cp --preserve=all`로 복구하고 mold를 재시작한다. 최초 `static-before.tgz`를 활성 webapp에 풀면 원래 index/locale이 복구되고 남겨 둔 원래 asset을 사용한다. webapp 루트를 삭제하거나 교체하지 않는다. 복원 후 WEB-INF·runtime config·HTTP·API 로그인을 다시 확인한다. 이번 검증에서는 복원을 실행하지 않았다.

Zone 잠금은 같은 Zone의 풀 생성/할당/삭제를 직렬화한다. 이는 경쟁 보호를 위한 선택이며 대규모 할당 성능이나 실 BGP 경로 적용 성능을 측정한 결과는 아니다. 백업과 raw 로그/manifest는 로컬 증적 디렉터리에 보존하고, 인증값은 보고서/이슈에 포함하지 않는다.
