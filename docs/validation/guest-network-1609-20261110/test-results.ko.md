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

# #1609 검증 결과

- 제품 커밋: `50129ccae1adfd162621c6fff9828805ba360013`. UI/번역/프런트엔드 테스트만 수정. Java/API·역할 정책 수정 없음.
- WSL ext4 로컬 lint와 9 suites / 134 tests 통과. 프로젝트 조회 대기 중 선제 숨김, Clipboard 성공/대체/거부, 권한·사용자·프로젝트·세션·대상·값 변경, KeepAlive, 목록·상세·실제 비밀번호 입력을 검사했다.
- 로컬 UI production 빌드 통과. 전체 Cloud 빌드와 수동 Actions 실행 없음. 기존 Vue 테스트 경고와 Browserslist 갱신 안내는 성공 판정과 별개다.
- 31·32 정적 파일664개 해시 일치, WEB-INF/META-INF·설정·관리 JAR·Mold PID 보존, /client/ HTTP200. [31](evidence/31-deployment.json) / [32](evidence/32-deployment.json).
- 목록/상세/탭 6화면 × 두 클러스터 × 세 폭 × 두 테마 =72조합. 기본 DOM 텍스트·속성의 실제 키 부재와 고정 마스크, 페이지 및 대화상자 본문 내부 가로 넘침0, breadcrumb 범위를 확인했다.
- 상세 3화면 × 두 클러스터 =6건의 표시·숨김·브라우저 클립보드 값 비교·실제 붙여넣기 일치. 고객 GW 수정 창의 이름 칸을 미제출 붙여넣기 검증용으로만 사용하고 취소했다. 시험 복사 후 클립보드를 비웠다.
- 프로젝트 왕복의 시작 시점부터 키/동작 숨김, 반환 후 마스킹, 같은 document 유지. 탭 왕복·리소스 갱신·페이지 새로고침 후 마스킹. 즉시 테마는 timeOrigin 동일.
- 기존 관리자·동일 도메인·도메인 관리자·프로젝트 읽기 전용의 조회 성공과 비회원 하위 도메인 API432 거부를 30건 확인했다. 읽기 권한이 있는 사용자의 명시적 열람은 기존 API 반환 범위 안에서 허용한다. [31](evidence/31-role-read-contract.json) / [32](evidence/32-role-read-contract.json).
- UI/API 자원 보존 검사: 31 망115/기존VM157(현재158·별도 신규1)/AS6/LB8,32 망98/VM85/AS7/LB8. NIC·호스트·LB 연결·VPN 키 동일, 양쪽 S2S Connected/Remote VPN Running. 시간에 따라 바뀌는 VM 통계만 LB 연결 비교에서 제외했다. 31의 추가 VM `rocky-95-airgap-repo-test`는 이번 절차로 생성하지 않았고 그대로 두었다. 기존157대의 모든 비교 필드와 NIC는 동일하다.
- 원본 JPEG 119장. [치수·해시 검증](evidence/image-verification.json), [실제 UI 상태](evidence/ui-state.json), [기능 검사](evidence/psk-ui-checks.json).

## 재검증 중 확인한 사항과 제한

최초 legacy 복사 경로는 알림 성공과 브라우저 세션 클립보드 조회 결과가 달랐다. 사용 가능한 Clipboard.writeText를 우선하고 기존 복사를 대체 경로로 유지하도록 보강했으며 최종6건은 조회/붙여넣기가 모두 일치했다. 대체 경로의 오류·문맥 변경은 로컬 회귀로 확인했다. Windows 네이티브 클립보드 직접 조회를 주장하지 않는다.

32의 초기 자동 관찰은 클릭 이후 렌더 완료 전 상태를 읽었다. 완료 프레임을 기다린 최종 결과로 재검증했고 초기 관찰은 비밀값을 제거해 별도 보관했다. 모바일 고객 GW 폼의 기존500px 고정 폭으로 인한 본문 잘림은 반응형 폭으로 고치고 대화상자 본문 scrollWidth/clientWidth까지 검사했다. 프로젝트 선택 직후 권한 조회 전에 이전 키가 잠시 남는 실제 구간은 전환 시작 이벤트에서 표시·복사·입력을 초기화하는 UI 수정으로 해결했다.

이 변경은 기본 화면 노출을 줄인다. API 응답과 브라우저 메모리의 키를 제거하는 변경이 아니며 명시적 복사는 사용자의 클립보드에 키를 쓴다. #1610 VPC VPN 생성 대화상자 수명/표준과 #1569 나머지 역할·조건부 회귀는 별도 범위다.
