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

# 검증 결과와 배포 증거

| 범위 | 31번 | 32번 |
| --- | --- | --- |
| 세션 역할 × TCP/HTTP/SSL × 생성/삭제·프로젝트 힌트 | 48행 PASS | 48행 PASS |
| 제한된 서명 키의 역할·힌트·서명/만료·허용 삭제 | 12행 PASS | 12행 PASS |
| 세션 다른 프로젝트/빈 값/없는 정책 | 12행 PASS | 12행 PASS |
| 개인 소유 LB의 실제 소유자·타인·프로젝트 힌트 | 8행 PASS | 8행 PASS |
| 기존 SSL 조회·assign/remove 역할 회귀 | 26행 PASS | 26행 PASS |
| 세션/서명 거부 × 프로토콜 × 명시/생략의 실제 정책/config 보존 | 24행 PASS | 24행 PASS |
| owner TCP·member HTTP·domainadmin SSL의 UI 삭제/복원 | 6 job1 | 6 job1 |
| AppCookie 실제 열린 창 × 밝음/다크 ×1280/768/390 | 6배치 PASS | 6배치 PASS |
| 프로젝트 기본 보기→QA 복귀, VM 목록/상세/NIC/연결창/breadcrumb/모바일 | PASS | PASS |
| VR 건강 점검 | 15/15 | 15/15 |
| VPN 연속 ICMP/SSH 표본 | 1,188/1,188 성공 | 1,188/1,188 성공 |

역할 root/프로젝트 소유자/일반 구성원/도메인 관리자의 허용과 읽기 전용·비구성원의 거부를 확인했다. 거부 행은 jobid가 없고 정책 ID와 HAProxy 설정 SHA가 동일했다. 개인 LB는 31번 admin 소유,32번 시험 owner 소유로 서로 달라 실제 소유자 기준으로 검증했다. 제한 시험 키는 기존 시험 사용자에 이름을 붙여 6개 추가했으며 기존 키·역할·비밀번호를 변경하지 않았다. 네트워크 읽기 전용 역할에 SSL 쓰기 거부는 없으므로 SSL 검증은 별도 기존 deny 역할을 사용했다.

## 빌드와 운영 반영

로컬 WSL ext4 /home/ablecloud/work/dhslove/cloud-epic-1554에서 api/server 두 모듈만 Maven package했다. [수정 전 검출 로그](evidence/baseline-build.log)의 신규17개 14실패/3오류와 [수정 후 66/66](evidence/module-build.log)을 구분한다. 기존 SSL/DomainChecker/일반 dispatch/ParamProcess 회귀를 함께 포함했다.

양쪽 기존 관리 fat JAR에서 빌드된 두 클래스만 교체하고 다른 204,866개 entry 해시는 보존했다. 원본 SHA256 3f4de1380fa2695460c4d8e483c47196ec96378d05dfa98873c982a1a2144d97, 배포 후 양쪽 baa20755fb2dec6117528a46a68dc15c6fbd0764d5caddb5e8e326eec0254974. WSL 원본 백업과 원격 RAM 백업을 확보하고 순차 재시작했다. HTTP200·WEB-INF·META-INF·정적 index/config 보존, 현재 관리 로그 신규 클래스 로딩 오류0을 확인했다. UI 정적 소스는 기존 #1626이며 index SHA256 30f47fae240fb78f865dce5c0919f6ab495b23e514ed84ce8f6f64f95734ba29를 유지한다.

실제 단일 백엔드 HTTP200/HTTPS200/SSH 배너·HAProxy 문법0, 기존19111 TLS 지문 유지, VPN 설정 hash/mtime·xl2tpd PID31=3302/32=3337·PPP 프로세스 보존, 마지막 활성 slot2 ICMP5/5·TCP3/3을 확인했다. 연속 표본은 관리 서버 두 번의 재시작과 역할 변경 작업 구간을 포함하며 표본 종료 뒤 UI 캡처 시간까지 연속 측정했다고 주장하지 않는다. LB 백엔드 부하분산 성능은 측정하지 않았다.

## UI 표준과 증거 경계

UI 소스 변경0. 기존 MoldDialog/MoldDialogActions·세로 설정 폼·대상/현재 정책 요약·하단 버튼을 VM 실제 목록/상세/NIC/기존 연결 대화상자와 비교했다. 양쪽12개 실제 SSL 열린 창 배치에서 가로 넘침0·대화상자/하단 버튼 viewport 이내·고유 label/input ID를 확인했다. TCP/HTTP 실제 정책과 읽기 전용 메뉴 비활성, 비구성원 직접 진입의 dashboard 복귀도 캡처했다. 즉시 테마 전환 전후 performance.timeOrigin 유지, 프로젝트 왕복 후 해당 QA 자원 재조회,31번 미저장 초안의1280→768→390 보존/변경 API0을 확인했다.

원본 JPEG 80장은 [매니페스트](evidence/capture-audit.json)로 치수·해시를 감사했다. 자동화의 사용자 hover 메뉴/잘못된 설정 클릭으로 대화상자가 없던 프레임은 diagnostic으로 분리했으며 성공 배치에 포함하지 않는다. resize 입력 유실 가설은 실제 열린 창 재검증에서 재현되지 않았다.

## 보존·동시 작업·CI

31번 전체 기존 인벤토리, 양쪽 이번 QA 네트워크/VM/NIC/LB backend/SSL mapping/역할·원래 오퍼링이 보존됐다.32번은 별도 js Kubernetes 자원 정리로 js-network·VM4개·r-276·IP1개·api-lb가 없어져 전역 전체 불변은 실패한다.17:30 관리 이벤트가 KubernetesCluster js의 삭제를 기록한다. 이번 기능 시험 자원과 구분하고 [전역 차이](evidence/32-global-inventory-delta.json)·[관련 이벤트](evidence/32-concurrent-inventory-events.json)에 남겼다. 소실된 타 작업 자원을 임의로 재생성하지 않았다.

보호된 Native dirty worktree8개/12,935파일 및 WSL14개/107파일의 HEAD·staged/unstaged diff·개별 해시가 동일했다. 이번 소스 head 등록 License Check/Lint 실패는 로컬66통과와 별개로 기록한다. 전체 CI 녹색이나 Epic/#1569 전체 완료로 보고하지 않는다.
