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

# 검증 결과와 실제 적용

## 로컬 집중 테스트

- 수정 전 준비 실패 테스트: 6건 중4실패·오류0으로 누수를 검출했다.
- 수정 후 Java208건: NicPreparationRollbackTest7, NicHotplugFailureTest12, NetworkOrchestratorTest61, VirtualMachineManagerImplTest101, NicStateResponseTest4, ApiResponseHelperTest23, 실패0.
- UI4 suite34건 통과. VM NIC 상태/가드·탭·ProjectMenu·listRefresh를 검증했다. 변경 파일 lint 통과.
- WSL ext4에서 `mvn -pl api,engine/orchestration,server ... package`, 변경 모듈 Checkstyle·UI production build 통과. `rat.skip=true`이며 전체 RAT/전체 Cloud CI 성공을 뜻하지 않는다. 전체 Cloud 빌드나 수동 Actions 실행은 하지 않았다.

[Java 집계](evidence/focused-java-tests.json) · [모듈 명령](evidence/module-result.json) · [UI 테스트 명령](evidence/ui-tests-result.json) · [UI 빌드](evidence/ui-build-result.json)

## 실환경 실패와 복구

| 사이트·작업 | 실제 job | 결과와 대조 |
| --- | --- | --- |
| 31 기존 ghost 명시적 UI 해제 | 25db9aa2-61b7-4f8a-a823-a56241d38a4d | 성공1, 기존 실패 NIC·매핑 제거, 정상4 NIC 보존 |
| 31 VLAN 부족 UI 추가 | 45b837fe-a117-4573-83a1-f5befacc5ce7 | 실패2/530, 신규 NIC·매핑0 |
| 31 동일 UI 재시도 | f9fa2ccf-a3f3-450e-8941-9c73edc3dd2b | 실패2/530, 중복0 |
| 31 VLAN3230 확보 후 UI 재시도 | f49f8a17-c0d1-468c-b568-270b933bb33e | 성공1, API·libvirt5, 새 MAC 일치 |
| 32 전용 offering hosttag 불일치 | 24b5b3c2-968e-458c-a15b-733ab4fb421d | 실패2, No suitable host found, 신규 사용자 NIC·매핑0 |
| 32 전용 hosttag 복구 후 UI 재시도 | 0b17ab3d-e5be-4d82-bcc5-84321ca54e1a | 성공1, API·libvirt6, r-507 재사용 Running |

각 `evidence/*-ui-job-*.json`, `*-oracle-*.json`에 API·DB·실제 libvirt를 기록했다. Shared 네트워크의 Setup 상태와 재사용 가능한 정지 시스템 라우터는 사용자 ghost NIC와 구분한다. 실패 직후 사용자 NIC가 없고 기존 런타임 MAC 집합이 유지되는 것을 확인했다.

## DHCP·DNS·기존 통신

새 NIC는 처음에 게스트 OS 연결 profile이 없어 DHCP를 실행하지 않았다. 새 NIC에만 전용 NetworkManager 자동 DHCP profile을 만들고 `never-default=yes`, `ignore-auto-dns=yes`로 기존 default route와 DNS 설정을 보존했다. 실제 guest IP/MAC와 라우터 dnsmasq lease가 API·libvirt와 일치한다. 새 NIC source-bound DNS UDP/TCP 각각12/12, 해당 라우터 ICMP10/10이다.

기존 NIC 감시 구간은 각 사이트 UTC14:15:26~14:49:15, 2027완료 표본이다. DNS UDP/TCP·ICMP·SSH 각각2027성공, 실패0. 이 구간은 backend 재시작 **이후**이며 재시작 전체 무중단을 주장하지 않는다. 두 VM과 라우터는 각각 같은 호스트31-3/32-2에 배치했다. 외부 스위치 VLAN trunk·외부 인터넷 통신·LB 부하분산은 이번 판정에 포함하지 않는다.

