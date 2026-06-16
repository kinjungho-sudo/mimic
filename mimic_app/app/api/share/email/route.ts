import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-guard';

const schema = z.object({
  to: z.string().email('올바른 이메일 주소를 입력해주세요.'),
  tutorialTitle: z.string().min(1).max(200),
  shareUrl: z.string().url(),
  senderName: z.string().max(50).optional(),
});

const clean = (v: string | undefined) => v?.replace(/^﻿/, '').trim() ?? '';

// 공유 메일은 n8n 워크플로우(Webhook → Gmail 노드)로 발송한다.
// Resend는 인증 도메인이 없어 보류 — n8n Gmail 노드는 사용자 Gmail 계정으로 인증하므로 도메인 불필요.
// 앱은 완성된 HTML을 웹훅으로 넘기고, n8n은 받은 그대로 전송하는 얇은 릴레이 역할.
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '입력값 오류' }, { status: 400 });
  }

  const { to, tutorialTitle, shareUrl, senderName } = parsed.data;

  const webhookUrl = clean(process.env.N8N_SHARE_EMAIL_WEBHOOK_URL);
  if (!webhookUrl) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  const subject = `[MIMIC] ${tutorialTitle}`;
  const fromName = senderName ? `${senderName} via MIMIC` : 'MIMIC';
  const safeTitle = tutorialTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FA;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- 헤더 -->
        <tr>
          <td style="background:linear-gradient(135deg,#3730a3,#6d28d9);padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:800;color:white;letter-spacing:-0.5px;">MIMIC</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">Don't Explain, Just Mimic.</p>
          </td>
        </tr>
        <!-- 본문 -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">매뉴얼을 공유받으셨어요</p>
            <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#111827;line-height:1.4;">${safeTitle}</h1>
            <p style="margin:0 0 28px;font-size:15px;color:#4B5563;line-height:1.6;">
              아래 버튼을 클릭하면 단계별 인터랙티브 매뉴얼을 바로 확인할 수 있어요.
            </p>
            <table cellpadding="0" cellspacing="0"><tr><td>
              <a href="${shareUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#3730a3,#6d28d9);color:white;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:-0.2px;">
                매뉴얼 보러 가기 →
              </a>
            </td></tr></table>
            <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;">
              또는 이 링크를 브라우저에 복사하세요:<br>
              <a href="${shareUrl}" style="color:#3730a3;word-break:break-all;">${shareUrl}</a>
            </p>
          </td>
        </tr>
        <!-- 푸터 -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #F3F4F6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">
              MIMIC · AI 인터랙티브 매뉴얼 플랫폼
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // n8n 웹훅으로 발송 위임 (선택적 공유 시크릿 헤더로 무단 호출 방지)
  const secret = clean(process.env.N8N_SHARE_EMAIL_SECRET);
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(secret ? { 'x-mimic-secret': secret } : {}) },
      body: JSON.stringify({ to, subject, html, fromName, replyTo: 'kinjungho@gmail.com' }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[share/email] n8n webhook error:', res.status, body);
      return NextResponse.json({ error: `n8n ${res.status}: ${body.slice(0, 200)}` }, { status: 500 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[share/email] n8n webhook fetch failed:', msg);
    return NextResponse.json({ error: `fetch failed: ${msg}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
