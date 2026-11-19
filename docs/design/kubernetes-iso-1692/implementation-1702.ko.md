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

# #1702 통합 회귀의 읽기 권한 보정

실계정 ACL 전체 행렬, VM Metrics가 없는 VM 읽기, 실제 4.21→4.23 업로드와 업그레이드 pin을 13번 UI로 검증한다. 기존 CI 부채 #926·#1044와 기능 보정을 구분한다.

## 공식 ISO와 실제 소비

기존 카탈로그 ISO를 소비 시험에 재사용하지 않는다. 공식 Europa `mold-cks` 1.34.9와 1.34.12의 릴리스 digest·다운로드 바이트를 검증하고 같은 바이트의 시험 HTTP 사본을 UI로 등록한다. 기본 프로필은 CSI 비활성이다.

공식 1.34.9로 전용 관리형 클러스터 생성과 Provider 초기화를 완료했다. 실제 1.34.12 업그레이드 중 시험 워커를 UI로 정지하고 양쪽 카탈로그 삭제 차단을 확인했다. 워커 복구 후 클러스터와 두 노드의 `v1.34.12` 실행 상태를 UI로 확인했다. 완료 후 이전 버전 참조 해제와 최종 정리를 이어간다.

## 실계정에서 발견한 선택 조회

전용 읽기 역할은 `listVirtualMachines`를 허용하고 VM Metrics와 쓰기 API를 거부한다. 카탈로그·Zone·ISO·VM 104개와 VM 상세 읽기는 성공했고, 5분간 서버 API 226건 중 VM Metrics 요청은 0건이었다.

이때 템플릿 링크 검증, SecurityGroup 네트워크 발견, 모니터링 설정 조회가 허용되지 않은 세 읽기 API를 호출해 실제 432 응답을 받았다. 계정 권한을 늘려 해결하지 않는다.

- 이미지 링크 검증은 현재 API 읽기 권한을 확인하고, 늦은 응답을 반영하기 전에도 다시 확인한다. 허용되지 않은 관련 항목은 원래 이름을 읽되 링크를 만들지 않는다.
- VM 상세의 주석·네트워크 발견은 각각 필요한 읽기 API가 있을 때만 실행한다. 네트워크 응답 뒤의 VM 조회도 현재 권한·대상·컴포넌트 생존을 다시 확인한다.
- VM·VNF·호스트·클러스터의 모니터링 설정 조회는 해당 설정 읽기가 허용된 경우에만 실행한다.
- 쓰기 API, VM Metrics, Backend, DB 스키마, Agent 권한을 추가하지 않는다. 운영 입력의 다른 VM/VNF 차이는 보존하고 변경된 정적 산출물만 배포한다.

## 검증과 완료 게이트

현재 grant의 허용/거부, 응답 대기 중 권한 회수·대상 교체, 기존 이미지 링크·아이콘·VM 조회·KISO 회귀를 검사한다. 실제 읽기 전용 UI를 보정본으로 다시 열고 서버 요청을 대조한다.

Root 읽기 전용/URL 전용/로컬 전용/변경·삭제 제한, Domain Admin, Resource Admin, User, Read-Only User, 카탈로그 전용과 권한 회수·계정 전환을 실제 로그인으로 확인한다. 시험 계정·역할·도메인, 버전·ISO, 클러스터·VM·네트워크·IP, HTTP 파일은 UI와 정확한 자원 ledger로 정리한다. 암호·세션·티켓·API 키를 증거에 저장하지 않는다.

환경이 없는 다중 Zone·Edge·비KVM·물리 ARM/s390x 부팅은 미실행으로 명시하고 기능을 보존한다. #1707·#1702·Epic #1692는 최종 게이트와 정리가 끝난 뒤 닫고 PR #1703에 결과를 반영한다.
