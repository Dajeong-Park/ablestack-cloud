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

| 항목 | 31 | 32 | 증거 |
| --- | --- | --- | --- |
| VPN 사용자 철회/신규 인증 거부/복구 | 기존통신 차단·인증실패·5 ICMP/3 SSH 복구 | 동일 | `*-ra-user-withdrawn-existing/reconnect.json`, `*-ra-user-recovered.json`, UI 요청/job |
| VPN 서비스 철회/재생성 | IKE 실패, PPP 없음→복구 | IKE는 응답해도 PPP 미수립·통신 불가→복구 | `*-ra-service-withdrawn-*.json`, `*-ra-service-recovered.json`, `*-vpn-service-regenerated.json` |
| owner/UI 역할 | 인증 복구·사용자/서비스 복구 | 동일 | `*-owner-auth-restored.json`, `*-owner-*-ui.json` |
| member/DomainAdmin | 전용 사용자 삭제/복구 job1 | 동일 | `*-roles-api.json` |
| 읽기 전용/비구성원 | VPN 사용자/서비스 철회·LB backend 해제401 | 동일 | `*-roles-api.json` |
| SSL 인증서 UI 교체·제거·복구 | 새지문→0개/TLS실패→원래지문 | 동일 | `*-ssl-replaced/removed/restored.json` |
| 단일 backend TLS | HTTP/2 200/본문→backendssl=false curl56→재활성200 | 동일 | `*-backend-ssl-baseline/disabled/recovered/final-retained.json` |
| SSL 역할/UI 오류 | 가드 없음·401 후 버튼 잠김 | 동일 | `*-readonly-explicit-deny-ssl-assignment-ui.json`, `*-ssl-readonly-api-denied.json`, 캡처 |
| projectid 생략 API | 명시401/생략job1 | 동일 | `*-ssl-readonly-unscoped-stable.json` |
| 오퍼링 기본 clone |19개 대조 일치 | 동일 | `*-offering-clone.json` |
| LB 연결 설정 실제 적용/복구 |8192/true→4096/false, 실제HAProxy/HTTPS 확인 | 동일 | `*-offering-apply/restore/runtime/final.json` |
| 반응형·테마·프로젝트 | VPN/VM 확인, SSL 모바일 실패 | 동일 | `layout.json`, `ui-state.json`, `capture-audit.json` |
| 활성 배포·자원 보존 |670파일·HTTP200·WEB-INF·JAR/PID 동일 | 동일 | `*-active-deployment-audit.json`, `*-preservation.json` |

VPN ICMP/TCP는 WSL의 ppp69에 바인딩해 우회 경로의 성공을 세지 않았다. 양쪽 VM은 VR와 같은 호스트에서 검증했다. 시험 네트워크의 오퍼링 변경은 API 경로로 수행했고 clone·LB설정은 실제 UI로 수행했다. 오퍼링 변경이 VR를 재생성하므로 새router/링크로컬주소를 재조회하고 VM과 같은 호스트로 맞춘 뒤 재검증했다. 이전 VR 주소의 SSH255는 오래된 probe 대상이며 제품 장애 판정에 쓰지 않았다.

53개 성공job과1개 실패job을 보관했다. 실패는32 오퍼링 변경/VR 재구현 중 시험 절차에서 VPN 사용자 철회를 겹쳐 실행한530이다. 이후 망 준비를 기다리고 같은 전용 사용자 삭제/복구를 순차 실행해job1·최종4사용자Active와 실제VPN통신을 확인했다. 실패 기록을 지우거나 최초 실행 성공으로 바꾸지 않았다. UI 정상 변경18건은 별도 `*-ui-jobs-final.json`에서 모두job1이다. UI 권한401에는job이 없다.

명시 deny는 기존 QA 역할에 임시2개를 추가해 양쪽 새 로그인에서 확인하고 정확히 복원했다. UI 공통 API 처리에는projectid가 있으며 서버는401로 차단한다. 직접 API에서projectid를 생략하면 새 세션/충분한 대기 후에도 같은 인증서 재할당이job1이었다. 외부 비구성원이나 다른 계정 접근 허용으로 확대하지 않는다. 기존정책을 완화하지 않았다.

실제TLS 지문과 단일HTTPS 응답은 암호화/구성 확인이다. 자체서명 인증서이며 CA신뢰·만료/체인·모든cipher·클라이언트 구현·HTTP연결 재사용/용량 검증으로 확대하지 않는다. backend는 HAProxy의 기존 `ssl verify none` 동작을 사용하며 인증서 검증 정책을 바꾸지 않았다. 기존32의18591 시험 규칙은 준비된HTTPS backend가 없어 최초 TLS probe timeout을 별도 기록하고 신규19111 규칙에서 검증했다.

이번 변경은 문서·증거뿐이다. 로컬 소스/모듈/UI 빌드·전체Cloud 빌드·수동Actions는 실행하지 않았다. Markdown lint·UTF8/JSON/링크/비밀값 검사와 원본JPEG 치수/해시 검증을 별도로 기록한다. 자동PR CI는 전체Cloud 검증 통과와 구분한다. 초기5캡처는 중간 모듈 재로딩으로 live viewport 색인 연결이 없어 로컬 진단 자료에만 보존했고, 공개83장에 포함하지 않았다.

## 최종 교차 검증에서 추가된 #1621

양쪽 VPN을 새로 연결하고4초마다 ppp69 고정ICMP를유지했다. 0~24초7샘플성공→약25초인증서B할당시작→28초부터PPP소실/통신실패였다. 약56초원래인증서A복구job1후에도23샘플끝까지PPP는복귀하지않았다. 양쪽23개씩총46샘플중교체전14개성공/교체후32개실패다. 새VPN접속후각ICMP5/5·SSH3/3이복구됐다. `*-vpn-ssl-continuity.json`, `*-ra-continuity-end.json`, `*-ra-cert-continuity-recovered.json`을대조한다.

같은시각VR journal에xl2tpd stop/start와기존pppd TERM이있다. IKE/CHILD SA나UI/API Running은기존클라이언트의PPP연속성증거가아니다. 서버idle은1800초여서28초소실을idle만료로설명하지않는다. 실제설치CsFile과같은해시의소스를WSL ext4가짜PSK파일로검증해파일바이트동일인데commit=True, 원본비교본을보존한repopulate대조는False를확인했다. `vpn-config-idempotence-probe.json`, `*-vpn-installed-source.json`, `*-vpn-runtime-after-cert.json`에기록했다. 실제PSK나제품소스는바꾸지않았다.

`CsRemoteAccessVpn.configure_l2tpIpsec`의secret.empty가config/new_config를모두비워무관한SSL설정적용에서도config_changed=True→xl2tpd재시작을유발한다. 이확인으로P09도실패로갱신하고#1621을분리했다. 이결함을원래의의도된VPN철회/재접속성공과구분한다. 실제작업은53성공/시험절차중530실패1로총54job이며교차SSL할당/복구4job는모두1이다.
