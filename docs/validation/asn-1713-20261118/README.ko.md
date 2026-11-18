<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this
work for additional information regarding copyright ownership. The ASF
licenses this file under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may
obtain a copy at http://www.apache.org/licenses/LICENSE-2.0 . Unless required
by applicable law or agreed to in writing, software distributed under the
License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS. -->

# ASN-05 구현·통합 검증 (#1713)

Epic #1708 / PR #1716의 마지막 하위 구현이다. 소스 기준은 `0b92097f11c6d0cb0c7c960d9fbb4107bd30f17e`이며, 검증은 2026-11-18~19 한국시간에 수행했다.

## 변경 결과

- AS 번호 목록에서 권한·Routed 지원을 확인하고 기존 Zone의 AS 번호 탭으로 이동한다. 여러 Zone은 선택창을 사용한다. 원래 검색·페이지로 돌아오는 경로를 보존한다.
- VM 공통 AutogenView/ListView, breadcrumb, 검색, 페이지, MoldDialog/MoldDialogActions를 사용한다. Zone 탭은 제목·생성 도구·개수·생성일·범위별 삭제를 같은 흐름으로 배치한다.
- 용어를 AS 번호 / ASN 범위 / 가용·할당 / 할당 일시로 정리한다. 없는 참조·일시는 `—`, 유효한 UUID와 표시 이름·조회 권한이 있을 때만 링크, 실제 행 ID에만 복사를 제공한다.
- `listASNumbers`에 리소스 조건인 `releasable`, `releasereason`을 추가했다. 기존 필드와 동기 계약을 유지하며, 권한 검사는 별도로 적용한다. 새 eligibility 조회는 페이지당 망·VPC·각 오퍼링을 최대 네 번의 묶음 조회로 읽는다. 기존 표시 이름 조회까지 모든 쿼리를 상수로 바꿨다는 주장은 하지 않는다.
- 목록과 해제는 동일한 순수 정책을 사용한다. 요구 오퍼링·참조 누락·불확실 상태는 차단한다. Root Admin과 명령 권한을 확인하고 Zone→범위→번호 잠금, Zone+ASN 유일성, 최신 할당/참조/오퍼링을 재검증한다. 이미 가용이면 무해한 성공이다.
- 단일 행 해제 확인창은 Zone UUID·ASN·행 UUID·연결 리소스·영향을 고정한다. 전송 직전 다시 조회하고 API에는 zoneid/asnumber만 전달한다. 동기 성공 뒤 같은 대상이 가용인지 확인한다. 타임아웃·읽기 실패는 자동 재전송 없이 추적·재확인한다. 세션/권한/경로 변경 뒤 늦은 결과를 반영하지 않는다.
- 테마 토큰으로 목록·상태 태그·참조 링크·검색 chip/label/입력/도움말을 보강했다. 이전 기본 저장 열 선택은 새 기본 열로 이행하며 공통 열 선택기의 빈 제목을 유지한다. 목록 갱신 중의 자식 선택 이벤트가 부모 선택을 잃게 하던 ASN 경로도 보정했다.

## 검증 범위

31 GFS2·32 RBD에서 작은 Private Use ASN 범위만 UI로 생성한다. 실제 ISP/BGP 피어·세션·경로 광고·패킷·라우터 설정은 변경하지 않는다. 기존 망/VPC/VNF/Public IP 기능 전체 체인은 재시험하지 않는다.

실제 해제 화면을 검사하기 위해 새로 생성한 폐기 가능한 ASN 행에만 통제된 할당 참조를 기록했다. 기존 망/VPC/오퍼링은 읽기 참조이며 수정하지 않는다. 이것은 ISP의 실제 할당이나 BGP 해제를 증명하지 않는다. specifyasnumber=true, 교차 Zone·동시성·오퍼링 최신성은 H2/Mockito fixture로 별도 확인한다.

## 증적 안내

- [BUILD.ko.md](BUILD.ko.md): 변경 모듈·UI 테스트, 배포 보존/해시, 정적 검사와 전체 CI 경계.
- [RESULTS.ko.md](RESULTS.ko.md): 실제 UI/API·화면 행렬·정리 및 잔여 범위.
- `live-api.py`: UI 생성 범위 식별, 소유 ASN만의 통제된 fixture, 동기 API·권한/정리 대조. 인증값은 실행 환경변수만 사용한다.
- `prepare-overlay.py`, `OverlayASNIntegration.java`, `test-overlay.py`: 현재 배포 클래스의 무관한 메서드·필드를 유지하는 배포 payload 및 동일 테스트 검증.
- `deploy-both.py`, `deploy-static.sh`, `deploy-ui-final.py`, `verify.py`: 변경된 메서드/정적 파일만 적용. JAR 원본과 덮는 정적 파일을 백업하고 WEB-INF·서버 설정·무관 클래스 바이트·HTTP 200을 확인한다.

전체 Cloud 빌드와 Actions 수동 실행은 요청되지 않아 수행하지 않았다. Epic의 구현 완료와 PR의 리뷰·병합 완료는 구분한다. 외부 ISP 검증은 #1636의 환경 확보 후 별도 조건부 작업이다.
