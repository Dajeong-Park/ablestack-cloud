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

# 원인과 구현 설계

## 실제 MAC이 사라지는 경로

PublicIp.createFromAddrAndVlan이 NetUtils.createSequenceBasedMacAddress를 호출할 때 DB sequence 외에 무작위 바이트가 들어간다. NetworkHelperImpl의 기존 MAC 유지는 활성 peer NIC가 있을 때만 동작했다. 도메인 수정의 네트워크 재구현이 기존 VR/NIC를 먼저 제거하면 peer 조회 결과가 없어 true에도 새 MAC을 사용했다.

수정 전 31 실제 UI와32 API에서 같은 Source NAT IP·true를 유지하면서 MAC이 바뀌는 것을 분리 재현했다. 그 결과는 이전32의 r-503/505/506 기록과 별개로 이번 단계에서 새로 수집했다.

## 삭제 전 보존·할당 세대 검증

RouterPublicMacManager를 Spring manager로 등록했다. NetworkHelperImpl.destroyRouter는 기존 접근 검사 후, expunge 전에 실제 VR의 Public MAC과 활성 DomainRouter NIC를 대조해 보존한다. 상태가 실패한 후보 VR·제거된 NIC·다른 owner의 라우터 매핑은 보존 원본으로 사용하지 않는다.

기존 user_ip_address_details의 비표시 내부 키 `router.public.nic.mac.v1`를 사용한다. IP UUID·allocationGeneration·계정/도메인·guest network/VPC·Public network·VLAN·Zone·IP와 관측 MAC을 함께 기록한다. 기존 allocationGeneration이 없는 할당만 실제 VR/NIC 확인 후 세대를 부여하며 할당 시간은 유지한다. 별도 DB 스키마/마이그레이션은 없다.

현재 IP row를 잠그고 같은 할당인지 다시 검사한다. 해제/재할당, 같은 시각의 다른 할당 세대, 다른 소유자/네트워크/VPC/망/VLAN은 이전 MAC을 받지 못한다. 제거된 NIC를 무차별 검색하지 않는다. 이미 활성 peer NIC가 있는 기존 경로는 유지한다. MAC 기록은 재생성 실패 후 재시도에서도 남고 실패한 VR이 덮어쓰지 않는다.

true는 일치하는 MAC을 사용한다. false는 보존 값과 다른 MAC을 사용하며 무작위 생성이 우연히 같은 값이면 최대8회 재선택한다. 계속 충돌하면 주소 용량 오류로 실패시켜 false인데 같은 MAC으로 성공했다고 표시하지 않는다. 실제 false→true 전환은 false에서 관측한 새 MAC을 다음 true 재구현에서 유지한다.

## API/권한 경계

MAC 보존 기록은 일반 metadata API의 대소문자 혼합 추가·지정 삭제·전체 삭제로 변경할 수 없다. 일반 Public IP metadata의 개별 추가·삭제는 유지한다. 양쪽 실제 API에서 보호3조건431/job2와 일반 키의 생성·삭제를 확인했다. 네트워크 수정 API/응답 계약·기존 프로젝트 역할·공유 범위는 바꾸지 않았다. readOnly 변경 API는401/432와 job 없음, owner/member/readOnly의 올바른 프로젝트 조회는 성공했다.

## 집중 회귀와 적용 범위

RouterPublicMacManagerTest14건은 NIC 제거 이후 유지·같은 timestamp의 새 세대·해제·다른 owner/network/Public network/VLAN·legacy 세대·잘못된/실패 NIC·경합·VPC primary Source NAT scope·손상/버전/MAC·보존 정보 부재를 검증한다. NetworkHelperImplTest18건은 기존 peer와 true/false·peer 없는 보존·무작위 충돌 거부를 포함한다. metadata6건·기존 Shared subnet5건·프로젝트 Shared IP10건과 합계53건이다.

실환경 재생성은 준비된 단일 Isolated VR에서 수행했다. VPC primary 할당 경계와 활성 peer 경로는 집중 단위 회귀다. live 이중화 election/failover, VPC 추가 Public NIC 전체의 보존을 이번 결과로 일반화하지 않는다. 이 환경의 미구성 guest VLAN trunk·이중화 통신 조건을 통과로 바꾸지 않고 #1569의 조건부 항목으로 남긴다.

구현 commit `7358e8aa80232d496251680fecfd78ff4890d355`. 배포7 entry는 세 manager 계열 클래스와 Spring XML이다. XML은 manager bean3줄 추가 외 양쪽 기존 파일과 동일하다. 나머지204866 entry, UI675파일/WEB-INF/META-INF/config를 보존했다.
