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

# 로컬 검증 결과

WSL rocky ext4 `/home/ablecloud/work/dhslove/cloud-epic-1554/ui`에서 실행했다. 전체 Cloud/Actions 빌드를 수동 실행하지 않았다.

- 변경 Vue/utility/spec ESLint: `No lint errors found`.
- Jest: **6 suites / 79 tests passed**, 36.09초. 새 생성 회귀 11건을 포함한다.
- 대상: LoadBalancerCreate, LoadBalancerEdit, KubernetesNetworkUi, networkMutation, MoldDialog, NetworkRuleLayout.
- 새 테스트: 기본 AutoScale 생성·숨겨진 pending/NIC 상태 무시·모드 전환 초기화·manual Later/미선택/pending NIC 거부·중복 Ctrl+Enter·537 입력 보존/재시도·결과 미확정 job 재생성 방지·VPC Tier 선택 선행·프로젝트 변경의 이전 callback 폐기·권한 소실 시 닫힘.
- production UI build: 성공. `NODE_OPTIONS=--openssl-legacy-provider`와 source map 비활성 빌드 설정 사용. Browserslist 경고는 빌드 실패가 아니다.
- 기존 테스트 stub의 icon/router 경고가 있으나 최종 실패 0이다. 로컬 검증을 전체 Cloud CI 성공으로 표현하지 않는다.

정확한 명령은 [tests-result](evidence/tests-result.json), [build-result](evidence/build-result.json), 입력 파일 해시는 [source-hashes](evidence/source-hashes.json)에 있다.
