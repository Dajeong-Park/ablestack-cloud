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

# 검증·배포와 한계

## 실제 브라우저와 실제 작업

31 GFS2·32 Glue RBD의 기존 `qa-gn1569-31/32-vpn-lb` 프로젝트 시험 LB를 사용했다. 실제 UI를 클릭하고 XHR 접수 응답/job 결과를 저장했다. [작업 감사](evidence/job-audit.json)는 실서버 job 14건(job1 11, job2 3)을 별도 API로 재조회한다. `*-final-real-job2-*`는 실제 잘못된 LbCookie 모드에 대한 530이며, `*-http431/503-*`·missing/transport/query-loss는 CDP XHR 통제 주입이다. 실제 서버 장애로 확대 해석하지 않는다.

| 항목 | 31 | 32 | 증적 |
| --- | --- | --- | --- |
| 실제 job2 입력 보존·변경된 정책 재조회·보정 job1 | 통과 | 통과 | final-real-job2/final-context/corrected-lb-cookie wire/state |
| HTTP431·503·전송 결과 소실·접수ID 누락 | 통과 | 통과 | wire의 injected 표시·unknown state |
| job0·삭제 중 잠금/Escape/CtrlEnter·중복 POST 방지 | 통과 | 통과 | final-delete-pending wire/state |
| 조회503 세 번·같은 job 복구 | 통과 | 통과 | 31 실제 same-job 회귀 및 32 final-app-same-job-recheck |
| 늦은 결과 | 다른 상세 탭 유지 | 기본 프로젝트 유지 | late-tab/project-query-result; 신규 POST0 |
| 프로젝트 왕복·고유 label/input ID | 통과 | 통과 | project-return-label-links |
| 즉시 밝음/다크·1280/768/390 | 통과 | 통과 | final-light/dark·instant-theme·layout |
| 읽기 전용 세션 고정 비활성 | 통과 | 통과 | readonly-session-guard UI snapshot |
| VM 표준 목록·상세/NIC·연결창·모바일 | 비교 완료 | 비교 완료 | vm-standard 캡처; 연결 제출 없음 |
| 열린 설정 메뉴 resize | 닫힘·넘침0 | 닫힘·넘침0 | resized-dropdown-closed |

32의 최종 AppCookie 작업 `4c9fb9ea-6ec2-4beb-9918-49e73c6a2d27`은 세 번 조회 실패 후 창을 숨겼다가 같은 정책을 다시 열고 **동일 job만 조회·추가 POST0·성공 종료**했다. 31도 같은 job 복구 및 탭 이동 늦은 결과 무시를 확인했다. 브라우저 도구의 이벤트 펌프 오류/이미 계속된 interception ID·조회 timeout은 시험 도구 진단으로 구분했으며 제품 성공 증적은 실제 job/UI 결과로 판정했다. `31-diagnostic-revoked-history-blocked` 및 posts가 비어 있는 초기 corrected wire는 성공으로 세지 않는다.

## 로컬 시험과 배포

[lint/집중 시험](evidence/tests.log): 15 suites·229/229. 신규 대화상자33개와 공통 mutation·LB backend/SSL·VM device·프로젝트·MoldDialog·목록 회귀를 포함한다. [SourceBased 재열기](evidence/source-reopen.log)는 해당1개만 실행했고 제외된14개/전체 Kubernetes suite 통과로 보고하지 않는다. [production build](evidence/build.log)는 WSL ext4 로컬 실행이다. [소스 해시](evidence/source-provenance.json)의 UI9파일은 Windows Epic 소스와 실제 WSL 빌드 입력이 일치했다. Java/POM/API 변경이 없으므로 Maven 모듈 배포는 하지 않았다.

[31](evidence/31-deployment.json)·[32](evidence/32-deployment.json) 모두 정적675파일/활성 index·파일별 해시 일치, HTTP200, 보호 서버 파일 동일이다. `/usr/share/cloudstack-management/webapp`에 정적 자산만 갱신하고 WEB-INF/META-INF와 서버 설정을 보존했다. JAR SHA256 `3f4de1380fa2695460c4d8e483c47196ec96378d05dfa98873c982a1a2144d97`, 관리 PID31=1640942·32=1904641은 전후 동일하다. 중간 진단 빌드 후 최종1f08ae1f 전체 UI를 다시 빌드·배포했다. 기능 코드는669977f7과 같으며 표준 라이선스 헤더만 보정했다. 초기 locale-artifact-assembly 증적은 중간856c2fc9에 관한 것이며 최종 배포의 별도 수동 조립이 아니다.

## 런타임·보존

최종 VR r-1024/ablecube31-3, r-499/ablecube32-2의 건강검사15/15·HAProxy 문법0·정확한 QA_SESSION string-table·원래 TLS 지문/HTTP200을 확인했다. TCP proxy option forwardfor 경고는 기존 다른 listener이며 문법 실패가 아니다. 기존 네트워크/VM/NIC·76개 LB backend매핑·인증서·역할/구성원/읽기전용 정책·원래 오퍼링은 보존됐다. [자원 감사](evidence/31-resource-preservation.json) · [32 감사](evidence/32-resource-preservation.json).

[VPN 보존](evidence/vpn-preservation.json): 최종 UI 변경 전후 VPN 파일 해시/mtime·xl2tpd·실제 PPP PID 동일, 활성 client **slot2** ICMP5/5·TCP3/3. 연결하지 않은 slot1의 ENODEV probe는 진단 자료로 남겼고 통신 실패로 판정하지 않는다. 독립 client 두 대의 동시 통신이나 LB backend 분산/성능 측정은 하지 않았다.

헤더 보정 후 lint·신규 대화상자33개를 다시 실행해 통과했다. [헤더/기능 동일성](evidence/header-fix.json)을 확인했다.

전체 Cloud CI 성공을 뜻하지 않는다. 기능 구현 커밋669977f7에 등록된 License Check는 기존3574개 미승인 항목으로 실패했고, 전역 Lint는 기존 여러 파일 및 새 Vue 헤더 형식도 수정 대상으로 보고했다. 새 Vue/시험 헤더는 저장소 표준과 정확히 일치하도록 보정했고, 실제 insert-license v1.5.5를 새 UI·시험/문서에 실행해 변경 없이 통과했다. 기존 Epic License/RAT 미해결 항목과 전체 server/UI 확대 시험 이력은 #1625 보고의 경계를 유지하며 이번 새 문서에는 ASF 헤더를 포함한다. 최종 GitHub 등록 check 상태는 별도 최종 상태 증적에 기록한다.
