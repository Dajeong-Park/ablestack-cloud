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

# 원인과 변경 설계

기존 checkLoadBalance는 bind directive 전체 문자열과 기대 주소/포트를 비교했다. SSL용 crt/alpn/TLS/cipher suffix 때문에 정상 SSL listener가 실패했다. parseConfig도 빈 줄에 의존했고 backend가 없으면 일부 검사를 건너뛰었다.

HAProxy 공식2.6의 [bind grammar](https://docs.haproxy.org/2.6/configuration.html)는 주소 집합과 옵션을 구분한다. 수정본은 bind의 첫 토큰에 있는 쉼표 endpoint를 IP 리터럴/포트 범위로 정규화한다. 다중 bind·IPv4/IPv6·괄호·ip@/ipv4@/ipv6@를 비교하며 추가/누락 endpoint도 거부한다. 동일 endpoint의 동등한 표기는 허용하고 잘못된 주소군·괄호·포트를 거부한다. 기대 balance·HTTP mode·backend 이름/IP/포트 검사도 유지하며 기대 backend 누락을 거부한다. backend가 없는 정상 규칙도 bind 검사는 수행한다.

옵션을 분리한 뒤 잘못된 SSL 설정을 통과시키지 않도록 실제 haproxy -c -f 검사를 먼저 수행한다. [공식 관리 문서](https://docs.haproxy.org/2.6/management.html)의 check-only 모드이며 소켓을 열거나 서비스/설정을 바꾸지 않는다. shell=False·10초 제한·진단8192자 제한, 바이너리 부재/시간 초과/문법 오류는 실패다. 데이터가 없는 라우터의 기존 skip 동작은 유지한다. 섹션 헤더로 구분해 탭/공백/주석/빈 줄 없는 EOF도 처리한다.

상태 체크 UI는 공통 detail-tab-toolbar, small table, MoldDialog(md)/MoldDialogActions, vertical form을 적용했다. 목록 새 조회는 마지막 정상 행을 보존하며 실패 경고를 표시한다. 실제 검사 성공에만 창을 닫고 실패 시 스위치/창/기존 결과를 유지한다. loading/listRefreshing 및 API 허용 여부를 버튼/handler 양쪽에서 확인한다. project-switch-start/end와 resource/path/tab/project/user/role/token/API목록 문맥으로 응답을 검증한다. 바뀐 문맥의 config/health 응답은 버린다. 기존 보안 정책/API 구현은 그대로다.

배포는 기존 tar를 기준으로 checker 한 항목만 교체했다. 다른 파일/메타데이터는 동일하다. Running VR80개는 같은 경로를 원자 교체하며 mode/uid/gid·HAProxy/xl2tpd PID를 대조했다. 두 전용 시험망만 cleanup restart하고 backend와 같은 호스트에 배치해 부팅 archive/signature를 검증했다. 다른 VR의 서명/DB 버전을 임의 조작하거나 일괄 재시작하지 않았다. 관리 서비스는 재시작하지 않았다.
