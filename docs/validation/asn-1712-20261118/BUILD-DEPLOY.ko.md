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

# 빌드·배포·복원

소스는 `dhslove/epic-1708-asnumbers`, 시작 HEAD는 `1545558aa151972f1691a42f37554c3ddf7ec07c`다. Windows Epic worktree에서 편집하고 WSL ext4 `/home/ablecloud/work/dhslove/cloud-asnumbers-1712`에서 변경 Maven 모듈/UI를 빌드했다. 원본 FTCTL dirty 파일과 로컬 upstream 저장소는 보존했다. /mnt/c 빌드나 전체 Cloud 빌드는 하지 않았다.

## 재현 명령

```bash
mvn -pl api -Dtest=ListASNumbersCmdTest -DfailIfNoTests=false -Dcheckstyle.skip=true -Drat.skip=true install
mvn -pl engine/schema -Dtest=ASNumberDaoQueryTest -DfailIfNoTests=false -Dcheckstyle.skip=true -Drat.skip=true -Dskip.download=true install
mvn -pl server -Dtest=BGPASNumberQueryTest,BGPASNumberRangeDeletionTest -DfailIfNoTests=false -Dcheckstyle.skip=true -Drat.skip=true package
python3 docs/validation/asn-1712-20261118/checkstyle-changed.py
python3 docs/validation/asn-1712-20261118/prepare-overlay.py
python3 docs/validation/asn-1712-20261118/test-overlay.py
cd ui
npm run test:unit -- --runTestsByPath tests/unit/utils/asnSearch.spec.js tests/unit/components/AsnSearch.spec.js tests/unit/views/AutogenAsnSearch.spec.js tests/unit/views/AutogenPublicIpListScope.spec.js tests/unit/views/AutogenGuestNetworkSearch.spec.js tests/unit/views/AutogenVnfSearch.spec.js --runInBand --coverage=false
bash prebuild.sh
NODE_OPTIONS=--openssl-legacy-provider node ../docs/validation/asn-1712-20261118/build-production.cjs
bash postbuild.sh
```

UI는 기존 node_modules를 재사용했다. schema template metadata 다운로드는 skip했다. Node 20.20.2/Java 17/Maven 3.6.3을 사용했다. 전체 커버리지 계측이나 release/SystemVM 빌드는 수행하지 않았다.

## 관리 JAR

두 서버의 수정 전 소유 메서드 instruction이 저장소 기준과 일치함을 확인하고 ASM 7.3.1로 변경 메서드만 반영했다. BGPServiceImpl.listASNumbers와 ListASNumbersCmd.execute만 교체한다. 서비스에는 ACL용 AccountManager 주입 field 하나만 추가하며 원래 fields와 각각 22개/10개의 다른 메서드를 보존한다. 다른 ZIP entry byte와 이전 Epic class도 유지했다.

| 클러스터 | 새 JAR SHA-256 | 직전 원본 백업 |
| --- | --- | --- |
| 31 | `3981f2dfe14600c6b9aa2053fad25e0ff5561d1601d6c52bc0203829273da578` | `/root/asn1712-server-20261118-125142/cloudstack-before.jar` |
| 32 | `a7121afa4cf23fbe98db9cb3c3cb78b8146871ae6ead98187aa21a52bf22eb84` | `/root/asn1712-server-20261118-125304/cloudstack-before.jar` |

Java payload SHA-256는 `e837ed16c37e2b63fc7a5a2de4cad754b063d35e25238eb2b339ac64caa44799`다. runtime BGP class `caf3e7c00471650f314ee36adb4477b69905922504e1745c02f521127942d246`, List command `24af9ef2606db9bb831cede91a2777db1da74314d93719121426f7574099ffd6`를 양쪽에서 확인했다. `BGPServiceImpl$1`도 그대로 보존하며 overlay 테스트에 포함했다. 실제 domain 권한 조회로 새 주입 field의 동작을 확인했다.

배포는 기존 JAR hash/서명/중복 entry guard, 백업, mold 재시작, active/HTTP 200 순서다. 건강성 실패 시 원본 자동 복원 경로가 있다. 이번에는 자동 복원할 필요가 없었다. 수동 복원이 필요하면 위 백업 파일을 기존 JAR 경로로 복사하고 mold를 재시작한 뒤 HTTP·로그·class hash를 확인한다.

## UI 정적 배포

활성 `/usr/share/cloudstack-management/webapp`에 static allowlist만 갱신한다. WEB-INF·존재 시 META-INF·runtime config를 보존하며 루트 교체나 rsync --delete를 사용하지 않는다. 덮어쓰는 기존 파일만 백업하고 기존 hash asset도 남긴다. 전후 서버 디렉터리 hash, config hash, HTTP 200, `blockingLoadingState`/`fetchSyncProgress`/`extractJobId`와 `asn-search-control` marker를 확인한다.

최초 UI 백업은 31 `/root/asn1712-ui-20261118-130037`, 32 `/root/asn1712-ui-20261118-130048`다. chip 보완 후 최종 배포의 artifact/index hash와 백업 경로는 EVIDENCE.json에 기록한다. static-before.tgz를 해당 webapp에 덮어쓰면 직전 index/동일 이름 asset을 복원할 수 있다. 새 hash asset의 잔존은 이전 index 동작을 바꾸지 않는다.

검증 helper는 비밀번호를 환경 변수로만 읽는다. 원본 class/JAR·세션/인증값·전체 runtime 로그는 저장소에 커밋하지 않는다.
