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

# 확인용 자원과 화면

관리자 기본 보기에서 기존#1617 시험 자원으로 확인한다. 새 서버 자원은 만들지 않았고 기존 자원도 삭제/수정하지 않았다. 양쪽 브라우저를 아래 상세 탭의 실제19018·22·정상 화면에 남겼다. 모바일/다크로 전환하고 규칙 영역까지 스크롤하면 세로 배치를 확인할 수 있다.

|클러스터|기존 규칙|VIP/포트|UI|
|---|---|---|---|
|31|qa-gn1617-31-same-vip-lb|10.210.31.188:19018→22|[상세](http://10.10.31.10:8080/client/#/ilb/237808a1-e9d2-4401-a5d7-38dc1e73ccf6?tab=details) · [목록](http://10.10.31.10:8080/client/#/ilb)|
|32|qa-gn1617-32-same-vip-lb|10.211.32.150:19018→22|[상세](http://10.10.32.10:8080/client/#/ilb/87210bec-2e3b-410c-89f6-6e6941f2e1d7?tab=details) · [목록](http://10.10.32.10:8080/client/#/ilb)|

같은 VIP의 기존19016·API 검증19019, 다른 VIP의19017 규칙과 backend VM/NIC·controller b1010/b484를 보존했다. 프로젝트별 기존 Internal LB와 읽기 전용 계정/권한도 그대로다. 통제 복수/누락 응답은 이미 해제해 최종 화면은 실제 API의 단일 규칙이다. 사용자 삭제 지시 전까지 기존 확인용 자원을 유지한다.
