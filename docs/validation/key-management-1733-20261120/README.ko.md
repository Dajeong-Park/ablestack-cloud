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

# KM-06 키관리 입력과 작업 결과 검증

구현 커밋 75896d31b6f5dc16cd7562429e02455dfa2a6aea, 로컬과 upstream 베이스 ebce1bfb72a22e2f0d6a21e6b553b152240f07a1.

KMS 생성은 128·192·256 중 기본 256을 사용한다. 회전은 같은 세 옵션과 현재 길이 유지(파라미터 생략)를 제공한다. 잘못된 값은 직렬화 단계에서 거부한다. HSM은 프로토콜 허용 키만 details[0].필드로 전송하며 비어 있는 선택 항목을 빼고 Database의 빈 map은 생략한다. PIN과 placeholder는 결과·오류 요약에 사용하지 않는다.

전용 MoldDialog와 작업 컨트롤러는 KMS 생성·수정·회전·삭제, HSM 생성·수정·삭제의 요청과 결과를 처리한다. 작업 UUID와 고정된 세션·프로젝트·대상 범위를 확인하고, 최종 성공을 대조할 수 있을 때 리소스 재조회로 확인 완료를 표시한다. 실패 후 같은 창에서 입력을 보정하고 재시도할 수 있다. 미확정 상태에서 ‘결과 다시 확인’은 같은 작업 또는 자원을 읽으며 생성·회전 요청을 반복하지 않는다. 리소스 후보만 확인되고 해당 요청과의 관계를 단정할 수 없으면 미확정으로 둔다. API와 DB 스키마 변경은 없다.

| 시나리오 | 13번 UI와 요청 관측 |
| --- | --- |
| 생성·회전 | 기본 256, 128·192·256 각각의 회전, 현재 길이 유지에서 keybits 생략. 같은 키 UUID의 현재 버전과 비트 수 재조회 |
| HSM details | Database 요청에 details 인자 0개. PKCS#11 마지막 선택 값 제거 시 library와 slot_list_index만 전송. 프로토콜 왕복 후 PIN과 이전 입력 폐기 |
| 실제 HTTP 431 | 키에서 참조하는 시험 HSM 삭제가 거부됨. 같은 창의 대상 유지. 키를 제거한 뒤 명시적 재시도로 성공 및 부재 확인 |
| 실제 async 실패 | 비활성 시험 키 회전에서 HTTP 200 접수 후 jobstatus=2. 실패 요약에 포커스, 128 선택 및 대상 유지. 키 활성화 뒤 같은 창에서 한 번 재시도해 jobstatus=1 및 반영 확인 |
| 통제한 응답 유실 | 서버로 회전 요청 한 번을 전달해 접수 응답을 받고 시험 브라우저에 반환할 때만 유실 처리. 화면 미확정, 다시 확인에서 읽기만 실행하고 대상 1건을 관측. 해당 요청의 최종 결과는 검증 범위 밖 |
| 포커스와 Escape | 빈 이름은 서버 호출 없이 같은 창에서 검증 요약에 포커스. Escape로 닫기 |
| 프로젝트 | 관리자 명시 선택 시 해당 프로젝트의 HSM 선택 가능. 시험 프로젝트와 프로파일 정리 |
| 정리 | 활성 시험 KMS/HSM/프로젝트 0, 기존 Database HSM Disabled. 관리 JAR 해시 보존, 서비스 active |

WSL 집중 단위 테스트 87건/4개 묶음 및 변경 파일 ESLint 통과. Windows 세션이 연결 해제 상태여서 WSL Playwright/Chromium에서 13번 실제 UI를 검증했다. 실제 동기·비동기 서버 실패와 응답 유실 시험은 위 표처럼 구분한다. 자동 시험 로그에는 비밀번호·PIN·세션 토큰을 기록하지 않았다. 일부 시나리오는 단계별로 실행했으며 [정제된 요청과 상태](ui-api.json)에 해당 관측 기록을 합쳤다.

[실제 회전 실패](01-actual-async-failure.jpg) · [재시도 확인](02-explicit-retry-verified.jpg) · [통제한 응답 유실](03-deliberately-lost-response.jpg) · [실제 동기 오류](04-actual-synchronous-rejection.jpg) · [로컬 입력 검증](05-final-validation.jpg) · [배포·정리 대조](verification.json)

WSL production 모드의 비릴리즈 번들로 UI 파일 698개를 검증했고 기존 설정을 보존했다. 백업은 /var/lib/cloudstack/management/key-management-1733-backup-20261120/ui에 있다. 릴리즈 빌드는 GitHub Actions 정책을 따른다. 실제 HSM 인증과 암호화 볼륨 데이터 I/O는 #1025 범위다.

다음 구현은 #1732다. 마지막 #1737은 가상머신 표준 breadcrumb·목록·상세·탭·탭 콘텐츠·대화상자 통일을 전체 점검한다.
