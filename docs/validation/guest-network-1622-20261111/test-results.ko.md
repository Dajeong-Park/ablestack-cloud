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

# 검증 결과와 경계

| 항목 | 31 GFS2 | 32 Glue RBD | 증거 JSON |
| --- | --- | --- | --- |
| 수정 전 재현 | 세션200/서명 생략200/일치401 | 동일 | baseline-reproduction |
| server 모듈 빌드 | 신규10+기존62=72 통과 | 동일 산출물 | module-build-result, test-summary |
| 클래스/실제 런타임 | verifyRequest 하나·새 PID | 동일 | bytecode-delta, backend-deployment, active-deployment-audit |
| 역할·인증 API | 124건: 허용40/거부84 | 동일 | role-signed-session-matrix |
| 세션/서명 정확한 일치 | HTTP/error/인증서 ID34쌍 | 동일 | authentication-equivalence |
| 거부된 SSL 변경 | 48건·작업0 | 동일 | role-signed-session-matrix |
| 키 자체 deny/다른 명령·서명/만료 | 거부 유지 | 거부 유지 | role-signed-session-matrix |
| 최종 읽기/거부 구간 | 설정/mtime/PID/인증서 불변 | 동일 | read-denial-runtime-preservation |
| 허용된 서명 소유자 변경 | 실제 job1 | 실제 job1 | signed-owner-allowed-job |
| 소유자 UI 교체/복원 | 실제2건 job1 | 동일 | owner-ui-replace/restored 요청/job |
| 명시 조회 allow/deny·비구성원 UI | 읽기 전용/메뉴 비활성/대상 거부 | 동일 | 관련 캡처·ui-state |
| VM 표준·프로젝트·테마 | SSL12배치+VM5캡처 | 동일 | layout, instant-theme, project-return-state |
| 최종 TLS/기존 자원 | 원래 지문·HTTP200·보존 | 동일 | tls-final, preservation |

파일은 evidence/의 클러스터 번호 접두사에 있다. 새 키는 쿠키/세션이 없는 독립 클라이언트에서 SignatureVersion3/HMAC-SHA256으로 호출했다. 명시 allow/deny 역할과 키 자체 deny는 별도로 만들었다. 매핑된 인증서가 없는 정상 LB의 빈 결과도200으로 대조했다. DomainAdmin은 기존 도메인 계층 권한을 유지하며 다른 프로젝트가 무조건 금지된다고 가정하지 않았다.

32번 배포 중 구버전 관측과 UI 교체 시험에 겹친 설정 보존 표본은 성공 판정에서 제외했다. 최종124건은 UI 쓰기가 없는 별도 구간에서 다시 실행해 설정/PID/mtime 불변을 확인했다. 최종 결과를 앞선 무효 표본과 합산하지 않았다.

수정 전 회귀는10건 중6실패/오류0, 수정 후10건과 기존62건은 전부 통과했다. 전체 Cloud 빌드·수동 Actions·qemu/RPM 빌드는 실행하지 않았다. 로컬 Maven package·live UI/API/TLS를 GitHub 자동 checks/전체 CI 성공과 구분한다.

UI 소스/스타일은 변경하지 않았다. 기존 VM 표준 창과 읽기·쓰기 가드의 회귀를 확인했다. JPEG54장의 signature/viewport/decoded 치수/해시를 대조하고 모바일 다크/조회 deny 화면을 직접 검토했다. #1624 HAProxy 건강 오판정·외부 Health Monitor 제공자 미준비 및63행의 넓은 잔여 조건은 이번 완료 범위가 아니다. LB backend 분산/부하 측정은 제외했다.
