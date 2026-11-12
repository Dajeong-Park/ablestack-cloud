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

# 실제 검증 결과와 해석

## 역할·메타데이터

6역할(root/owner/peer/DomainAdmin/readOnly/비구성원 child) × Isolated·L2·Shared·Isolated Public IP·VPC Source NAT IP에서 사이트별223 API 호출을 실행했다. readOnly는 네트워크 변경 거부 역할이며 메타데이터 작업 전체 금지를 의미하지 않는다. 기존 역할 규칙을 그대로 적용했다. 계정 소유 Shared의 사용 공유는 metadata 소유권 이전이 아니므로 peer/readOnly 쓰기가 거부된다. 비구성원은 프로젝트 접근 단계에서 거부된다.

관리자 전용 댓글은 비관리자에게 숨기고, 본인 댓글 생성/삭제·다른 작성자 삭제 거부·관리자 가시성 변경·비관리자 변경 거부를 확인했다. HTML은 리터럴로 표시된다. 255문자는 성공하고 초과 입력은 기존 API431로 거부된다. 이벤트·태그·댓글 응답 UUID가 대상과 다른 항목은0이다. 이벤트 API 두 페이지는 중복이 없으며11개 검토 댓글을 남겼다.

추가로 FirewallRule/PortForwardingRule/LoadBalancer 태그에6역할 생성·조회·삭제를 적용하고, 두 방화벽 규칙의 일괄 태그 및12태그의10+2 API 페이지를 검증했다. 실제 UI 태그 재시도 job은31 `596d69b2-2c5d-444c-91c8-655530df8547`,32 `d7f1dccf-b2e8-43bc-81b1-caa2bb2b9820`이며 최종 job1·같은 key1개다.

