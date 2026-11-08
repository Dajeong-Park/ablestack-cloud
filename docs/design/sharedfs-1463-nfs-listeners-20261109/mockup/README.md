# #1463 설계 전용 목업

Vue3/AntD는 저장소 ui/node_modules를 사용한다. 실제 Mold Breadcrumb/ResourceLayout/MoldDialog/StorageNfsIdentityPanel 및 style/index.less를 import한다. 제품 API는 호출하지 않는다. 네트워크·서비스·DATA를 변경하지 않는다. 별칭/IPv6/실패 상태는 합성 예시다.

저장소 루트:
~~~sh
NODE_OPTIONS=--openssl-legacy-provider node docs/design/sharedfs-1463-nfs-listeners-20261109/mockup/build.cjs
python3 -m http.server 8803 --bind 127.0.0.1 --directory docs/design/sharedfs-1463-nfs-listeners-20261109/mockup/public
~~~

http://localhost:8803/index.html?theme=dark&wide=1

- theme=light/dark
- wide=1 (기본 정보카드 숨김, 세로탭 유지)
- scenario=fresh/partial/stale/unavailable
- dialog=1 (조회 상세)

공통 컴포넌트 간격과 긴주소/표내부 가로스크롤, 모달 고정 헤더/푸터·본문스크롤을 브라우저로 확인했다. public/app.js는 로컬 생성물이므로 커밋하지 않는다. 이미지 A는 현재배포화면, S는 VM표준, B는 이개선목업으로 구분한다.
