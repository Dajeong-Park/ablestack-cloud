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

# 설계와 원인

## 기존 설치의 스키마 정합화

Shared 다중 IPv4 서브넷은 networks.cidr/gateway에 CSV로 저장한다.32의 현재 폭18/15로는 두 번째 서브넷을 저장할 수 없어 strict SQL 모드에서 Data truncation530이 발생했다.31은255/255로 확장되어 있었다. IPv6 두 컬럼도32는50/50,31은1024/1024였다.

현재 schema-42040to42100.sql에는 네 컬럼 확장이 존재한다. 실제 업그레이드 경로 계산 회귀에서 신규4.0.0 및4.20.0/1/2/3/4→4.23 경로가 이 단계를 포함하는 것을 확인했다. 따라서 **현재4.20.1 경로가 해당 DDL을 무조건 건너뛴다고 단정하지 않는다.** 실제 과거 배포 실행 경로와 스키마 드리프트의 역사적 원인은 구분한다.

SharedNetworkSubnetSchemaUpgrade는 독립 체크포인트 europa-4.23-shared-subnet-columns-v1로 실행한다. 기존 version/S6가 이미 Complete인 설치에도 적용된다. information_schema에서 각 컬럼의 문자 용량을 확인해 부족한 varchar만 확장한다. 이미 넓은 varchar/text는 줄이지 않는다. SHOW CREATE TABLE의 실제 컬럼 정의에서 폭만 바꾸므로 null/default/comment/charset/collation을 보존한다. 누락/비문자/지원하지 않는 좁은 타입이나 검사 후 정의 변경은 안전하게 실패시킨다.

DDL이 일부 커밋된 뒤 실패해도 완료된 컬럼은 재실행에서 건너뛴다. 기존 데이터·version을 재생성하거나 SQL 모드를 완화하지 않는다. 새 단계는 성공한 뒤에만 Complete가 된다. 양쪽 실제 시작 과정에서 Complete와 기존 모든 network CIDR/gateway 값·version 행 보존을 확인한 뒤 UI CRUD를 진행했다.

## 실제 재시작에서 발견한 CSV 해석 결함

31의 실제 rebootRouter는 기존 라우터를 정지한 뒤 `For input string: "24,10.249.31.0"`으로 시작에 실패했다. VirtualNetworkApplianceManagerImpl의 부팅 인자와 CommandSetupHelper의 DHCP 범위 계산이 다중 CIDR 문자열을 단일 CIDR로 해석했다.

GuestNicCidr.select는 Shared CSV에서 해당 라우터 NIC의 IPv4 주소가 속한 CIDR을 선택한다. 첫 CIDR을 무조건 고르지 않으며 두 번째 서브넷의 NIC·다른 prefix도 처리한다. 두 소비자가 같은 선택 로직을 사용한다. Isolated의 유효 IP reservation CIDR, 단일 CIDR 및 IPv4 CIDR이 없는 경우는 기존 계약을 보존한다. 추가 Shared 서브넷은 기존 IP alias 재적용 경로가 처리한다.

실패31 라우터는 같은 ID·호스트에서 startRouter로 복구했다. 수정 후 양쪽 rebootRouter의 job1·새 boot ID·DHCP 서비스·기존 IP alias/임대와 실제 DORA·갱신·DNS를 다시 확인했다. 재시작 후 변경된 관리용 link-local 주소는 API에서 새로 조회해 사용했다.

## DHCP와 권한 계약

시험 Shared NIC는 기본 NIC가 아니다. 기존 CsDhcp.py의 default_entry=false 계약은 DHCP 옵션3/6/15를 보내지 않아 기본 경로와 시스템 DNS를 바꾸지 않는다. 실제 새 IP·mask·server identifier와 ACK를 검증했고 DNS 서비스는 같은 서브넷의 실제 DHCP alias 주소에 명시적으로 질의했다. 외부 게이트웨이 경유 통신과 혼동하지 않는다.

API 요청·응답·프로젝트/역할 정책과 UI 스타일은 수정하지 않았다. Root/owner/peer/readOnly 조회와 실제 readOnly 쓰기 거부·UI 가드를 확인했다. #1629의 프로젝트 Shared IP 조회531은 별도 열린 후속으로 유지한다.
