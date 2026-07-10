# 공유 메일 — n8n 워크플로우 설정 가이드

Parro 공유 메일을 **n8n(Webhook → Gmail)** 으로 발송한다.
Resend는 인증 도메인이 없어 보류. n8n의 Gmail 노드는 **본인 Gmail 계정으로 OAuth 인증**하므로 도메인이 필요 없다.

## 흐름
```
앱(/api/share/email)  ──POST(JSON)──▶  n8n Webhook  ──▶  Gmail 노드(발송)
payload: { to, subject, html, fromName, replyTo }
```
앱은 완성된 HTML을 넘기고, n8n은 받은 그대로 Gmail로 전송하는 얇은 릴레이.

## 설정 순서
1. **n8n 준비** — [n8n.cloud](https://n8n.io) 가입(가장 빠름) 또는 self-host(`docker run -p 5678:5678 n8nio/n8n`).
2. **워크플로우 임포트** — 아래 JSON을 복사 → n8n 우상단 `⋯ > Import from clipboard`.
3. **Gmail 노드 인증** — Gmail 노드 열기 → Credential `+` → Google OAuth2 로그인(kinjungho@gmail.com). (n8n.cloud는 기본 OAuth 제공, self-host는 Google Cloud OAuth 클라이언트 필요.)
4. **(선택) 시크릿 검증** — 무단 호출 방지. 워크플로우에 IF 노드 추가해 헤더 `x-mimic-secret`이 `N8N_SHARE_EMAIL_SECRET`과 같은지 확인. 안 쓰면 생략 가능.
5. **워크플로우 Active 토글 ON** → Webhook 노드의 **Production URL** 복사 (예: `https://<your>.app.n8n.cloud/webhook/mimic-share-email`).
6. **Vercel 환경변수 설정**:
   - `N8N_SHARE_EMAIL_WEBHOOK_URL` = 복사한 Production URL
   - (선택) `N8N_SHARE_EMAIL_SECRET` = 임의 문자열 (n8n IF 노드와 동일하게)
   설정 후 **재배포**해야 반영됨.
7. **검증** — 공유 모달 > 이메일 탭에서 본인 주소로 발송 → 수신 확인.

> ⚠️ Gmail 발송 한도(개인 ~500/일)·스팸 분류 위험 있음. 대량/정식 운영 시엔 결국 전용 발신 도메인(Resend 등) 권장.

## 임포트용 워크플로우 JSON
> Gmail 노드 파라미터명은 n8n 버전에 따라 다를 수 있음. 임포트 후 Gmail 노드에서
> **To=`{{ $json.body.to }}`, Subject=`{{ $json.body.subject }}`, Email Type=HTML,
> Message=`{{ $json.body.html }}`, Options>Sender Name=`{{ $json.body.fromName }}`,
> Options>Reply To=`{{ $json.body.replyTo }}`** 로 매핑됐는지 확인할 것.

```json
{
  "name": "Parro Share Email",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "mimic-share-email",
        "responseMode": "lastNode",
        "options": {}
      },
      "id": "webhook-node",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [260, 300],
      "webhookId": "mimic-share-email"
    },
    {
      "parameters": {
        "resource": "message",
        "operation": "send",
        "sendTo": "={{ $json.body.to }}",
        "subject": "={{ $json.body.subject }}",
        "emailType": "html",
        "message": "={{ $json.body.html }}",
        "options": {
          "senderName": "={{ $json.body.fromName }}",
          "replyTo": "={{ $json.body.replyTo }}"
        }
      },
      "id": "gmail-node",
      "name": "Gmail",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2,
      "position": [520, 300]
    }
  ],
  "connections": {
    "Webhook": { "main": [[{ "node": "Gmail", "type": "main", "index": 0 }]] }
  },
  "settings": {}
}
```

## 앱 측 (이미 구현됨)
- `app/api/share/email/route.ts` — `N8N_SHARE_EMAIL_WEBHOOK_URL` 미설정 시 503, 설정 시 위 payload로 POST.
- env 미설정 상태에서는 공유 메일이 "Email service not configured"로 안전 실패(앱 다른 기능 영향 없음).
