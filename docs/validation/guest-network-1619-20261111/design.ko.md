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

# 변경 설계

LoadBalancerSslDialog를 분리하고 기존 Public LB 관리 메뉴와 생성 폼의 인증서 선택 경로에 연결했다. 조회는 listSslCerts, 할당/해제는 각각 해당 API와 queryAsyncJobResult를 검사한다. 메뉴와 직접 실행 메서드를 모두 보호하며 이름으로 권한을 추정하지 않는다. 생성 폼의 선택도 실제 할당 권한이 있어야 가능하다.

프로젝트 리소스는 소유 projectid를 명시한다. 개인 리소스는 accountid 또는 권한 있는 정확한 계정 조회 결과를 사용한다. 허용하지 않은 listAccounts를 임의 호출하지 않는다. 전체 페이지를 검증해 후보를 읽고, 상태에는 id/name/fingerprint만 남긴다. 인증서 원문/개인키/PSK를 표시 상태에 보관하지 않는다.

기존 networkMutationMixin/NetworkMutationStatus로 checking→submitting→running→success/failed/unknown을 처리한다. 명확한 API 거부와 job2는 입력을 유지해 재시도할 수 있다. 조회 실패 시 쓰기를 잠그고 업데이트로 복구한다. 제출/실행 중에는 닫기·중복 실행을 막고, 결과 불명은 신규 제출을 막으며 알려진 job을 같은 ID로 다시 조회한다. 성공 후 현재 인증서와 후보를 다시 읽는다. 그 조회가 실패하면 경고와 재조회가 필요하다.

사용자/세션/역할/API 목록/프로젝트/리소스/규칙/탭/경로를 문맥 키로 사용한다. project-switch-start에서 즉시 초안을 버리고 버전/문맥이 바뀐 응답과 콜백은 적용하지 않는다. 서버가 이미 받은 작업을 취소한 것으로 표현하지 않는다.

VM 표준 MoldDialog md와 vertical 폼, 전체 폭 선택, 하단 버튼, 모바일 줄바꿈과 공통 테마 색상을 적용했다. VM 목록/상세/NIC/네트워크 연결창/breadcrumb를 실제 UI에서 대조했다. 390/768/1280·밝음/다크·관리자/SSL 읽기 전용을 확인했다.

WSL ext4에서 UI만 로컬 빌드하고 active webapp의 정적 파일만 원자적으로 갱신했다. 루트를 삭제/교체하거나 rsync --delete를 사용하지 않았다. server-side 디렉터리/설정·JAR/PID는 그대로다. WEB-INF·HTTP200·670파일 해시와 FTCTL 표식을 확인했다. META-INF는 원래 없으며 같은 상태다.