[31 새 NIC 통신](evidence/31-new-nic-real-communication.json) · [32 새 NIC 통신](evidence/32-new-nic-real-communication.json) · [31 임대](evidence/31-new-nic-router-dhcp-lease.json) · [32 임대](evidence/32-new-nic-router-dhcp-lease.json) · [31 기존 연속 표본](evidence/31-existing-nic-continuity-samples.json) · [32 기존 연속 표본](evidence/32-existing-nic-continuity-samples.json)

## 배포와 보존

활성 `/usr/share/cloudstack-management/lib/cloudstack-4.23.0.0-ABLESTACK.Mold.jar`에 변경 클래스4계열과 inner class를 반영했다. 다른 effective archive entry204833개의 해시는 보존했다. 양쪽 변경 class payload는 같으며 ZIP 새 entry timestamp 때문에 전체 JAR SHA는 다르다. 기존 전체 JAR는 WSL 비공개 백업으로 보존했다. 안전한 same-filesystem hardlink rollback과 atomic replacement를 사용했고 검증 후 임시 hardlink만 정리했다.

UI는 활성 webapp의 static675개 파일만 반영했다. 양쪽 manifest 불일치0, `/client/` HTTP200, `WEB-INF`·`META-INF`·기존 config와 server 파일 보존이다. FTUI async marker도 확인했다. 호스트 패키지나 FTCTL 소스·타이머는 변경하지 않았다.

[31 backend](evidence/31-backend-deployment.json) · [32 backend](evidence/32-backend-deployment.json) · [31 static](evidence/31-deployment.json) · [32 static](evidence/32-deployment.json) · [최종 VM/NIC 보존](evidence/final-preservation.json)

## 역할·UI와 검증 한계

Root·owner·peer·readOnly의 listNics를 양쪽8경로에서 확인했다. 읽기 전용 계정의 실제 addNic API는 양쪽401·job없음, UI 생성/연결/해제 버튼0이다. listApis 메타데이터 노출은 실행 권한의 증거로 사용하지 않았다. 프로젝트 default 왕복 시 이전 NIC 탭 제거, QA 복귀·VM 목록/상세/NIC/네트워크 링크·breadcrumb 이동을 실제 화면에서 확인했다.

390/768/1280 × 밝음/다크 ×2클러스터12조합에서 실제 viewport·이미지 크기, 수평 스크롤 좌/중/우의 상태·작업 도달, 대화상자 경계와 빈 선택 제출 비활성을 확인했다. 즉시 테마 전환의 performance.timeOrigin은 유지됐다. 모바일 경보 배너는 기존 경보이며 이번 수정의 오류나 전체 클러스터 정상 판정 근거가 아니다.

응답 유실·Agent 불가·명확한 hypervisor 거절은 집중 테스트로 검증했으며 실환경 RPC 장애를 강제 주입하지 않았다. 실제 신규 연결 실패는31 capacity,32 router placement 경로다. 실패 원인인 capacity·hosttag와 제품 누수/표시 문제를 분리했다. 시스템 전체 연결 상태를 실시간으로 증명하는 API를 새로 만들지는 않았다.

## 등록된 저장소 CI와 집중 검증의 구분

구현 source87dd587의 자동 License Check는 미승인3574개로 실패했고, 전체 저장소 Lint도 BOM/줄끝/공백/codespell/flake8/markdownlint에서 실패했다. 전체 PR CI가 녹색이라고 보고하지 않는다. 이 보고서7개 문서의 실제 ASF hook·markdownlint는 통과했고 Java 변경 모듈 Checkstyle와 UI 변경 파일 lint는 통과했다. 자동 CI 실행과 로컬 변경 모듈 빌드는 별도 결과다. 이후 보고 전용 commit의 자동 CI는 별도 head에서 조회한다.

[자동 CI 원인·링크](evidence/source-ci-snapshot.json) · [문서 한정 ASF/Markdown 검사](evidence/scoped-document-checks.json) · [기존 작업 보호](evidence/protected-worktrees.json)
