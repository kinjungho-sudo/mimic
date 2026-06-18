// MIMIC 트랜잭션 메일을 n8n 웹훅(Webhook → Gmail)으로 발송하는 공용 헬퍼.
// 웹훅은 받은 { to, subject, html } 을 그대로 Gmail로 보내는 범용 릴레이라,
// 공유메일·환영메일 등 모든 메일이 같은 웹훅을 재사용한다(워크플로우 1개로 충분).

import { logNetwork } from '@/lib/logging/logger-server';

const clean = (v?: string) => v?.replace(/^﻿/, '').trim() ?? '';

// 실패해도 throw 하지 않는다 — 호출부(가입 콜백 등)가 메일 때문에 막히지 않도록.
export async function sendMimicEmail(opts: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}): Promise<boolean> {
  const url = clean(process.env.N8N_SHARE_EMAIL_WEBHOOK_URL);
  if (!url) return false; // env 미설정 시 조용히 스킵
  const secret = clean(process.env.N8N_SHARE_EMAIL_SECRET);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(secret ? { 'x-mimic-secret': secret } : {}) },
      body: JSON.stringify({
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        fromName: opts.fromName ?? 'MIMIC',
        replyTo: 'kinjungho@gmail.com',
      }),
    });
    // 외부서비스(n8n) 연동 결과 — PII 회피 위해 수신주소는 도메인만 기록.
    const domain = opts.to.split('@')[1] ?? null;
    if (res.ok) logNetwork('email.send', { service: 'n8n', subject: opts.subject, domain });
    else logNetwork('email.send.fail', { service: 'n8n', subject: opts.subject, domain, status: res.status }, 'warn');
    return res.ok;
  } catch (e) {
    logNetwork('email.send.fail', { service: 'n8n', subject: opts.subject, reason: e instanceof Error ? e.message : 'fetch_error' }, 'warn');
    return false;
  }
}

// 관리자 뉴스레터 — 평문 본문을 브랜드 템플릿으로 감싼다(관리자가 HTML 몰라도 됨).
export function newsletterHtml(subject: string, bodyText: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paras = bodyText.split(/\n{2,}/).map(p =>
    `<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.75;">${esc(p).replace(/\n/g, '<br>')}</p>`
  ).join('');
  return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FA;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 40px;">
            <p style="margin:0;font-size:20px;font-weight:800;color:white;letter-spacing:-0.5px;">MIMIC</p>
            <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.7);">소식 · 업데이트</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <h1 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#111827;line-height:1.4;">${esc(subject)}</h1>
            ${paras}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 40px;border-top:1px solid #F3F4F6;text-align:center;">
            <p style="margin:0;font-size:11.5px;color:#9CA3AF;line-height:1.6;">
              MIMIC · AI 인터랙티브 매뉴얼 플랫폼<br>
              이 메일은 수신 동의하신 분께만 발송됩니다. 수신 거부는 설정 &gt; 이메일 수신 동의에서 변경할 수 있어요.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// 가입 환영 메일 HTML
export function welcomeEmailHtml(name?: string | null): string {
  const greet = name ? `${name}님, ` : '';
  return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FA;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:34px 40px;text-align:center;">
            <p style="margin:0;font-size:24px;font-weight:800;color:white;letter-spacing:-0.5px;">MIMIC</p>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Don't Explain, Just Mimic.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <h1 style="margin:0 0 14px;font-size:21px;font-weight:700;color:#111827;line-height:1.4;">${greet}MIMIC 가입을 환영해요 🎉</h1>
            <p style="margin:0 0 22px;font-size:15px;color:#4B5563;line-height:1.7;">
              이제 클릭 몇 번이면 업무 화면이 <b>단계별 인터랙티브 매뉴얼</b>로 완성됩니다.
              만든 매뉴얼은 링크로 공유하거나, 실제 화면 위에서 <b>라이브 가이드</b>로 안내할 수 있어요.
            </p>
            <table cellpadding="0" cellspacing="0"><tr><td>
              <a href="https://mimic-nine-ashen.vercel.app/home" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                지금 시작하기 →
              </a>
            </td></tr></table>
            <p style="margin:24px 0 0;font-size:13px;color:#9CA3AF;line-height:1.6;">
              궁금한 점은 이 메일에 회신해 주세요. 좋은 매뉴얼 만드시길 응원합니다!
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #F3F4F6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">MIMIC · AI 인터랙티브 매뉴얼 플랫폼</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
