import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendMimicEmail, newsletterHtml } from '@/lib/email-n8n';
import { z } from 'zod';

const schema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  test: z.boolean().optional(),  // true면 관리자 본인에게만 1통(미리보기)
});

// GET — 수신 동의자 수 (작성 화면에서 표시)
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const service = createServiceRoleClient();
  const { count } = await service
    .from('mm_users')
    .select('id', { count: 'exact', head: true })
    .eq('agreements->>marketing', 'true')
    .not('email', 'is', null);

  return NextResponse.json({ consenting: count ?? 0 });
}

// POST — 동의자 전체에게 뉴스레터 발송(또는 test=관리자 본인 미리보기)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '제목/본문을 확인해주세요.' }, { status: 400 });

  const { subject, body: text, test } = parsed.data;
  const html = newsletterHtml(subject, text);

  // 미리보기: 관리자 본인에게만 1통
  if (test) {
    const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim();
    const ok = await sendMimicEmail({ to: adminEmail, subject: `[미리보기] ${subject}`, html });
    return NextResponse.json({ test: true, sent: ok ? 1 : 0, to: adminEmail });
  }

  // 수신 동의자 조회
  const service = createServiceRoleClient();
  const { data: rows } = await service
    .from('mm_users')
    .select('email')
    .eq('agreements->>marketing', 'true')
    .not('email', 'is', null);

  const emails = Array.from(new Set((rows ?? []).map(r => r.email as string).filter(Boolean)));

  // n8n 웹훅이 즉시응답(onReceived)이라 순차 발송도 빠름. Gmail 일일 한도 주의.
  let sent = 0, failed = 0;
  for (const to of emails) {
    const ok = await sendMimicEmail({ to, subject, html });
    if (ok) sent++; else failed++;
  }

  return NextResponse.json({ total: emails.length, sent, failed });
}