UI 읽기503은 브라우저에서 해당 요청만 통제했고 서버 장애를 만들지 않았다. 댓글 쓰기503은 입력 보존 후 재시도 성공이다. 태그 POST 응답이503이고 job ID가 없을 때 중복 전송을 막는 기존 동작은 유지되나 같은 세션 복구 경로가 부족하다(#1634 P3). 서버에 태그가 없음을 확인하고 재로그인한 뒤 실제 UI 재시도 성공을 확인했다. 이를 같은 세션 자동 복구 성공으로 기록하지 않는다. 문자 수 안내는 #1635 P3다.

근거: `*-metadata-api-matrix.json`, `*-metadata-response-scope-audit.json`, `*-annotation-visibility-role-api.json`, `*-rule-tag-role-api.json`, `ui-*-fault-recovery.json`, `*-final-resource-role-audit.json`.

## NIC·삭제·Shared 연속성

새 Shared 기본 VM을 각각1대 배포하고 L2 secondary 추가, 기본 NIC Shared→L2→Shared 왕복, 사용 중 L2 삭제 거부·빈 L2 삭제 성공의 독립 job을 확인했다. API NIC와 실제 libvirt MAC 집합이 일치하며 임시 L2 NIC를 분리한 뒤 망 삭제가 성공했다. 새 Shared VM은 기본 NIC1개로 남겼다. 기존 VM에서 새 VM FQDN의 UDP/TCP DNS 각12회, ICMP5회와 SSH 배너를 확인했다.

VPN/LB가 실제 구성된 별도 persistent QA 망은 정상 삭제 job1 후 IP Free, VPN/LB 소멸, 계정 VPN 사용자 보존, 실제 libvirt domain 소멸과 GFS2 파일/RBD 디스크 부재를 확인했다. 원래 본망은 VM 의존성으로 삭제가 거부됐다. 오래된 무사용 QA 망의 용량 회수는 서비스가 준비되지 않았으므로 VPN/LB 삭제 성공 표본으로 집계하지 않았다.

Shared Live Patch 양쪽 job1·같은 VR UUID·동일 dnsmasq 패치 hash다. 기존 NIC의 DNS UDP/TCP·ICMP·SSH 각120/120 통과다. 서비스 망 삭제 중 Shared도 각120/120,31 VPN은269/269 ping/SSH 및 동일 PPP를 유지했다. 32는 삭제 뒤 재접속 통과이며31의 연속 표본 수를32에 적용하지 않는다.

근거: `*-functional-nic-final.json`, `*-new-default-shared-dhcp-dns-traffic.json`, `*-service-delete-final.json`, `*-shared-livepatch.json`, `*-shared-during-livepatch.json`, `*-shared-during-final-delete.json`, `31-shared-during31-service-delete.json`, `31-survivor-vpn-monitor-stop.json`.

## 실제 패킷·서비스 충돌

송신 TCP22/UDP19569/ICMP/ALL에서 규칙 전 차단→허용→삭제→차단을 확인했다. UDP echo는 실제 SNAT source IP를 포함한다. Static NAT primary 및 별도 secondary IP의 TCP/UDP19570·19571와 ICMP, 방화벽 철회 후 차단을 확인했다.

PF는 TCP/UDP19570-19571의 동일 public/private 범위로 실제 두 포트가 통과하며 primary→secondary IP 대상 변경도 실제 marker로 식별했다. 서로 다른 시작 포트의 다중 범위는 API 계약431이고 제품 결함이 아니다. 같은 IP에 PF와 LB19770을 공존시켜 roundrobin→leastconn, backend 해제 시 marker 부재→재할당 시 복구를 확인했다. 단일 backend의 서비스 반영 검증이며 분산/부하 측정은 하지 않았다.

VPC nonconserve에서는 LB→PF 및 PF→LB의 서비스 배타 거부, 서비스 삭제 후 정상 전환, PF/Static NAT 상호 충돌·원복을 양쪽 확인했다. 이 추가 계약 시험은 API/job 검증이며 해당 VPC의 별도 packet 검증으로 확대하지 않는다. 31은 Internal 전용 Tier가 PF를 제공하지 않아 Public LB Tier에 전용 NIC를 준비했다. 새 NIC의 API/libvirt MAC은 일치하고 기존 기본 NIC를 유지했다.

AutoScale 전용 DISABLED 그룹3개씩의 소유 LB 삭제는 정상 거부하며 규칙 원본이 보존됐다. 운영 Kubernetes 규칙에는 파괴적 삭제 요청을 보내지 않았다. Root가 기존 정책상 허용되는 운영 관리를 수행하는 것을 권한 우회로 해석하지 않는다.

근거: `*-egress-protocol-packets.json`, `*-static-nat-protocol-functional.json`, `*-public-protocol-functional.json`, `*-vpc-nonconserve-service-contract.json`, `*-managed-autoscale-rule-delete-guard.json`.

## VPN·오퍼링·TLS

VPN owner 사용자 철회·peer 복원, readOnly/비구성원 거부, 기존 PPP 통신 차단·재인증 거부·정상 복원 후 ICMP5/SSH3을 확인했다. 독립 외부 클라이언트2대가 없어 동시 사용자 간 통신 독립성은 실행하지 않았다.

오퍼링은 UI와 API로 원래 설정↔전용 clone을 왕복해 실제 HAProxy maxconn4096↔8192, keepalive 관련 `option httpclose` 변화와 원복을 확인했다. 네트워크 재구현으로 VR이 교체돼 VPN 중단은 예상된 재구현 구간으로 기록하고 재접속했다. 오퍼링 모니터는31 343표본 중158성공/185중단,32 507 중292성공/215중단이다. 무중단 PASS가 아니다. 재접속 뒤 ping5/SSH3, 최종 TLS 전체 chain3·Root/SNI 검증0·HTTP200·HAProxy 문법/건강0은 통과했다. 통신 시험 backend와 VR은 같은 host로 유지했다.

근거: `*-ui-offering-*-request.json`, `*-keepalive-*-job.json`, `*-offering-*-live-tls.json`, `*-vpn-monitor-stop.json`, `*-ra-*.json`.

## 배포·시험 설정 원복

소스/배포 변경0이다. 실제675개 UI 파일/JAR/클래스 hash·Mold PID·WEB-INF·HTTP200·링크 오류 부재를 다시 확인했다. 임시 echo 프로세스는 소유 cmdline을 확인해 종료하고 외부 PID를 건드리지 않았다. 시험 전용 firewalld runtime rich rule은 원래 존재 여부까지 맞춰 복원했고 임시 host bridge IP/guest secondary alias/API secondary IP/시험 PF·LB·공인 IP를 정리했다.31 secondary 임계치는0.90으로 복원했다.31 QA VLAN3900과 새 Public Tier NIC는 확인 자원으로 명시적으로 남겼다.

기존21 VM/63 NIC와 프로젝트 구성원·역할·권한 규칙을 그대로 보존했다. 프로젝트 확인 자원은 추가 Shared VM2대를 포함해23 VM/65 NIC이며 별도 root QA VM31의 Public Tier NIC1개를 추가 보관한다. 양쪽 최종 자원/역할 감사가 통과했다.
