# #1466 설계 목업

합성 데이터만 사용하는 Vue3·Ant Design Vue 목업이다. 실제 Mold Breadcrumb.vue, ResourceLayout.vue, MoldDialog.vue, MoldDialogActions.vue 및 공통 theme/style을 import한다. 제품 API·AD 인증을 호출하지 않는다.

저장소 루트에서 로컬 실행한다.

```sh
NODE_OPTIONS=--openssl-legacy-provider node docs/design/sharedfs-1466-ad-service-names-20261110/mockup/build.cjs
python3 -m http.server 8806 --bind 127.0.0.1 --directory docs/design/sharedfs-1466-ad-service-names-20261110/mockup/public
```

- 목록: `http://localhost:8806/index.html?theme=light` / `?theme=dark`
- 대화상자: `dialog=create|blocked|delete|join|recovery|detail`
- 점검/부분 실패 예시: `preview=1`
- 실제 화면A와 개선 목업B를 구분한다. S는 현재 VM 표준 비교다.
- 생성한 app.js와 public/index.html은 Git에 포함하지 않는다. 소스로 재빌드한다.
- 필드 간격16px, 버튼8px, 왼쪽 파란 주 버튼, 세로 탭, readonly 상세, 고정 modal header/footer와 본문 스크롤을 사용한다.
- 모달은 실제 처리하지 않는다. 체크박스 미확인·충돌 상태의 적용 비활성, 가입/이름 단계 분리·복구 동선은 합성 예시다.
