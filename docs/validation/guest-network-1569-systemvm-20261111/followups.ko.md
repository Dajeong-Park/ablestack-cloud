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

# 후속 해결·재검증 순서

| 순서/이슈 | 실환경 재현 | 미해결 내용 | 대표 영향 |
| --- | --- | --- | --- |
| [#1630](https://github.com/ablecloud-team/ablestack-cloud/issues/1630) | 31 | NIC 추가 job2 뒤 DB/API의 Allocated NIC 잔류·실제 libvirt에는 없는데 UI 활성화 | C03/C05/C06/M02 |
| [#1628](https://github.com/ablecloud-team/ablestack-cloud/issues/1628) | 32 | Shared 추가 IPv4 서브넷 530: networks.cidr 18·gateway 15인 기존 스키마 | S06 |
| [#1629](https://github.com/ablecloud-team/ablestack-cloud/issues/1629) | 31·32 | 프로젝트에 공유된 Shared는 조회되지만 member/readOnly IP 조회531 | C07/S05/M02 |
| [#1631](https://github.com/ablecloud-team/ablestack-cloud/issues/1631) | 32 | Public MAC 유지=true에서 도메인 단독 수정의 VR 재생성 후 실제 MAC 변경 | I01/I06/I07 |
| [#1632](https://github.com/ablecloud-team/ablestack-cloud/issues/1632) | 31·32 | 정상 CRL·서명 OCSP·관리 서버 HTTP200을 준비해도 기본 SSL 폐기 검사 정상 체인530 | P07 |

## 실행 순서

1. #1630의 실패 NIC 보존/정리 계약과 잘못된 활성 표시를 고쳐31 재시도 기반을 확보한다. 자동 VLAN 풀 부족은 별도 환경 조건으로 해결하고 기존망을 무단 삭제하지 않는다.
2. #1628의 기존 설치 schema를 정합화해32 Shared 다중 subnet 생성/수정/삭제와 원래 subnet/NIC/DNS/DHCP 보존을 재검증한다.
3. #1629의 실제 프로젝트 공유 조회 문맥을 고치되 explicit deny/비구성원/개인 범위를 유지한다. 양쪽 member/readOnly UI/IP/VM 링크와48행 대응을 확인한다.
4. #1631의 도메인 수정·오퍼링 전환·재생성/실패복구에서 true/false Public MAC 계약을 검증한다.31의 선행 조건을 해소한 뒤 양쪽 실제 NIC/packet으로 확인한다.
5. #1632의 기본 검사 정상 성공/폐기 거부와 장애/복구를 확보한 뒤 실제 전용 LB TLS bind/정책을 확인한다. false는 해결책이 아니다.
6. #1569의 아직 미실행인 준비된 Public/VPC/Internal 오퍼링·역할/일괄·메타데이터 타입·default/secondary NIC 조합을 63행의 남은 항목대로 수행한다. 기존 #1586 Glue RBD volume 삭제 후속도 유지한다.
7. IPv6/DualStack·ASN/BGP·routed·외부 DNS Zone·Health Monitor 제공자와 독립 VPN client2대 등 조건을 준비해 실행하거나 명시적인 채택 범위 결정을 남긴다. 부재를 PASS로 바꾸지 않는다.
8. 최신 source/build/실환경/CI·원래 자원과 보관 fixture 정리 방침을 대조해63행 최종 판정 후 #1569 종료 여부를 결정한다. 현재는 OPEN이다.

## 현재 사용자 조치

지금5개 결함의 구현·조사에 별도 사용자 조치는 필요하지 않다. Health Monitor 제공자와 독립 VPN 클라이언트가 없다는 기존 사용자 답변을 유지하며 같은 정보를 다시 요청하지 않는다. 조건부 기능까지 모두 종료하려면 해당 환경 준비 또는 범위 제외 결정이 필요하다.
