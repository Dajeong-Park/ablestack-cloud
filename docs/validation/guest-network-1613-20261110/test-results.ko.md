<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.
-->

# 검증 범위와 한계

## 최종 소스 검사

제품 `295d82fe0f5a4266b69c9d8ba4d7fe8dff196f8e`의 6개 UI 파일 해시를 Native/WSL/빌드에서 대조했다. ACL31검사와 PCI/기존 네트워크·LB/VPN·프로젝트·역할 회귀를 포함한 **264검사/13 suite, lint, WSL ext4 정적 UI 빌드 통과**. 31/32 동일 패키지670파일의 활성 해시와 HTTP200·WEB-INF/META-INF·관리JAR/PID·설정 보존을 확인했다. 전체 Cloud 빌드·수동 Actions는 실행하지 않았다. 자동 CI는 로컬/배포 검증과 별도로 판정한다.

## 전체 UI 테스트의 기존 실패

최초 전체 UI lint 통과. Jest311 suite/4894검사는 305 suite·4884검사 통과,6 suite·10검사 실패였다. 이 시점 소스는 merge5030+ACL이며 PCI 가드 복원 전이다. PCI1건은 upstream Running staging과 기존 테스트/동작 차이여서 원래 Stopped 가드로 복원하고 최종 관련 suite로 확인했다.

나머지 **5 suite/9검사**는 동일 환경의 동기화 전 `6d94bdd6039` detached worktree에서도 같은 제목으로 실패했다. 테스트를 약화하거나 관련 없는 제품 동작을 바꾸지 않았다. **최종 전체 suite 녹색 또는 전체 Cloud CI 성공을 주장하지 않는다.**

- CreationSourceDeployment: 미준비 소유자 전환 기대1건.
- VmGroupOwnership: ready 미제공 소유자 계약3건.
- AutogenBucketBrowser: 기존 Modal 추출 방식의 generic popup2건.
- KubernetesNetworkUi: LB VM picker 사전 문맥/조회 기대1건.
- SnapshotTabs: 프로젝트 범위 이벤트 API 인자 기대2건.

[전체/기준선 비교](evidence/full-suite-baseline-comparison.json) · [최종 tests](evidence/tests-result.json) · [빌드](evidence/build-result.json) · [소스](evidence/product-build-attestation.json).

## UI·API와 통제 분기

양쪽 실제 누락 ACL·유효 ACL·이름 UUID fallback/이동/복귀, 부모 listVPCs/자식 VM503 제거·갱신 복구, 늦은 읽기 응답의 프로젝트 왕복을 확인했다. fallback과503은 브라우저의 **GET 읽기 응답만** 통제했다. 실제 DB/API 실패를 새로 만들거나 서버 응답 정책을 바꾸지 않았다. 자식 복구 시 렌더 직후와 후속 XHR 완료 사이의 관찰 시점 차이를 피하도록 최종 상태를 기다렸다.

관리자/회원/읽기 전용/비회원의 직접 VPC/ACL 조회16건, 회원/읽기 전용의 UI ACL 실제 이동/복귀, 비회원 UI 무노출을 확인했다. 읽기 전용의 Tier 생성은 비활성이다. 역할/멤버십 변경0.

24배치와 추가 읽기 전용/VM 모바일28건의 페이지 overflow·breadcrumb 경계를 확인했다. 원본 JPEG 치수/해시와 실제 viewport를 대조했다. 네트워크/ACL 정책이나 실제 패킷 전달을 바꾸는 작업이 아니며 이번 작업에서 패킷 격리/통신 성공을 새로 판정하지 않았다. LB 부하분산 측정도 제외한다.

## 이전 서버 작업의 자연 종료

31 #1616의 할당 job `9717c435-3a02-4040-afb7-8ffab5d2475b`는 17:40:15에 **job2/530**으로 종료됐다. 이전 pending 매핑1이 철회됐고 기존 안정67개 규칙 결과는 동일하다. VM/네트워크/VPC/LB ID 집합과 역할/멤버십은 모두 보존됐다. UI 배포 전부터 진행 중이던 서버 작업이며 이번 #1613의 변경 요청은0이다. runtime 성공이나 복구로 집계하지 않는다.

[현재 job 결과](evidence/31-prior-1616-job-current.json) · [31 자원 대조](evidence/31-resource-preservation.json) · [32 자원 대조](evidence/32-resource-preservation.json).
