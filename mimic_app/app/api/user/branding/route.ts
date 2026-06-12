import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';

const DEFAULTS = {
  logo_url: null as string | null,
  primary_color: '#4F46E5',
  company_name: null as string | null,
  footer_text: null as string | null,
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('mm_branding')
    .select('logo_url, primary_color, company_name, footer_text')
    .eq('user_id', auth.userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? DEFAULTS);
}

const updateSchema = z.object({
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '색상은 #RRGGBB 형식이어야 합니다.'),
  company_name: z.string().max(50).nullable(),
  footer_text: z.string().max(100).nullable(),
});

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('mm_branding')
    .upsert({
      user_id: auth.userId,
      primary_color: parsed.data.primary_color,
      company_name: parsed.data.company_name?.trim() || null,
      footer_text: parsed.data.footer_text?.trim() || null,
      updated_at: new Date().toISOString(),
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg'];

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('logo') as File | null;
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: '파일 크기는 2MB 이하여야 합니다.' }, { status: 400 });
  }
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'PNG 또는 JPG 이미지만 업로드할 수 있습니다.' }, { status: 400 });
  }

  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `${auth.userId}/logo.${ext}`;
  const supabase = createServiceRoleClient();

  const { error: uploadError } = await supabase.storage
    .from('branding')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from('branding').getPublicUrl(path);
  // 캐시 무효화를 위해 timestamp 쿼리 추가
  const logoUrl = `${publicUrl}?t=${Date.now()}`;

  const { error: dbError } = await supabase
    .from('mm_branding')
    .upsert({ user_id: auth.userId, logo_url: logoUrl, updated_at: new Date().toISOString() });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ logo_url: logoUrl });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('mm_branding')
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq('user_id', auth.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
