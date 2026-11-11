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

# 원인과 최소 변경 설계

ApiServlet은 서명 인증 전에 시스템 사용자 문맥에 요청 프로젝트를 설정한다. 기존 ApiServer는 HMAC 확인 전에 commandAvailable(user, null key)를 호출했다. checker의 인자는 실제 키 사용자지만, ProjectRoleManagerImpl.findCurrentUserProjectRolePermissions는 시스템 사용자를 조회해 프로젝트 멤버를 찾지 못했다. 커스텀 역할이 없는 일반 멤버/프로젝트 관리자 경로와 달리 커스텀 역할에서 허용 조회도401이 됐다. 이후 CallContext.register는 새 문맥을 만들어 project를 잃었고, 두 번째 검사 전에 servlet이 프로젝트를 재설정하지 않았다.

서명·사용자/계정 상태·키 제거/기간·API 키 접근 허용 검증을 통과한 뒤 프로젝트를 보존해 실제 사용자 문맥을 등록하고 API 이름을 설정한다. 그 상태에서 기존 null-key 계정/프로젝트 검사와 key-permission 검사를 순서대로 모두 호출한다. 첫 검사를 없애거나 키 allow를 프로젝트 deny보다 우선시키지 않는다. session userId 분기는 변경하지 않았다. role checker·역할 서비스·DomainChecker·SSL 서비스·명령 정의·기존 역할 정책도 그대로다.

새 시험은 실제 verifyRequest를 실행하고 ACL 호출 시 실제 사용자/계정/프로젝트/API 이름과 두 검사 순서를 관찰한다. HMAC-SHA256을 실제 계산하며 잘못된 서명/만료 요청/제거·만료 키/비활성 사용자·계정/계정·프로젝트 deny/키 deny를 대조한다. mock 역할 서비스로 허용 결과만 가정하는 시험이 아니다. live248건에서 실제 역할·키·scope를 추가 대조했다.

WSL ext4 server 모듈 package의 ApiServer.class만 배포했다. 수정 전 class SHA가 두 설치본과 같고 javap 정규화 대조에서 verifyRequest만 달랐다. inner class를 비롯한 나머지204,656 JAR 항목의 내용은 그대로다. 백업을 WSL에 내구 보관하고 원격 RAM에도 원본을 보관했다. 파일 소유권·모드를 보존하며 관리 서비스만 재시작했다. UI670파일·WEB-INF·설정·SystemVM은 변경하지 않았다.

API 키·secret·서명·세션 값은 공개 증거에 포함하지 않는다. 기존 로그 정책을 변경한 작업이 아니며 로그 검증은 원격에서 클래스 로딩 오류 패턴의 개수만 추출했다. 원시 로그나 키를 게시하지 않았다.
