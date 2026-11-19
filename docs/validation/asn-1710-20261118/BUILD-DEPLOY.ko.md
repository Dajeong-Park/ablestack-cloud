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

# ASN-02 빌드·배포·복원 증적

Windows 구현: `C:/Users/ablecloud/.codex/worktrees/epic-1708-asnumbers/ablestack-cloud`, branch `dhslove/epic-1708-asnumbers`. WSL ext4 빌드: `/home/ablecloud/work/dhslove/cloud-asnumbers-1710`, 시작 `ee32ad9ecfed5e978d1216e72c615b98b395e4db`. 기존 FTCTL dirty 작업과 로컬 upstream 저장소를 수정하지 않았다.

## 변경 모듈 검증

Java 17 / Maven 3.6.3. 전체 reactor/Cloud 빌드 및 수동 GitHub Actions는 실행하지 않았다.

```sh
mvn -pl api -Dtest=ASNumberQueryValidatorTest,ListASNumbersCmdTest,ASNumberResponseTest,ASNumberRangeValidatorTest,CreateASNRangeCmdTest -DfailIfNoTests=false -Dcheckstyle.skip=true -Drat.skip=true install
mvn -pl engine/schema -Dtest=ASNumberDaoQueryTest -DfailIfNoTests=false -Dcheckstyle.skip=true -Drat.skip=true -Ddownload.skip=true -Dexec.skip=true install
mvn -pl server -Dtest=BGPASNumberQueryTest,BGPServiceImplTest,BGPASNumberRangeTransactionTest -DfailIfNoTests=false -Dcheckstyle.skip=true -Drat.skip=true package
python3 docs/validation/asn-1710-20261118/checkstyle-changed.py
```

API 16개·schema 4개·서버 10개 모두 PASS. schema의 template metadata 실행은 skip했고, template download failure 무시 경고가 있었다. 이는 release/SystemVM 패키지 빌드가 아니라 변경 Java 모듈 검증이다. H2 bootstrap의 DB driver null 및 SLF4J NOP 안내는 테스트 환경 경고이며, 실제 GenericDao SQL/JDBC/결과 hydration 테스트 4개는 실행·통과했다. #1709의 중간 저장 실패 주입 테스트에는 의도한 예외 로그가 포함된다.

변경 Java 9개는 저장소 cloud-style.xml/Checkstyle 8.18로 PASS. 전체 모듈 Checkstyle·전체 UI·전체 pre-commit을 새로 통과했다고 주장하지 않는다. 기존 Epic PR lint는 전역 기존 파일 오류와 이번에 수정한 #1709 증적 Markdown 공백 오류 두 건이 있었고, RAT 기준/이전 HEAD의 미승인 4077개 동일 결과는 앞선 증적이다. 최종 PR CI 결과는 PR 상태/후속 comment에서 별도 확인한다.

## 기존 런타임 보존

기존 관리 JAR 전체는 현 Epic 소스와 동일하지 않다. #1709의 등록 변경과 기존 할당/해제 처리를 보존하기 위해 기존 class에 **선택한 메서드만 모듈 빌드 결과에서 overlay**했다. ASM 7.3.1의 instruction 비교에서 서비스의 getter/DAO 호출 타입 두 곳과 DAO의 검증 prefix 외 조회 로직 차이가 없음을 확인했다.

| 클래스 | 반영 | 보존 검증 |
|---|---|---|
| ListASNumbersCmd | 새 모듈 class | 다른 getter/field annotation 유지, 정확 번호 field/getter/검증/인자 예외 분리만 변경 |
| ASNumberQueryValidator | 새 class | 0~4294967295/ASCII raw 검증 |
| BGPServiceImpl | listASNumbers만 교체 | 기존 다른 메서드 **20개**의 Textifier 결과 동일 |
| ASNumberDao | 조회 signature만 교체 | 다른 method 6개 동일 |
| ASNumberDaoImpl | 정확 조회 method만 교체 | 다른 method 7개·기존 fields 동일 |

선택 method는 모듈 빌드와 일치하고, 다른 method/fields는 기존 런타임을 유지한다. overlay를 schema/server target class에 일시 적용한 상태로 DAO 4개·서버 10개를 다시 실행해 PASS한 뒤 원래 모듈 class를 복원했다. 배포 payload는 기존 두 서버에서 동일한 대상 class baseline임을 확인한 후 생성했다. 운영 jar 전체를 새로 빌드한 결과와 동일하다고 주장하지 않는다.

각 관리 서버의 원본 JAR을 보존하고 기존 JAR hash guard를 확인했다. 새 JAR은 아래 4개 class 교체/1개 추가 외 **모든 기존 ZIP entry byte가 동일**함을 검증했다. 건강성 실패 시 원본 JAR 복원 경로를 포함했다. 관리 서비스 재시작 후 HTTP 200/mold active/WEB-INF와 runtime config/index hash 유지, 런타임 class hash 일치를 확인했다. #1709의 CreateASNRangeCmd·ASNumberRangeValidator byte도 그대로다. 정적 UI는 배포하지 않았다.

