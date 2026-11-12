# #1465 설계 목업

Vue3·Ant Design Vue와 기존 Mold Breadcrumb, ResourceLayout, MoldDialog, MoldDialogActions, 공통 theme 토큰을 사용한다. 모든 데이터와 판정은 합성 예시다.

저장소 루트에서 실행한다.

```sh
NODE_OPTIONS=--openssl-legacy-provider node docs/design/sharedfs-1465-posix-acl-20261109/mockup/build.cjs
python3 -m http.server 8805 --directory docs/design/sharedfs-1465-posix-acl-20261109/mockup/public
```

`http://localhost:8805/index.html?theme=light`와 `?theme=dark`에서 목록을 볼 수 있다. `dialog=edit|blocked|register|remove|clear`, `preview=1`을 추가하면 설계 상태를 직접 연다. generated app.js는 Git에서 제외한다.
