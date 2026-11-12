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

# 완료 판정과 후속 순서

`#1631`의 단일 Isolated VR MAC 유지 결함은 구현·31/32 배포·실제 UI/API 재현과 재생성·DB/VR/libvirt NIC·실제 통신으로 완료했다. API/화면의 플래그만 바꾼 결과가 아니다. 준비된 조건의 true/false 도메인/오퍼링/cleanup/실패 재시도, 실제 패킷·기존 NIC 보존·보안 경계를 검증했다. 결과 게시 후 이 결함을 completed로 닫는다.

1. **#1632** 정상 CRL/서명 OCSP가 준비된 기본 SSL 폐기 검사 chain530 경로 개선과 문법·TLS·정책/역할 회귀.
2. **#1569** #1631 결과를 통합하고 역할 전체 UI 잔여(이번 추가 readOnly UI 촬영 포함)를 브라우저 제어 복구 후 진행한다. 같은 MAC 계약의 live 이중화/VPC 추가 Public NIC 등 실제로 준비된 조건을 구분해 검증한다.
3. 기존 #1586·독립 VPN client2대·별도 Health Monitor 제공자·IPv6/BGP/외부DNS·switch trunk 등 환경 조건을 별도로 유지하고63행 최종 종료 가능 여부를 평가한다. LB 백엔드 부하분산 측정은 제외한다.

이번32 C03/I01/I06/I07의 #1631 실패를 부분으로 갱신한다.31은 기존 부분 상태를 유지한다. 최신 집계는 **양쪽 각각 실패1/부분53/환경6/제외3, 전체 행 완료0**이다. 각63행의 모든 유형/역할/조건이 완료된 것은 아니므로 #1569와 Epic #1554를 닫지 않는다. Draft PR #1577와 Epic 브랜치를 유지하며 병합하지 않는다.

기존 VM 기준 목록의 빈 backupoffering/undefined 링크도 관찰됐다. 이번 MAC 구현과 무관한 기존 VM 렌더링 항목이므로 네트워크 링크 수정으로 혼합하지 않고 별도 VM UI 검토 대상으로 기록한다. 이 관찰만으로 새로운 보안/권한 결함을 주장하지 않는다.

확인용 자원은 사용자 지시 전 삭제하지 않는다. UI 제어 차단을 해제하려면 다음 검증 시 앱/브라우저의 연결과 대상 Mold 탭 URL 식별을 복구해야 한다. 해당 추가 촬영은 완료로 집계하지 않았다.
