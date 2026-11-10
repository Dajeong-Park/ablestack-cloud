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

# UI 전용 설계

InternalLbRules는 기존 응답의 loadbalancerrule 배열만 읽는다. 각 항목의 포트는 유효한1~65535 정수/정수 문자열만 표시하고 빈 값·불완전 값은 대시다. 상태는 공통 Status의 display-text를 사용하며 Vue의 텍스트 바인딩을 통해 표시한다. 별도 JSON 파싱·HTML 렌더링·API 조회·편집 기능은 없다.

DetailsTab은 ilb/loadbalancerrule만 이 컴포넌트로 렌더링하고 필드 자체가 없는 경우에도 레이블과 대시를 유지한다. ListView의 같은 열도 ilb에 한해 재사용한다. 다른 리소스의 일반 렌더링은 유지한다. AutogenView는 기존 조회 실패 신호를 ilb 상세에도 전달해 같은 리소스의503 뒤 오래된 값이 현재 성공처럼 보이지 않게 한다.

기존 ResourceView의 진행/실패 신호, 현재 route id·project id·listLoadBalancers 메타데이터와 project-switch-start/end를 확인한다. 준비되지 않은 문맥에서는 행 대신 대시를 출력하며 로컬 규칙 사본을 보관하지 않는다. 값의 원본과 API/권한 정책을 바꾸지 않고 기존 요청 버전/범위 처리와 함께 동작한다.

VM UI의 색상 변수 --ui-text-primary/secondary·--ui-border와 공통 배지를 재사용한다. 데스크톱3열 grid,767px 이하1열, 각 값 줄바꿈/최소 폭0으로 긴 표시가 페이지를 밀지 않는다. 목록 표 자체의 기존 가로 스크롤은 유지한다. 기존 탭 툴바·breadcrumb·대화상자·작업 버튼의 위치/흐름은 바꾸지 않았다.

제품 변경은 UI4파일과 신규 단위 테스트1파일이다. WSL ext4의 기존83602add66e 위에 Native 제품e4b008d6과 동일한5파일 해시를 복사해 검사/빌드했다. 빌드 후 docHelpMappings를 비우는 기존 postbuild의 config 변경은 동기화 시 전후를 검증한 후 원래 추적 설정으로 복원한다. 실제 관리 webapp의 config.json은 배포 대상에서 제외했다.

정적 배포는 활성 `/usr/share/cloudstack-management/webapp`의 허용된 정적 파일만 원자 교체하며 WEB-INF/META-INF·관리 JAR·설정·서비스PID를 전후 대조했다. 전체 webapp 삭제/교체나 rsync --delete는 하지 않았다. 32번 디스크를 고려해 원격 업로드/즉시 백업은 `/dev/shm/gn1618-ui-*`, durable 정적 백업은 WSL ext4 `/home/ablecloud/work/gn1618-ui/backups/`에 보관했다. 원격 RAM 백업은 재부팅 후 사라질 수 있으므로 durable 백업을 롤백 기준으로 한다.

[소스/빌드 attestation](evidence/product-build-attestation.json) · [31 배포](evidence/31-deployment.json) · [32 배포](evidence/32-deployment.json) · [manifest](evidence/manifest.json).
