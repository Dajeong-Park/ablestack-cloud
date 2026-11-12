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

# 실행 결과와 판정 범위

| 검증 | 31 | 32 | 근거 |
| --- | --- | --- | --- |
| SSL API/소유자 UI 연속 구간 | 212/212 ICMP·TCP 성공 | 86/86 성공 | `*-vpn-ssl-continuity.json`, `*-continuity-summary.json` |
| 클라이언트 PPP 재접속 | 0 / PID·ifindex 동일 | 동일 | 위 표본 및 요약 |
| 서버 VPN 파일·PID | 동일 / stop·start journal0 | 동일 | `*-runtime-after-ui-ssl.json`, `*-vpn-journal-after-ui-ssl.json` |
| SSL API6작업 | 모두 job1 | 모두 job1 | `*-ssl-api-operations.json` |
| 소유자 UI 교체/해제/복구 | 각각 POST1/job1 | 동일 | `*-ui-replace/remove/restore*.json` |
| 사용자 철회/인증 거부/복구 | 기존 통신·신규 PPP 차단→5 ICMP/3 TCP 복구 | 동일 | `*-ra-user-*.json` / UI 요청 |
| 서비스 철회/복구 | 기존 통신·신규 IKE 차단→새 키/범위로 복구 | 동일 | `*-ra-service-*.json`, `*-vpn-*.json` |
| 새 VR 부팅/동일 호스트 | r-1019 / ablecube31-3 | r-489 / ablecube32-2 | `*-fresh-router-bootstrap.json` |
| 새 VR SSL 재적용 | job1 / PID·통신 유지 | 동일 | `*-bootstrap-ssl-smoke.json` |
| 잘못된 cert/정상 재시도 | 431/작업0 → job1 / PID·통신 유지 | 동일 | `*-ssl-failure-recovery-smoke.json` |
| 최종 TLS | 원래 지문 / HTTP200·본문 | 동일 | `*-final-tls-runtime.json` |
| UI 표준·프로젝트·테마 | VM 기준/왕복/즉시 전환·반응형 | 동일 | ui-state/layout/테마 기록 |
| VR 건강 상태 | 14/15 성공 / SSL bind 오판정 #1624 | 동일 | `*-health-warning-diagnosis.json` |

API 연속 구간은 다른 인증서 교체→연결 해제→원래 인증서 복구→알고리즘 변경/원복→동일 인증서 재적용이다. 각 작업 시작/종료와 UI의 실제 job1 생성/완료 시각이 모니터 구간 안에 있는지 대조했다. 주기 약1초마다 ICMP 한 패킷과 PPP 장치에 고정한 TCP22 연결/SSH 배너를 확인했다. 단일 TLS backend와 VM/VR는 같은 호스트다. LB 분산/부하 측정은 제외했다.

IPv4/PPP PID를 보는 실제 시험과 별도로8개 신규 Python 시험은 동일 설정의 바이트/mtime/inode/mode 불변, 최초 구성, 실제 PSK·left·server·range·local DNS 변경, 서비스 철회, 파일 쓰기 실패/재시도 경로를 검증한다. 기존 CsFile 시험1개를 포함해9개가 통과했다. 수정 전 실패8기록에는 subTest가 포함된다. 저장소 flake8 선택 규칙0위반, 신규 시험 전체 pycodestyle/제품 변경 행0위반이다. configure.py 전체의 기존 E302 두 건은 이번 변경 전에도 있어 별도 기록하며 전체 스타일 통과로 표시하지 않는다.

정규 Maven `-Psystemvm -pl systemvm -Drat.skip=true generate-sources`는 변경하지 않은 cloud-console-proxy:4.23.0.0 캐시 누락으로 실패했다. 동일 모듈 POM에서 리소스 태스크만 추출한 WSL ext4 Maven 빌드는 성공했다. 원래 모듈 package나 전체 Cloud 빌드 성공으로 표현하지 않는다. 실제 배포 archive의 단일 항목 교체와 활성 소스/hash를 별도로 확인했다.

사용자/서비스 철회 및 망 clean restart는 의도적으로 PPP를 끊는 음성/복구 시험이다. 이를 포함한 모든 시험 시간 내내 연결이 유지됐다고 주장하지 않는다. 서비스 재생성 후 새 PSK와 대체 입력 범위10.1.3.2–10.1.3.8(첫 주소를 서버가 사용해 API 클라이언트 범위는3.3–3.8)을 확인하고, 최종 UI 기본 재생성으로 원래10.1.2.2–10.1.2.8을 복구했다.

수집 과정의 짧은 locator deadline·숨겨진 버튼 대기와 입력 재렌더를 보정해 실제 job 완료를 확인했다. 31번 초기 UI 교체/제거 뒤 원본 복구 control과 재실행한 완전한 UI3작업을 구분했다. 제출 전 사용자 복구 접속 시도는 `31-ra-user-recovery-before-submit.json`의 인증 거부로 남겼고, 실제 등록 후 별도 연결 성공을 확인했다. 배포 전역 preflight와 시험 클라이언트 연결이 겹친 PID 비교1건은 배포 직전 기준으로 다시 수집했으며 이미 교체된 파일은 해시로 확인해 재시작 없이 이어갔다.

공개 저장의 민감 키 제거로 PSK 파일 경로가 map에서 생략되는 점을 고려했다. API 작업 중에는 네 파일 원본을 직접 비교했고, UI 후에는 공개 가능한 keyFileMetadata(hash/mtime/mode)로 원하는 값 일치 및 SSL 구간 이전 mtime을 확인했다. 실제 키는 기록하지 않았다. 31 network-loading 캡처는 초기 로딩이며 완료 증거는 별도 network-tab 캡처다.

현재 VR 건강 경고는 HAProxy 검사기의 `IP:port` 완전 일치 비교가 `ssl crt … alpn …` suffix를 잘못 거부하는 #1624다. 각14개 다른 점검·haproxy -c0·실제 TLS200이 성공했고, 점검 소스는 변경하지 않았다. Internal LB 등의 다른 경고를 모두 이 원인으로 분류하지 않는다. 경고 이력은 삭제하지 않았다. 별도 제공자가 없는 LB Health Monitor 정상/복구는 기존 환경 차단이다.

제품 UI는 그대로다. VM 목록·상세·NIC·연결창·breadcrumb, 프로젝트 왕복, 관리자 밝음↔다크의 같은 timeOrigin, 제한 역할의 테마 상속, 390/768/1280을 확인했다. SSL 창 내부의117px/잘림·버튼 가드/실패 후 잠김은 #1619 미해결로 남긴다. 페이지 overflow0을 SSL 모바일 표준 통과로 대체하지 않는다. 32번은 프로젝트·테마·반응형 검증 전후에도 서버 PPP/xl2tpd PID와 실제 통신이 유지됐다.
