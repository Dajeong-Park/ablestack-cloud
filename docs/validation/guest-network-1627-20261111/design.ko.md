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

# 설계와 기존 보안 정책

기존 삭제 API는 정책의 실제 프로젝트를 권한 검사 문맥에 연결하지 않았다. HTTP projectid가 생략되면 프로젝트 커스텀 역할의 deleteLBStickinessPolicy 거부가 적용되지 않아 읽기 전용 구성원과 비구성원도 정책을 삭제할 수 있었다. 생성 API는 거부되므로 UI 버튼 가드만으로는 해결되지 않는다.

SpecificCmdValidationWorker는 DeleteLBStickinessPolicyCmd의 정책 ID로 실제 StickinessPolicy와 LB를 조회한다. LB 소유 계정의 프로젝트를 찾고 요청 힌트가 있다면 일치 여부를 검사한다. 실제 호출 사용자·계정은 유지하면서 CallContext의 실제 프로젝트와 canonical API 이름을 설정하고 기존 AccountService.checkAccess를 호출한다. 같은 worker가 접수와 비동기 실행에서 재검사한다. SSL assign/remove의 기존 보호 흐름은 공통 이름으로 재사용하며 동작은 유지한다.

DeleteLBStickinessPolicyCmd.getEntityOwnerId는 실제 정책→LB 소유 계정을 반환한다. 이는 이벤트/entity 소유자 판정이다. AsyncJobVO의 account/userid는 기존 ApiServer가 실제 호출자로 기록하며 이 동작을 프로젝트 계정으로 바꾸지 않았다. 실제 UI job 12건에서도 호출자 계정/userid가 유지됨을 확인했다.

없는 정책/LB/소유자/프로젝트, 잘못된 projectid, 명시된 다른 프로젝트는 실패로 닫는다. 개인 소유 LB는 기존 계정/도메인 접근 검사를 유지한다. 서비스 내부 create rollback의 apply=false 삭제 경로를 변경하거나 별도의 삭제 권한을 추가하지 않는다. 역할 정의·프로젝트 멤버십·사용자 비밀번호·API 보안 정책을 완화하지 않았다. 서명 검증은 기존 공통 경로를 사용한다.

새 테스트 17개는 생략/일치/불일치/빈 문맥, 없는 대상과 소유 관계, 개인 LB, 접수 전 거부, 실행 시 재바인딩과 실제 호출자 유지, 이벤트 소유자 판정을 포함한다.
