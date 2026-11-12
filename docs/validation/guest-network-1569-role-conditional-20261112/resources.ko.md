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

# 확인용 자원과 정리 경계

확인 자원은 사용자 삭제 지시 전까지 보관한다. 기존21 VM/63 NIC를 보존하고 프로젝트에 Shared 기본 VM을1대씩 추가했다. 아래 수는 이 회귀의 프로젝트 범위이며 클러스터 전체 VM 수가 아니다.

| 클러스터 | 프로젝트 | 새 Shared 확인 VM | 프로젝트 VM/NIC | 현재 main VR/backend host | UI |
| --- | --- | --- | --- | --- | --- |
| 31 | qa-gn1569-31-shared-reg / `59614883-4085-4a76-99da-b8a1e3a78eed` | qa-gn1569-31-final-functional-vm / `f5c1c0a6-6658-4d96-96fc-6324703e2b9e` | 11 / 31 | r-1047-VM / ablecube31-1 | [본망](http://10.10.31.10:8080/client/#/guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb) |
| 32 | qa-gn1569-32-shared-reg / `cf5ec6b5-b522-4c18-ab90-a395012607c1` | qa-gn1569-32-final-functional-vm / `27ca6e8a-132e-46a8-9b83-18a136fa6f0f` | 12 / 34 | r-524-VM / ablecube32-1 | [본망](http://10.10.32.10:8080/client/#/guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711) |

추가로31 root 소유 `qa-gn1616-31-allocated-vm`에 기존 `qa-gn1569-31-reg-tier`의 Public Tier NIC1개를 보관한다. VM UUID `95f9dac8-920a-475d-91ff-5bc015c15d0e`, Tier UUID `4a5ac294-90e7-418c-9755-b17f4a9b78f3`, API IP10.210.31.112, MAC02:1f:02:3e:00:01, QA VLAN3900이다. API/libvirt NIC 일치·기존 default NIC 보존을 확인했다. 이 NIC는 기본 프로젝트와 별도 root QA 자원이다. 추가 NIC의 게스트 주소 설정/통신 완료로 확대하지 않는다. VLAN3900은 이 확인 자원 때문에 물리망 범위에 남겼다.

본망의 VPN/LB/TLS 인증서, Shared 범위·권한, 역할 시험 계정, 각 대상의 검토 댓글11개 및 태그 `gn1569-ui-retry`를 남겼다. API key·계정 비밀번호·PSK·개인 키·PEM 원문은 공개하지 않는다. 브라우저는 관리자 확인 화면으로 남기고 viewport 강제 설정·요청 실패 주입을 해제했다.

정리한 항목은 이 단계의 소모 서비스 망·empty/busy L2·실패 배포 VM·프로토콜 시험 IP/secondary alias·FW/PF/LB 규칙과 echo 프로세스다. 임시 host 주소·firewalld runtime 규칙은 원본으로 복원했고31 secondary 임계0.90을 유지한다. 소모 시험에서 쓴 공인 IP31.107/32.104는 최종 Free다. 오래된 무사용 QA 망1개를 제외하고 기존 확인 망을 지우지 않았다.

검토가 끝난 뒤 삭제 시 추가 VM2대,31 root QA VM의 이번 NIC,그 NIC를 해소한 뒤 QA VLAN3900,검토 댓글/태그와 새 persistent offering clone을 각각 식별해서 정리한다. VLAN3900을 사용 중인 NIC/망이 있으면 물리망 범위를 먼저 줄이지 않는다. 네트워크/볼륨 정리의 독립 결함은 #1586에서 관리한다.
