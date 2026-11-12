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

# 변경 설계

## 원인과 경계

기존 경로는 optional projectid가 없으면 프로젝트 역할 문맥이 비어 같은 프로젝트 구성원의 명시적인 SSL 명령 deny가 적용되지 않았다. UI는 공통 처리로 projectid를 전송해 거부되지만 직접 API 호출은 작업을 만들었다. 비구성원 전체에 열린 것으로 확대해서 표현하지 않는다.

## 적용

`SpecificCmdValidationWorker.handle`에서 AssignCertToLoadBalancerCmd/RemoveCertFromLoadBalancerCmd만 먼저 검사한다. 변환된 LB ID를 `EntityManager`로 조회한 뒤 계정 유형이 PROJECT이면 `ProjectService.findByProjectAccountId`로 실제 프로젝트를 찾는다. 대상·계정·프로젝트가 없으면 기존 오류 범위로 종료한다.

명시 projectid가 실제 소속 UUID와 다르거나 개인 LB에 프로젝트를 지정하면 거부한다. 일치 비교는 UUID 대소문자를 허용하며 큐에 넣는 값은 실제 UUID로 정규화한다. 개인 LB는 남아 있던 프로젝트 문맥을 지운 뒤 기존 소유자 정책을 적용한다.

CallContext에 실제 프로젝트와 정식 API 이름을 설정하고 기존 `accountService.checkAccess(caller, null, true, apiName, loadBalancer)`를 호출한다. 기존 관리자·도메인 계층·프로젝트 구성원 및 역할 판단을 사용한다. PermissionDenied는 401로 반환한다. 이 dispatch chain은 작업 등록 전과 실행 전에 호출되므로 실행 시 API 이름이 유실되는 경우에도 문맥을 다시 설정한다. 승인된 강제 교체를 별도 remove API 권한으로 확대하지 않는다.

다른 명령은 즉시 반환하고 원래 파라미터 검증을 계속한다. ApiServer/DomainChecker/API 키 필터·역할 정의·UI/API 계약을 바꾸지 않았다. 인증서 본문 검증과 기존 기능은 계속 기존 코드가 담당한다.

## 배포

WSL ext4 clone에서 server 모듈의 테스트/package만 수행했다. 활성 관리 JAR에 검증된 SpecificCmdValidationWorker.class 한 entry를 교체하고 관리 서비스를 재기동했다. 이전 JAR은 WSL에 영구 보관하고 서버 RAM 경로에도 임시 보관했다. JAR 전체 entry를 비교해 나머지204,656개가 동일함을 확인했다. WEB-INF/META-INF를 유지했으며 UI를 빌드하거나 정적 파일을 배포하지 않았다.

## 잔여

이슈 #1619의 UI guard/실패 복구/모바일 표준, #1621의 VPN 재시작 및 #1622의 서명 조회 문맥은 이 변경에 포함하지 않는다. 특히 #1622의 ApiServer 인증 순서 원인은 아직 조사 가설이며 확정하지 않는다.
