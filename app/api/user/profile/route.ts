import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('avatar') as File | null;
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: '파일 크기는 2MB 이하여야 합니다.' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${auth.userId}/avatar.${ext}`;
  const supabase = createServiceRoleClient();

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
  // 캐시 무효화를 위해 timestamp 쿼리 추가
  const avatarUrl = `${publicUrl}?t=${Date.now()}`;

  const { error: dbError } = await supabase
    .from('mm_users')
    .update({ avatar_url: avatarUrl })
    .eq('id', auth.userId);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ avatar_url: avatarUrl });
}

const updateSchema = z.object({
  name: z.string().min(1).max(50),
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
    return NextResponse.json({ error: '이름은 1~50자 이내여야 합니다.' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('mm_users')
    .update({ name: parsed.data.name })
    .eq('id', auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
