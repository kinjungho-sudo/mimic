import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendMimicEmail } from '@/lib/email/email-n8n';
import { BRAND_NAME } from '@/lib/brand';

const schema = z.object({
  message: z.string().min(5).max(10000),
  category: z.enum(['일반 문의', '버그 신고', '기능 요청']).default('일반 문의'),
  userEmail: z.string().email().optional(),
});

const categoryEmoji: Record<string, string> = {
  '일반 문의': '💬',
  '버그 신고': '🐛',
  '기능 요청': '✨',
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '문의 내용을 5자 이상 입력해주세요.' }, { status: 400 });
  }

  const { message, category, userEmail } = parsed.data;
  const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim();
  if (!adminEmail) {
    return NextResponse.json({ error: 'Admin email not configured' }, { status: 503 });
  }

  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const emoji = categoryEmoji[category] ?? '💬';
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FA;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#3730a3,#6d28d9);padding:24px 40px;">
            <p style="margin:0;font-size:18px;font-weight:800;color:white;">${emoji} ${BRAND_NAME} 사용자 문의 — ${category}</p>
            <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.7);">${now}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px;">
            ${userEmail ? `<p style="margin:0 0 12px;font-size:13px;color:#6B7280;">보낸 사람: <strong style="color:#111827;">${userEmail}</strong></p>` : ''}
            <p style="margin:0 0 16px;font-size:13px;color:#6B7280;">챗봇을 통해 접수된 <strong>${category}</strong>입니다.</p>
            <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px 20px;">
              <p style="margin:0;font-size:14px;color:#111827;line-height:1.8;white-space:pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px;border-top:1px solid #F3F4F6;">
            <p style="margin:0;font-size:11.5px;color:#9CA3AF;">${BRAND_NAME} Admin — ${userEmail ? `답변: ${userEmail}로 보내주세요.` : '이 메일에 직접 회신하지 마세요.'}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const ok = await sendMimicEmail({
    to: adminEmail,
    subject: `[${BRAND_NAME} ${category}] ${userEmail ?? '비회원'} 문의가 접수되었습니다`,
    html,
    fromName: `${BRAND_NAME} 챗봇`,
  });

  if (!ok) return NextResponse.json({ error: '이메일 전송에 실패했습니다.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
