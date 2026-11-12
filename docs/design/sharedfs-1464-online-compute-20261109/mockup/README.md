# #1464 설계 전용 Vue3·AntD·Mold 목업

실제 API 요청/VM 변경을 실행하지 않는다. 지원 완료·부분 반영은 합성 예시다.

~~~sh
NODE_OPTIONS=--openssl-legacy-provider node docs/design/sharedfs-1464-online-compute-20261109/mockup/build.cjs
python3 -m http.server 8804 --bind 127.0.0.1 --directory docs/design/sharedfs-1464-online-compute-20261109/mockup/public
~~~

http://localhost:8804/index.html?theme=dark&dialog=ready

- theme=light/dark
- dialog=create/blocked/ready/recovery (없으면 정보 상세)
- ready는사전점검→체크확인→제출순서를예시로표현한다. 목표축변경시기존승인을무효화한다.
- public/app.js는로컬생성물이며커밋하지않는다. 별도목업PR을생성하지않는다.
