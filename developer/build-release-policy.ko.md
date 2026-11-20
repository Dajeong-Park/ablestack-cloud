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

# ABLESTACK Build / Release Policy

2026-11-20 사용자 확정 기준이다. 릴리즈 빌드와 개발·집중 검증 빌드의 경로를 구분한다.
기존 문서의 모든 빌드에 대한 GitHub Actions 강제 규칙은 이 기준으로 대체한다.

## 릴리즈 빌드

정식 버전 또는 릴리즈 후보를 외부에 배포하기 위한 빌드는 **반드시 GitHub Actions**를 사용한다.

- 필요한 전체 검증과 패키징 workflow 결과, 소스 SHA, 산출물 checksum을 기록한다.
- 정식 산출물은 GitHub Release asset 경로로 추적하고 보존한다.
- 전체 검증은 `.github/workflows/build.yml`, `.github/workflows/ui.yml` 등 실제 변경 범위의 필수 workflow를 사용한다.
- `.github/workflows/release.yml`의 게시만으로 테스트 통과나 릴리즈 승인을 대신하지 않는다.
- WSL 개발 빌드나 검증용 클래스 패치를 정식 릴리즈 산출물로 승격하지 않는다.
- Actions 사용 불가·차단 시 릴리즈 빌드는 로컬 산출물로 대체하지 않고 원인을 해소한 뒤 실행한다.

## 개발·집중 검증 빌드

릴리즈가 아닌 기능 구현·회귀 시험·시험 서버 검증은 **로컬 WSL ext4 작업 트리**에서
변경 모듈의 집중 테스트와 클래스/모듈 빌드 후 적용하는 경로를 사용한다.

- Cloud 작업의 기본 소스 트리는 `/root/work/ablestack-cloud`다.
  반복 Git/Maven/UI 빌드·테스트는 `/mnt/c` 대신 WSL ext4에서 수행한다.
- 로컬 베이스를 upstream과 동기화한 뒤 작업 브랜치에서 구현·커밋한다.
  origin 작업 브랜치에만 push하고 upstream 반영은 PR을 사용한다.
- backend는 필요한 Maven 모듈과 의존 모듈(`-pl ... -am`)을 빌드하고,
  변경 계약을 검증하는 집중 테스트를 실행한다.
- UI 변경이 있을 때는 해당 UI 테스트·lint·production build를 실행한다.
  변경되지 않은 전체 Cloud/SystemVM/RPM을 검증 준비 목적으로 반복 재빌드하지 않는다.
- 실제 시험 서버의 실행 JDK·클래스/API·의존성을 확인한다.
  기존 런타임과 호환되는 변경 클래스 또는 변경 모듈만 백업 후 적용한다.
- 공유 환경에서는 새 브랜치의 전체 JAR를 무조건 교체하지 않는다.
  특히 host agent는 기존 런타임과 맞는 필수 클래스만 반영하거나,
  더 넓은 패키지 교체가 필요한 이유와 승인 범위를 먼저 확인한다.
- 소스 SHA·작업 트리 차이·빌드 명령/결과·산출물 및 클래스 hash·백업/복구 경로·
  적용 후 서비스/실제 UI 검증·한계를 기록한다.
- 동기 요청 접수·async job 성공·DB 관계·실제 데이터 보존의 증거를 구분한다.
  소프트웨어 시험을 실물 HSM/스토리지 검증 성공으로 확대하지 않는다.
- API/SSH/DB/PIN 등 비밀값은 런타임 입력 또는 운영자가 제공한 보호 파일을 사용하고,
  소스·스크립트·보고서·명령 로그에 저장하지 않는다.

개발·집중 검증 산출물은 **시험용**이며 GitHub Actions 또는 GitHub Release 게시가 필수는 아니다.
시험을 위해 개발용 Release를 별도로 사용한 경우에는 해당 시험의 임시 Release/tag/asset만
검증 후 정리한다. 관련 없는 기존 릴리즈를 지우지 않는다.

## 적용 및 복구

1. 소스/실행 환경과 대상 자원을 고정하고 변경 전 상태·파일 hash를 확인한다.
2. 변경 범위의 WSL 집중 테스트와 클래스/모듈 빌드를 수행한다.
3. 기존 배포 파일을 백업하고 호환성을 확인한 변경물만 적용한다.
4. 필요한 서비스만 재시작하고 API·실제 UI·변경 데이터의 정합성을 검증한다.
5. 실패 시 검증한 백업으로 복원한다. DB 변경이 있다면 정확한 table/column·독립 migration과
   별도의 복구 절차를 명시한다.
6. 시험 자원만 정리하고 기존 키·볼륨·VM·설정의 보존을 확인한다.
7. 검증 증거를 이슈/PR에 반영한다. 로컬 집중 검증과 전체 CI 결과는 별도로 보고한다.

## 문서 우선순위

명시적인 사용자 승인·요구사항을 우선한다. 그 범위 안에서 이 문서, 실제 workflow 정의,
기타 검증 문서 순으로 적용한다. 릴리즈 빌드의 Actions 필수 규칙과 개발 빌드의 WSL 경로를
서로 혼동하지 않는다.
