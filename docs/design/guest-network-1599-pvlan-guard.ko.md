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

# #1599 PVLAN 지원 계약과 일반 브리지 우회 차단

기존 31·32번은 Linux bridge / BridgeVifDriver 환경이다. 이 변경이 Linux bridge에 PVLAN 전달 정책을 구현하는 것은 아니다. 기존 `Pvlan` NIC가 일반 `bridge0`에 연결되던 경로를 거부하며, 관리자가 별도로 준비한 전용 OVS 브리지에서만 지원 정책을 적용한다. 시험을 위해 31-2·32-1에 OVS를 추가했다. 기본 드라이버·물리 NIC·운영 브리지·기존 물리 네트워크 레이블은 변경하지 않는다.

## 활성화 경로

1. 관리자가 공식 배포처의 OVS와 Python 3를 준비하고, 새 전용 브리지를 만든다. 기존 Linux bridge를 OVS로 변환하지 않는다.
2. 해당 브리지는 `fail_mode=secure`, 외부 controller 없음, `other_config:cloudstack-pvlan-guard=1`이어야 한다. `other_config:cloudstack-pvlan-mode=local`은 업링크 없는 동일 호스트 전용 모드다.
3. 해당 호스트의 agent.properties에 `libvirt.vif.driver.extra=com.cloud.hypervisor.kvm.resource.OvsVifDriver`를 명시하고 에이전트를 재연결한다. 기본/per-traffic VIF driver는 유지한다. 파일 설정과 명령행 설정 모두 읽는다.
4. 별도 Guest 물리 네트워크의 KVM 레이블을 전용 브리지 이름으로 설정한다. 고유한 물리망 태그와 일치하는 L2 오퍼링을 사용한다. 시험 레이블은 `qa-pvlan1599`, 물리망/오퍼링 태그는 `qa-pvlan1599-31`·`qa-pvlan1599-32`다.
5. 에이전트가 브리지 설정과 포트·정책을 확인하고 저장된 정책을 재구성한 경우에만 `pvlan.supported.bridges`에 브리지를 보고한다. `pvlan.guard.version=1`과 `pvlan.default.bridge`도 보고한다.

물리 네트워크의 Guest 레이블은 Zone 전체 호스트의 `CheckNetworkCommand` 대상이다. 일부 호스트만 OVS를 사용하는 이번 시험에서는 나머지 31-1·31-3·32-2·32-3에 같은 이름의 시험용 native 브리지와 가상 dummy 포트 `ensqa1599`를 준비했다. 물리 NIC·IP·외부 업링크는 연결하지 않는다. 빈 브리지만으로는 기존 PIF 검사를 통과하지 못하므로 dummy 포트가 필요하다. 해당 호스트의 지원 브리지 목록은 비어 있고 PVLAN 연결은 계속 거부한다. 이 레이블 준비는 범용 Cloud 연결 검사 우회 코드나 PVLAN 지원 선언을 추가하지 않으며, 검토 후 시험망 정리와 함께 제거할 임시 준비다. 호스트 재부팅 후 자동 복원은 검증하지 않았다.

UI의 지원 결과는 이 구성에 정책을 적용할 수 있다는 뜻이다. 네트워크 객체 생성이나 지원 결과만으로 스위치·라우터·애플리케이션 통신이 검증됐다고 표시하지 않는다. UI가 OVS를 설치하거나 기본 네트워크를 자동 전환하지 않는다.

## 차단과 원복

- 순수 KVM Zone에서는 미지원/구형 에이전트의 PVLAN 생성 요청을 사전 거부한다. 혼합 Zone의 하이퍼바이저 중립 네트워크 생성은 기존 계약을 유지하고, KVM VM 배포와 NIC 연결 시 별도로 검증한다.
- KVM VM 배포는 VM/디스크/NIC 할당 전에 PVLAN 지원을 검사한다. 실행 중 VM은 실제 호스트를 검사하고, 정지된 VM의 NIC도 사전 검사한다.
- BridgeVifDriver는 broadcast type 또는 URI가 PVLAN이면 인터페이스 생성 전에 거부한다. type/URI 불일치로 우회할 수 없다.
- OvsVifDriver는 전용 브리지 정책 사전 검사를 통과해야 VIF를 생성한다. 실제 선택한 driver에 따라 native nwfilter를 배제한다.
- 정책 적용이 실패하면 hotplug NIC를 분리하고 할당을 원복한다. 분리 자체가 실패하면 성공으로 표시하지 않고 복구가 필요한 오류와 식별 정보를 유지한다. 기존 기본 NIC를 삭제하지 않는다.
- 과거 잘못 연결된 native PVLAN NIC의 삭제는 허용한다. 운영 자원은 자동 일괄 재연결하지 않는다. 호스트 XML·포트와 Cloud NIC를 비교하고, 비기본 시험 NIC만 분리한 뒤 지원 네트워크로 다시 연결한다.

