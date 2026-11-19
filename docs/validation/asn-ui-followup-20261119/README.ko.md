<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this
work for additional information regarding copyright ownership. The ASF
licenses this file under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may
obtain a copy at http://www.apache.org/licenses/LICENSE-2.0 . Unless required
by applicable law or agreed to in writing, software distributed under the
License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS. -->


# AS 번호 목록 및 Zone ASN 범위 표 후속 보정

대상은 Epic #1708 / PR #1716의 사용자 화면 피드백이다. 기존 네트워크·VPC·VNF·Public IP 전체 체인은 반복하지 않는다. ISP/BGP 세션·경로 광고·실통신 검증은 포함하지 않는다.

## 변경

- VM AutogenView/ActionButton/SearchView와 같은 배치: 주요 작업은 둥근 텍스트 버튼, 해제는 접근 가능한 이름과 툴팁이 있는 원형 아이콘 버튼, 검색은 뒤에서 남은 너비를 채운다.
- 가용 ASN 등록 안내 리본과 사용하지 않는 번역을 제거한다.
- 최초/다른 검색 조건 로딩과 동일 범위 백그라운드 갱신을 구분한다. 기존 행·선택·컬럼·빈 목록 문구를 유지하고 실패/권한/범위 변경 가드는 보존한다. 해제 제출 직전 최신 대상 재검증은 기존대로 수행한다.
- Zone AS 번호 탭의 범위 표를 VM의 middle 크기와 가로 구분선 구조로 맞춘다. 밝은 수직/외곽 테두리를 제거하고 머리글·본문·hover·구분선·문자를 테마 토큰으로 통일한다.

## 로컬 검증

WSL ext4 `/home/ablecloud/work/dhslove/cloud-asnumbers-ui-followup`에서 실행한다. 배포 빌드는 기존 `asn-1713-20261118/build-production.cjs`를 사용하며 production source map만 생략한다.

- ASN 검색/목록/작업/해제 6 suites, 50 tests PASS.
- Zone 범위 생성·삭제 2 suites, 30 tests PASS.
- 변경 Vue/JS lint 및 production UI build PASS. 마지막 기준선/빈 chip 보정 후 영향받는 2 suites/10 tests 재실행 PASS.
- 동일 범위의 지연된 빈 목록 갱신, 초기 조회/검색 조건 변경/실패 차단, 갱신 중 행 선택과 응답 후 최신 행 동기화를 테스트한다.

## 재현 및 배포

`MOLD_PASSWORD`를 환경 변수로 제공하고 `python3 live-api.py create`로 각 클러스터에 64512–64514 범위만 생성한다. `add`는 64515 한 개를 추가하여 실제 데이터 증가를 확인하며, `cleanup`은 기록한 UUID만 삭제하고 최초 자원 목록과 비교한다. 세션/비밀 키는 증적에 저장하지 않는다.

`SSHPASS`를 환경 변수로 제공하고 `deploy-ui-final.py`를 실행한다. 기존 정적 자산을 백업한 뒤 정적 파일만 업데이트한다. WEB-INF·META-INF·config·관리 JAR을 보존하고 HTTP 200, JAR hash, PID, FTCTL 마커를 검증한다. 서버/호스트 패키지와 DB는 변경하지 않는다.

## 31·32 클러스터 실제 결과

- 가상머신 메뉴를 기준으로 버튼과 검색창 높이 32px 및 기준선을 일치시켰다. 두 클러스터 × 라이트/다크 × 1280/768/390px의 12개 목록 배치와 같은 12개 Zone 표 배치를 확인했다.
- 검색창의 일반 검색 및 고급 정확 ASN 검색이 각각 API 결과와 같은 1행을 반환한다. 범위 관리와 원래 목록으로 돌아오는 경로도 확인했다.
- 응답 지연 5초를 적용해 기존 3행→새로운 4행 및 삭제 후 4행→0행의 데이터 변경을 확인했다. 갱신 중 기존 행·선택·표 위치를 유지하고 표 전체 spinner와 안내 리본이 나타나지 않는다. 행 삭제 응답 후 선택도 정리된다.
- 정상 빈 목록의 갱신 전·중·후 문구와 표 위치가 동일하며, `로딩 중`으로 번갈아 바뀌지 않는다. 초기 조회/검색 조건 변경/실패 차단은 단위 테스트로 별도 확인했다.
- Zone 표의 흰 오른쪽 선 `#f0f0f0`를 제거했다. 다크 모드는 구분선 `#3e4650`, 머리글 `#272e36`, 본문 `#22282f`, 문자 `#c5ccd4`를 사용한다. 작은 화면은 표 내부 스크롤로 표시하고 문서 전체가 가로로 넘치지 않는다.
- 두 클러스터의 테스트 ASN 범위/번호는 0으로 정리했고 기존 VM·망·VPC·Public IP·Zone의 UUID/개수는 최초와 동일하다. 네트워크 지연을 해제하고 라이트 모드 및 기본 viewport(1102px)를 복원했다.
- 최종 index SHA256: `b9de989dafa00348a7bc6fdd6dae46423209196b7cc14721a3f302f80d9609a1`. 관리 JAR/PID/WEB-INF/server config 보존 및 HTTP 200을 확인했다. 배포 백업은 31 `/root/asn-ui-followup-ui-20261119-005733`, 32 `/root/asn-ui-followup-ui-20261119-005752`다.

요약 측정·배포·정리 증적은 [EVIDENCE.json](EVIDENCE.json)에 기록한다. 원본 API 응답·측정 JSON·로그·스크린샷은 동일 로컬 검증 디렉터리에 보관한다. 후속 수정은 UI 범위이며 Maven/전체 Cloud 빌드·수동 Actions·ISP/BGP 실통신 검증은 실행하지 않았다.
