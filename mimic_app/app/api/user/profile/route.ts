import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
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

  const allowedTypes: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const ext = allowedTypes[file.type];
  if (!ext) return NextResponse.json({ error: 'JPG, PNG, WebP 이미지만 업로드할 수 있습니다.' }, { status: 400 });
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
  const isPng = signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4e && signature[3] === 0x47;
  const isWebp = signature[0] === 0x52 && signature[1] === 0x49
    && signature[2] === 0x46 && signature[3] === 0x46
    && signature[8] === 0x57 && signature[9] === 0x45
    && signature[10] === 0x42 && signature[11] === 0x50;
  if ((ext === 'jpg' && !isJpeg) || (ext === 'png' && !isPng) || (ext === 'webp' && !isWebp)) {
    return NextResponse.json({ error: '이미지 파일 형식이 올바르지 않습니다.' }, { status: 400 });
  }
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