## OVS 전달 정책

`ovs-pvlan-kvm-policy.py`는 root 전용 상태 파일과 브리지별 lock을 사용한다. VM 포트의 `attached-mac`, OVS Interface UUID, 실제 OpenFlow 포트를 함께 확인한다. 미등록 포트, 출발지 MAC 위조, 게스트 태그 삽입은 기본 차단한다. `NORMAL` 규칙으로 우회하지 않는다.

| 출발/도착 | Isolated | 같은 Community | 다른 Community | Promiscuous |
|---|---|---|---|---|
| Isolated | 차단 | 차단 | 차단 | 허용 |
| Community | 차단 | 허용 | 차단 | 허용 |
| Promiscuous | 허용 | 허용 | 허용 | 허용 |

서로 다른 primary VLAN은 차단한다. 브로드캐스트/unknown unicast도 같은 허용 행렬을 따른다. 이 정책의 cookie(`0x1599…`)만 OpenFlow 1.4 bundle로 원자 갱신하며 다른 규칙이 발견되면 브리지 인수를 거부한다. 에이전트 재연결 시 동일 Interface UUID만 새 포트 번호로 매핑한다. VM 정지·시작으로 포트가 재생성되면 Cloud의 명시적인 정책 add가 새 UUID를 승인해야 한다. 같은 MAC이라도 이전 UUID의 Promiscuous 권한은 승계하지 않는다. UUID가 없는 이전 상태도 닫힌 상태로 유지하므로 업그레이드 시 Cloud NIC 인벤토리를 검토한 후 정책을 다시 적용해야 한다. DHCP 라우터는 Promiscuous 역할로 처리하고 명령 실패를 덮어쓰지 않는다.

## UI와 권한

기존 VM 메뉴의 MoldDialog·세로 폼·탭/toolbar·breadcrumb·테마 변수를 재사용한다. L2/Shared 생성, 네트워크 상세, VM NIC 연결에 동일 진단을 표시한다. 상세 탭은 진단 제목과 우측 아이콘 동작을 안내 영역보다 먼저 배치한다. 지원/미지원/가용 호스트 없음/불명/조회 실패를 구분하고 조회 중 실행을 막는다. 조회 권한이 없는 역할과 다른 하이퍼바이저는 지원 성공으로 표시하지 않으며 기존 서버 권한 검사를 따른다. 프로젝트·호스트·오퍼링·경로·사용자 변경 시 늦은 응답을 폐기한다.

일반 역할에 대한 기존 API의 VLAN/broadcast URI 마스킹은 유지한다. PVLAN 식별 정보가 응답에 없는 경우 UI가 이를 추정하거나 관리자 정보를 별도로 노출하지 않는다. 실제 읽기 전용 역할 시험에서는 해당 마스킹과 생성/NIC 연결 버튼 비활성화를 함께 확인한다.

## 검증 경계

31-2·32-1의 동일 호스트 L2 시험에서 Isolated/Community/Promiscuous의 실제 전달 행렬을 검증한다. 두 VM이 여러 시험 NIC를 가지므로 MAC 기준 게스트 설정, 출발 인터페이스 지정, ARP 제어와 source routing을 사용한다. ARP가 없는 상태와 목적지 MAC을 고정한 상태의 ICMP, 인터페이스에 묶은 TCP를 구분한다.

스위치 미설정 환경이므로 호스트 간 전달·실제 QinQ 트렁크·Shared PVLAN의 DHCP 라우터 통신·호스트 전체 재부팅·라이브 마이그레이션은 이 시험의 통과 항목이 아니다. QinQ 경로는 명시적 trunk와 신뢰 경계가 필요한 별도 모드이며 집중 테스트와 실환경 검증을 구분한다. 재시작 증거는 시험 VM 정지/시작과 에이전트 재연결이다. 광범위한 역할·조건부 회귀 #1569는 별도 유지한다.

참고: [OVS VLAN FAQ](https://docs.openvswitch.org/en/latest/faq/vlan/), [ovs-ofctl bundle](https://www.openvswitch.org/support/dist-docs/ovs-ofctl.8.html), [OVS actions](https://docs.openvswitch.org/en/latest/ref/ovs-actions.7/), [공식 CentOS NFV 패키지](https://docs.centos.org/centos-nfv-sig-documentation/).
