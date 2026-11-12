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

# 검증 결과와 한계

| 항목 | 31 GFS2 | 32 Glue RBD | 증거 |
| --- | --- | --- | --- |
| 수정 전 | 문법/TLS 정상, HAProxy 점검 실패 | 동일 | health-before, before-health-tab |
| 로컬 테스트 | Python39·UI51·lint/build 통과 | 동일 산출물 | test-summary, tests-result |
| 자산 생성 | 원 resource/antrun task 성공 | 동일 | script-asset-build-result |
| 기존 VR hotpatch | 원래 PID/권한 유지 | 동일 | vr-deployment |
| 관리/3호스트 배포 tar | checker만 변경 | 동일 | distribution-final |
| 새 VR 부팅 | r-1020, hash/signature 일치 | r-490, 동일 | fresh-router-bootstrap |
| 문법/직접 점검 | exit0/exit0 | exit0/exit0 | syntax-health-hotpatch/freshboot |
| 잘못된 설정10종 | 모두 실패, 라이브 불변 | 동일 | syntax-health-hotpatch/freshboot |
| 실제 TLS | 원래 지문·HTTP200·본문 | 동일 | tls-hotpatch/freshboot |
| 상태 체크 API/UI | 15/15정상 | 15/15정상 | health-freshboot, actual-fresh-health-request |
| UI503/재시도 | 창/입력/행 유지·실제 복구 | 동일 | health-read503/캡처 |
| 프로젝트/탭 이동 | 이전 응답 취소/무시·왕복 정상 | 동일 | project-roundtrip-health, late-tab-response |
| 기존 읽기 전용 계정 | 라우터 접근 제한·컨트롤0 | 동일 | readonly-ui-guard |
| VM UI 표준/반응형 | 탭/창12배치·VM5화면 | 동일 | responsive-theme-project, layout |
| VPN 복구 | ping+TCP3회 | 동일 | ra-fresh-router-recovered |
| 자원/JAR/PID/서버 보존 | 모두 통과 | 동일 | preservation, active-deployment-audit |

표의 JSON은 evidence/클러스터번호-이름.json에 있다. Python 수정 전 새 시험3메서드의 subtest4실패/오류1을 확인했다. 수정 후 신규30+기존9=39시험은 전부 통과했다. UI6suite51시험 중 신규 상태 체크8개는 표준 구조·새 검사/중복·성공 종료·실패 보존/복구·권한 변경·프로젝트/탭/config 지연 응답을 검증한다.

정상 systemvm generate-sources는 기존 cloud-console-proxy:4.23.0.0 로컬 의존성이 없어 실패했다. 동일 원 POM의 스크립트 생성 antrun task만 독립 실행했다. 전체 Cloud 빌드·정상 Maven package·수동 Actions 성공으로 취급하지 않는다. UI 빌드는 WSL ext4이며 관리 JAR/API는 변경하지 않았다. GitHub 자동 CI는 별도 최종 head 결과로 보고한다.

오류 설정은 라이브 설정을 복사한 임시 파일에서만 검사했다. 실제 daemon에 적용/재시작하거나 기존 인증서를 바꾸지 않았다. TLS는 원래 자체서명 인증서의 지문을 고정 대조한 통신 검사다. CA 신뢰/체인/만료 검증 완료를 의미하지 않는다. LB backend 분산/부하 측정은 제외했다.

새 라우터 초기 UI 조회 대기 및 브라우저 제어 시간 초과 표본, 응답 보류 도구가 자동 갱신을 잡은 표본은 성공으로 합산하지 않았다. 보류를 해제하고 실제 재시도/새 검사 응답·성공 종료를 별도 확인했다. 전환으로 취소된 요청은 늦은 응답의 주입 성공으로 간주하지 않고 취소로 기록했다. 시험용503/지연 응답은 controlled로 표시했다.

80개 checker 배포 시 PID 유지 검증과 전용2개 새 부팅 검증을 구분한다. 다른78개의 전체 부팅/서명/15항목 검사까지 수행했다고 주장하지 않는다. 기존32 경보2건과63행의 환경/넓은 잔여는 유지했다.
