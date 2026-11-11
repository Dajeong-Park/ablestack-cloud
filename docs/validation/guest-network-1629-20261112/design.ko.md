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

# 원인·개선 설계·보안 계약

## 프로젝트 문맥으로 네트워크 사용 권한을 검사

ManagementServerImpl.searchForIPAddresses의 DirectAttached/Shared/Account ACL 분기는 먼저 네트워크 소유 계정의 접근 권한을 검사한다. 이 접근이 거부되면 원래 개인 호출자에게 네트워크 UseEntry를 검사했다. 프로젝트에만 NetworkPermissions가 있고 개인 계정에는 없으므로, listNetworks(id,projectid)가 성공해도 Shared IP 목록은531이 됐다.

수정은 그 fallback 분기로 한정했다. 명시 projectid가 있으면 양수의 단일 프로젝트인지 검사하고 AccountManager.finalizeOwner로 호출자의 프로젝트 접근을 검증한 뒤 해당 프로젝트 계정으로 UseEntry를 검사한다. 프로젝트 구성원 자격과 프로젝트의 명시 네트워크 공유 권한을 모두 통과해야 한다. projectid 생략은 기존 개인 호출자를 사용하며 프로젝트 멤버십을 암묵적으로 합치지 않는다.0/-1도 이 fallback에서 허용하지 않는다.

소유자·Root·DomainAdmin의 기존 직접 소유 계정 접근, Domain ACL/가상 네트워크 분기, API 입력/응답 형식, 프로젝트 역할·API 접근 검사와 쓰기 권한은 바꾸지 않았다. 주소 검색의 buildACLSearchParameters/Builder/Criteria에는 **원래 caller와 cmd의 projectid**를 계속 전달한다. 검사 때 사용한 프로젝트 계정으로 전체 검색 권한을 바꾸지 않는다.

## 조회 범위와 기존 관리자 동작

현재 allow.user.list.available.ips.on.shared.network=false를 유지한다. 일반 구성원·읽기 전용은 해당 프로젝트가 할당한6개 주소만 조회하고 다른 소유자의 할당 주소·사용 가능 주소는 보지 못한다. 주소 ID만 전달하는 경로도 실제 source network를 확인한 뒤 같은 권한과 ACL을 적용한다. VM ID·IP 조합을 실제 프로젝트 VM/NIC6개와 대조했다.

Root는 수정 전부터 네트워크 전체18개를 조회할 권한이 있다. 다른 유효 프로젝트를 명시해도 직접 IP API는18개를 반환하는 기존 관리자 계약을 유지한다. 같은 조건의 listNetworks는0개이고 실제 UI는 그 프로젝트에 없는 네트워크 상세/IP 표를 제거한다. 이를 일반 구성원의 프로젝트 거부와 혼동하지 않는다.

## 회귀·배포 경계

새 SharedNetworkIpProjectAccessTest10건은 membership→project UseEntry→원래 caller ACL 검색 순서, 비구성원·없는 프로젝트·공유 없는 프로젝트·개인 문맥·0/-1·IP ID 유도·Isolated 거부·기존 소유자 경로를 검증한다. 기존4개 테스트 클래스64건과 함께74건을 실행했다. 명시 프로젝트 역할 거부는 실제 API로401과 원상 복구를 검증했다.

변경 소스는 ManagementServerImpl와 새 테스트 두 파일이다. WSL ext4의 변경 api/server 모듈을 로컬 빌드하고 활성 management JAR의 ManagementServerImpl 계열6클래스만 반영했다. 다른204865 archive entry와 #1628/#1630/ILB 보호 marker, UI static675파일을 보존했다. 전체 원본 JAR는 비공개 WSL에 백업하고 정상 API 확인 후 임시 rollback hardlink를 제거했다.

구현 commit: `9301805307f5787d803d8e2a49a0f710d012260e`. [실제 배포·검증 근거](test-results.ko.md).