| 클러스터 | 원본 JAR SHA-256 | 적용 JAR SHA-256 | 원본 백업 |
|---|---|---|---|
| 31 | `2ea1bdb5d6582704546b0eb10621b5a377574d2a6bb0a2a16fcc8c4357faa3c9` | `7d965988b48de2f138aae20ad792b0acdf625fb8a77313679f529349df8a03b0` | `/root/asn1710-server-20261118-004504/cloudstack-before.jar` |
| 32 | `acd95db24f941248fb70d7444ff8c717366a73660ed66246596121345bd49e0a` | `997f73133b2d7e3768e3fe3365f915f9198c05d6e2f386b164a9e448746ce73d` | `/root/asn1710-server-20261118-004623/cloudstack-before.jar` |

Payload SHA-256: `9c8ed05e9a640f4423b1594b5c7e5dae4ed19f6a8c013a4fb23f0279ed917d44`.

```json
{
  "com/cloud/bgp/BGPServiceImpl.class": "598d81746cd8dd1693d176483104466f3959b57210661e6ae1aefd26a6c4d35e",
  "com/cloud/dc/dao/ASNumberDao.class": "80bad1fe2d16d77bade2b38dce0573cc06a03cd922200f3b6b6ebdd4eca0e696",
  "com/cloud/dc/dao/ASNumberDaoImpl.class": "a13759daf36cb076d6b9edf8574fa5acd2b92b20af5f3a548d4f7219b34dd0e2",
  "org/apache/cloudstack/api/command/user/bgp/ListASNumbersCmd.class": "3b1a536019577d41c68afec23c2b08f11daa83efa00880222d93bb906d932251",
  "com/cloud/bgp/ASNumberQueryValidator.class": "28e3b39e1d00d90e530984e4ae67dce926fc09bfc8ff1336ccec4b768ae6f870"
}
```

검사/빌드 입력의 최종 소스 hash:

```json
{
  "api/src/main/java/org/apache/cloudstack/api/command/user/bgp/ListASNumbersCmd.java": "ee4b859dc44a7a7fa3fe707df4b64e29efaafef6038cebadd974c5d9c0a5d2d3",
  "api/src/test/java/org/apache/cloudstack/api/command/user/bgp/ListASNumbersCmdTest.java": "98aab75d790424161d8a6f7645fc3c1485194c52e471885de5ec7cf6a0094082",
  "engine/schema/src/main/java/com/cloud/dc/dao/ASNumberDao.java": "e01c6f1f5e92faa8d1c79cca9ca60fc0d17dd6016de02422f5e97db377f7d2e2",
  "engine/schema/src/main/java/com/cloud/dc/dao/ASNumberDaoImpl.java": "bd7fb88430b51c802201307ff4c09e41897b60721d58ef495930a0ff7deab3f3",
  "server/src/main/java/com/cloud/bgp/BGPServiceImpl.java": "90bc39d06f8300b47d187958c124516fff21385d373903429a32e20ce8d98622",
  "api/src/main/java/com/cloud/bgp/ASNumberQueryValidator.java": "80e5baaf3ed26993d1da87270331ca8912e045825299149b6783acab984d756d",
  "api/src/test/java/com/cloud/bgp/ASNumberQueryValidatorTest.java": "88cd5db50178f8903f9791966538b895c114fcef3d56dd778335c33c79043a38",
  "engine/schema/src/test/java/com/cloud/dc/dao/ASNumberDaoQueryTest.java": "81f3e37a8a65b7490de271fa5396f7a7a4518304eacf6b0cbf2d146bed115ce0",
  "server/src/test/java/com/cloud/bgp/BGPASNumberQueryTest.java": "dc2d70684aaa268ca321fb7254f026b10307960f53413f63bb934da4e6cfea1a",
  "engine/schema/pom.xml": "a7c527d391911cd5e334f4cfaa6be84a422ff58d68b733041b91c0597b3e85ea"
}
```

## 증적 재실행 조건

`api.py`/`live-api.py`는 MOLD_PASSWORD 환경변수, SSH 배포 도구는 SSHPASS 환경변수를 사용한다. 인증값은 파일/보고서에 저장하지 않는다. API 검증은 최초 비어 있는 전용 Zone에서 작은 두 범위만 만들며 UI 대조를 위해 보존한다. `live-api.py cleanup`은 반환된 시험 범위 ID만 삭제한다. `audit.py before/after`와 `verify.py`는 선택 주요 설정 보존 비교다.

SSH/아티팩트/배포 도구는 WSL ext4 전용이다. `OverlayASLookup.java` 실행에는 사전 수집한 기존 class와 세 모듈 빌드 결과가 필요하다. `deploy-both.py`는 overlay 및 사전 JAR hash가 있어야 하고 이미 바뀐 JAR에 재적용하면 guard가 거부해야 한다. 원본은 위 서버 백업에 있다. 바이너리/전체 인벤토리/원본 로그는 로컬에 보관하며 PR에는 검토 가능한 요약·재현 도구·대표 화면만 포함했다.
