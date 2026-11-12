# 확인용 자원

네트워크·VM·LB·VPN 사용자·인증서를 삭제하지 않았다. 양쪽 프로젝트 `qa-gn1569-{31,32}-shared-reg`의 Public IP → 부하 분산 → backend-tls-review → 설정 → 세션 고정에서 확인한다.

| 항목 | 31 GFS2 | 32 Glue RBD |
|---|---|---|
| 프로젝트 | 59614883-4085-4a76-99da-b8a1e3a78eed | cf5ec6b5-b522-4c18-ab90-a395012607c1 |
| 네트워크 | qa-gn1569-31-vpn-lb | qa-gn1569-32-vpn-lb |
| VM | qa-gn1569-31-vpn-lb-vm | qa-gn1569-32-vpn-lb-vm |
| 게스트 IP | 10.234.31.6 | 10.234.32.227 |
| 현재 VR | r-1024-VM | r-499-VM |
| 동일 호스트 | ablecube31-3 | ablecube32-2 |
| TLS VIP | 10.10.31.149:19111 | 10.10.32.177:19111 |
| LB | qa-gn1569-31-backend-tls-review | qa-gn1569-32-backend-tls-review |
| 확인 정책 | qa-gn1625-31-review-api-false | qa-gn1625-32-review-api-false |

최종 AppCookie: cookie-name=QA_SESSION, length=32, holdtime=3h, request-learn=false. UI에서 요청 학습은 체크되지 않는다. 기존 원래 인증서와 네트워크 오퍼링으로 복원했다. 전용 CA/체인 인증서는 보관되며 현재 LB에 할당하지 않는다. 원래 TCP 정책과 인바운드 방화벽도 복원했다.

백엔드 시험 서비스는 기존18443/TLS·원래 본문을 유지하고 응답에 QA_SESSION 쿠키를 추가했다. 시험 설정/개인키/계정 비밀번호와 DB/배포 백업은 비공개 작업 디렉터리에 보관하며 이 문서에는 포함하지 않는다.

[자원 보존31](evidence/31-resource-preservation.json) · [자원 보존32](evidence/32-resource-preservation.json)
