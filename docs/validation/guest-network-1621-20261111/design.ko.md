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

# 변경 설계와 배포 경로

## 원인과 최소 수정

LB 변경은 VPN을 포함한 VR 설정 재적용 경로를 통과한다. `CsRemoteAccessVpn.configure_l2tpIpsec`가 PSK 파일을 `empty()`로 초기화하면 편집본뿐 아니라 원본 비교본도 빈 배열이 된다. 같은 PSK를 다시 넣어도 `commit()`이 True를 반환해 `process()`가 xl2tpd를 재시작하고 기존 PPP를 종료했다.

VPN 호출부를 `repopulate()`로 바꿔 편집본만 원하는 내용으로 구성하고 원본 비교본은 유지한다. 원하는 값이 같으면 파일을 쓰지 않고 False를 반환한다. PSK·left/leftid·범위·local IP/DNS가 바뀌면 기존 commit/restart 경로가 동작한다. 서비스 create=false의 명시적 ipsec down/xl2tpd stop도 유지했다. CsFile의 전역 empty/commit·API·권한·TLS 보안 설정은 변경하지 않았다.

## 빌드와 배포

WSL ext4 clone에서 신규8+기존1 Python 시험과 저장소 flake8 규칙을 실행했다. SystemVM 모듈의 generate-sources는 local console-proxy 의존성 누락으로 막혔다. 관련 없는 Java 모듈이나 전체 Cloud를 빌드하지 않고 systemvm/pom.xml의 maven-antrun-plugin build-cloud-scripts 태스크를 같은 설정으로 분리 실행했다. 산출 cloud-scripts.tgz의 configure.py가 Git 소스와 같은지 검증했다.

현재 관리 서버/호스트의 원래 archive를 WSL에 백업한 뒤 검증된 configure.py 항목만 교체했다. 나머지 항목의 내용·실효 권한·uid/gid·링크·mtime을 대조했다. gzip 헤더/생성 시각 차이가 업그레이드 체크섬을 다르게 만들지 않도록 클러스터별 관리 서버와 세 호스트에 같은 canonical archive를 배포했다. management ChecksumUtil은 파일을 읽어 계산하며 KVM StartCommand는 호스트의 /usr/share/cloudstack-common/vms/에서 패치 파일을 VR로 전송한다.

실행 중80 VR에는 원본 해시·소유권·권한을 확인하고 configure.py만 원자적으로 교체했다. 재시작 명령은 실행하지 않았다. 전체 SystemVM 패치나 다른 실행 파일을 일괄 교체한 것으로 표현하지 않는다. 이후 전용 시험망의 clean restart로 새 VR2대를 실제 생성해 configure/hash·archive SHA256·SHA512 signature와 requiresupgrade=false를 확인했다. 새 VR과 기존 backend VM의 호스트가 같다.

## 검증 경계

연속성 표본은 실제 PPP 장치에 ICMP/TCP 소켓을 고정해 우회 경로로 성공하지 않게 했다. 클라이언트 pppd PID/인터페이스 index와 서버 pppd/xl2tpd PID·VPN 설정 hash/mtime 및 journal을 함께 확인했다. 명시적 사용자/서비스 철회와 clean restart의 의도한 단절은 SSL 연속 구간과 분리했다.

파일 소유권·모드는 기존 값을 유지했다. 실환경 PSK 파일은 기존0644이며 이번 변경에서 권한 정책을 바꾸지 않았다. 합성 회귀에서는0600 파일의 변경/반복 적용 후에도0600이 유지됨을 확인했다. 실제 PSK·비밀번호·개인키·API 키는 공개하지 않는다.

추가 #1624는 SSL 옵션까지 endpoint와 완전 일치 비교하는 별도 HAProxy 점검 오류다. 점검 파일의 원격/저장소 해시가 같고 이번 archive의 다른 항목 보존 검증 대상이다. 실제 문법/TLS는 통과했다. UI #1619 및 서명 조회 #1622도 후속으로 남긴다.
