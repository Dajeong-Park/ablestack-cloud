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

# upstream Europa 동기화와 보존

- 이전 Epic head: `6d94bdd6039f0a6dcb4434fd0bd73e30342aee06`.
- upstream `ablestack-europa`: `2d34af8f8a9b76eb9b143ef42e775883aaa630d0`, 유입19커밋/84파일.
- 병합: `5030bdde5191972697c361b6e8d5aceff2bbf6bf`, 양쪽 부모를 보존하는 merge commit. Epic 브랜치/기존 Draft PR 유지.
- 명시 충돌3파일: en/ko JSON은 base/Epic/upstream 키별 비교로 기존359키씩 보존·upstream 신규47키씩 추가, 겹친 수정키0. user.js는 기존 API 메타데이터 import와 upstream resetWallBannerDismissal import/로그인·로그아웃 호출을 함께 유지.
- 자동 병합 ListView/Autogen의 선택/문맥 action props를 확인했다. Epic 전용 UI186파일 동일. 전체 테스트에서 발견한 VmDevicesTab PCI Running staging 변경은 기존 Stopped-only reason 한 줄을 복원했다(`f9b34658514`). ACL 수정은 그 다음 UI 전용 커밋이다.
- backend 수동 충돌0. upstream의 QueryManager/KVM XML 변경은 소스 병합에 포함되나 이번 배포는 정적 UI만이다. API/JAR/호스트 패키지/전체 Cloud 빌드는 실행하지 않았다.
- Native8개 dirty worktree/12,275파일, WSL14개/107파일의 HEAD·staged/unstaged·파일 해시가 전후 동일하다. FT dirty main을 변경하지 않았다.

[병합 증거](evidence/upstream-merge-audit.json) · [키별 충돌 해소](evidence/upstream-merge-resolution.json) · [보호 결과](evidence/protected-worktrees-summary.json).
