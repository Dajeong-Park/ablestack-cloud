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

# 설계와 배포 경계

`ApplicationLoadBalancerManagerImpl.detectInternalLbRulesConflict`의 `lbRule.getNetworkId() != newLbRule.getNetworkId()`를 `!Objects.equals(...)`로 바꿨다. 두 getter는 Long이므로634처럼 별도 boxed 객체인 같은 ID가 다른 네트워크로 오판됐다. 기존 DAO는 source IP·source IP network id·not Revoke로 조회하며 이 조건을 바꾸지 않았다. 소유자/VPC/source 범위·포트 중복 검사는 그대로다. API endpoint·요청/응답 스키마나 정책 변경이 아니다.

새12검사: 같은 ID의 별도 Long 객체/다른 포트 허용, 다른 네트워크 거부, null/유효 ID 거부·양쪽 null의 null 안전 비교, 동일 포트·범위 시작/끝·내포/포함 중복 거부, 인접 범위 허용, 자기 규칙 제외, DAO에 source IP network 범위 전달. 양쪽 null의 집중 검사는 충돌 함수의 비교만 다루며 실제 생성의 유효 네트워크 검증을 우회하지 않는다. 기존 ApplicationLoadBalancerTest11검사도 함께 통과했다.

수정 전 소스에서 새 양성1검사가 기존537 원인인 NetworkRuleConflictException으로 실패했다. 최종23검사/2 suite·module package·Checkstyle0을 확인했다. 중간 검증 스크립트가 테스트의 lenient 호출을 중복 삽입한 컴파일 오류는 수정 후 재검증했고 제품 코드 문제로 집계하지 않는다. 최종 전체 server 테스트 suite나 전체 Cloud 빌드 성공을 주장하지 않는다.

활성 `/usr/share/cloudstack-management/lib/cloudstack-4.23.0.0-ABLESTACK.Mold.jar`의 ApplicationLoadBalancerManagerImpl.class 하나만 교체했다. 다른204,656 entries(이전#1616 복구 클래스 포함)는 byte 동일하다. 최종 JAR SHA256 `59eee902d56ef4860ef4c453f5d9f7caed2c1a49ddf017f56622e6b80e842cf9`. UI webapp 전체 교체·삭제나 정적 자산 변경은 없다. WEB-INF는 양쪽 존재하고 META-INF는 양쪽 부재로 기존과 동일하다.

원래 JAR의 durable 백업은 WSL ext4 `/home/ablecloud/work/gn1617/backups/cb8790a671e199152900e9a5a6d1495ce456baa8b945169309a262ac03cc6f31.jar`이다. 원격 RAM 백업은 배포 receipt에 기록했으며 재부팅 시 소실될 수 있으므로 durable 백업을 롤백 기준으로 한다. 32 디스크 제약으로 기존 서버 백업을 삭제하지 않았다.

[빌드 증거](evidence/product-build-attestation.json) · [31 배포](evidence/31-backend-deployment.json) · [32 배포](evidence/32-backend-deployment.json) · [31 최종 감사](evidence/31-final-deployment-audit.json) · [32 최종 감사](evidence/32-final-deployment-audit.json).
