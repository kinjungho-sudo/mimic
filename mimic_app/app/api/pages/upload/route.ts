import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

const BUCKET = 'naviaction';
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

const ALLOWED_TYPES: Record<string, string> = {
  'image/png':  'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif':  'gif',
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });

  const file = formData.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  if (file.size > MAX_SIZE) return NextResponse.json({ error: '파일 크기 제한 20MB 초과' }, { status: 413 });

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: '허용되지 않는 파일 형식입니다 (png/jpg/webp/gif만 허용)' }, { status: 415 });

  const path = `playbook-uploads/${auth.userId}/${uuidv4()}.${ext}`;

  const bytes = await file.arrayBuffer();
  const supabase = createServiceRoleClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: publicUrl });
}
