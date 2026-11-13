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

# #1635 코멘트 길이 사전 안내 설계

공통 AnnotationsTab에 입력 전 255자 제한 안내와 현재/최대 길이를 표시한다. AddAnnotationCmd는 Parameter의 기본 길이 255와 Java String.length를 사용하므로 UI도 입력 원문의 JavaScript String.length, 즉 UTF-16 단위로 계산한다. 앞뒤 공백을 제거해서 길이를 계산하지 않는다. textarea의 실제 줄바꿈은 LF 1자이며 일부 이모지는 2자 이상이다.

## 화면과 동작

- 기존 VM 표준 툴바의 보내기→아이콘+텍스트 업데이트 순서를 사용한다.
- 세로 입력란 바로 아래에 제한 안내·현재 길이 카운터·초과 안내를 배치한다. 좁은 화면에서는 안내와 카운터가 줄바꿈한다.
- 255자를 넘으면 보내기와 Ctrl+Enter 모두 POST 전에 거부한다. maxlength를 사용해 초안을 잘라내지 않는다.
- 초과 입력과 실패 후 초안, 관리자 전용 표시 선택, 기존 목록은 유지한다. 사용자가 길이를 수정하면 정상 제출이 가능하다. 실제 성공한 제출 원문과 현재 초안이 같을 때만 기존 성공 초기화를 수행한다.
- 빈 입력·전송 중·API 권한·자원/사용자/프로젝트/로그인 범위 변경 가드, 관리자 가시성·작성자 삭제 정책을 유지한다. 읽기 전용 이름을 근거로 허용된 메타데이터 권한을 바꾸지 않는다.
- 안내를 aria-describedby로 연결하고 초과 입력에 aria-invalid를 지정한다. 카운터는 현재/최대 길이를 읽을 수 있게 표시한다. 오류색은 기존 테마 토큰을 사용한다.

## 검증

254/255/256, 한글·LF·이모지·공백·긴 붙여넣기·HTML 리터럴을 검사한다. 초과/빈 입력은 POST 0건, 수정 후 사용자 실행은 POST 1건이며 성공 초기화를 API 저장 원문과 대조한다. 통제된 503·권한 거부 뒤 입력/목록 보존, 프로젝트·화면 왕복, 1280/768/390 light/dark를 실제 31·32 UI에서 확인한다. 기존 코멘트와 VM·네트워크·VPC·NIC를 보존하고 새 확인용 코멘트를 유지한다.

변경 범위는 AnnotationsTab·KO/EN locale·UI 회귀 시험이다. API와 서버 저장 제한은 수정하지 않는다. #1634와 같은 브랜치 및 PR #1637에 포함하며, 종료된 Epic을 다시 열지 않는다.
