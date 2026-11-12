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

# 사용자 확인용 자원

기존 시험 자원을 삭제하지 않았다. 두 UI 탭은 관리자·해당 프로젝트의 세션 고정 정책 대화상자로 남겼다.

| 클러스터 | 프로젝트 | 네트워크 | 확인 위치 | 보관 정책 |
| --- | --- | --- | --- | --- |
|31 GFS2|qa-gn1569-31-shared-reg|qa-gn1569-31-vpn-lb|Public IP 10.10.31.149 → 부하 분산 → qa-gn1569-31-backend-tls-review → 설정/세션 고정|qa-gn1626-31-review|
|32 Glue RBD|qa-gn1569-32-shared-reg|qa-gn1569-32-vpn-lb|Public IP 10.10.32.177 → 부하 분산 → qa-gn1569-32-backend-tls-review → 설정/세션 고정|qa-gn1626-32-review|

두 정책은 AppCookie, Cookie 이름 QA_SESSION, 길이32, 보관 유지시간3h, 요청에서 학습=false다. UI가 반환한 false를 유지한다. VIP19111→18443의 원래 인증서/SSL backend, VM·NIC·VPN사용자·서비스·프로젝트 역할을 유지했다. 실패 작업의 Revoked 이력은 현재 정책과 구분된다. 현재 API 원본은 final-policy/fixture/ssl-fixture JSON에 기록했다. 비밀번호·PSK·개인 키·세션키는 공개 증적에 포함하지 않았다.
