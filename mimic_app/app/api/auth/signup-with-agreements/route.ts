import { NextRequest, NextResponse } from 'next/server';
import { signupSchema } from '@/lib/validators';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendMimicEmail, welcomeEmailHtml } from '@/lib/email-n8n';

const INVISIBLE = new Set([0x00AD, 0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0xFEFF]);

function sanitize(s: string): string {
  return s.split('').filter(c => !INVISIBLE.has(c.charCodeAt(0))).join('').trim();
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, agreements } = parsed.data;
  const email = sanitize(parsed.data.email);
  const password = sanitize(parsed.data.password);

  const serviceClient = createServiceRoleClient();

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    user_metadata: { name },
    email_confirm: false,
  });

  if (error) {
    console.error('[signup] supabase error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.user) {
    await serviceClient
      .from('mm_users')
      .update({
        name,
        agreements: {
          ...agreements,
          agreed_at: new Date().toISOString(),
        },
      })
      .eq('id', data.user.id);

    // 환영 이메일 발송 (n8n → Gmail, 실패해도 가입 자체는 성공 처리)
    sendMimicEmail({ to: email, subject: 'MIMIC 가입을 환영해요 🎉', html: welcomeEmailHtml(name) })
      .catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
