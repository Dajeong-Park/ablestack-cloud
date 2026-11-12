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

# 자원·환경·입력 오류와 제품 결함 분류

사용자 지시: 자원 부족 등 선행 조건이 없는 시험 실패를 제품 오류로 등록하지 않는다. 오류 코드 숫자만으로 분류하지 않고 실제 원인·유효 입력·runtime과 재시도 결과를 함께 판단했다.

| 관찰 | 확인한 원인 | 조치·최종 처리 |
| --- | --- | --- |
| 31 VM 생성530/VNET 없음 | 자동 VLAN 풀 소진 | 사용하지 않는 전용 QA 범위를 확인해 임시3900-3901 제공, 해당 소모 망 삭제 후 원래 범위 복원 |
| 31 ConfigDrive 생성530 | secondary91%가 임계90% 초과, 물리32GiB 여유 | 작은 QA ISO 생성에만 임계0.92 한시 적용·0.90 원복, 정상 재시도; 실패 VM 정상 API 정리 |
| 31 새 Public Tier NIC를 위한 VLAN | 기존 풀 소진 | 미사용3900을 host/API로 확인해 QA 범위로 등록; 확인 NIC와 함께 명시 보관 |
| Public IP 부족 | 시험 풀 소진 | 가장 오래된 무사용 QA 망1개 정상 삭제,10.10.31.107 확보·재사용·최종 Free |
| 초기 echo/단일 LB 수신 실패 | 게스트/host firewalld의 시험 포트 미준비 | 원본 확인 후 좁은 runtime source/port만 허용, 실제 preflight 후 재시험 성공, 원본 규칙 복원 |
| PF 다중 범위431 | 서로 다른 public/private 시작 포트 입력 | API의 동일 범위 계약에 맞춰 수정, TCP/UDP 두 포트 실제 통신 성공 |
| VPC PF431 | VPC IP의 networkid 누락 | 명시 networkid로 재요청; 제품 오류 등록 안 함 |
| Internal 전용 Tier의 PF530 | 해당 오퍼링에 PortForwarding 없음 | Public LB Tier/전용 NIC로 fixture 수정 후 nonconserve 계약 양쪽 성공 |
| VPN client receipt의 PID 재사용 | 이미 종료한 시험 PID가 외부 프로세스에 재사용됨 | 소유 프로세스 검증·오래된 receipt만 정리, 외부 프로세스 유지 |
| Linux Bridge PVLAN/Health Monitor 미지원 | 현재 제공자 capability와 환경 | 정상 거부·조건부 미실행, 제공자를 임의로 활성화하지 않음 |

이 표의 항목으로 새 제품 기능 결함을 등록하지 않았다. 새 UI 후속 두 건은 실제 UX 개선 사항으로 P3이며, API·보안 정책과 기능 시험의 중요 오류 분류를 바꾸지 않았다.
