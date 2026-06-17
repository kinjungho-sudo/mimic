import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

// POST: 썸네일 이미지 업로드 (multipart/form-data, field: "file")
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();

  // 튜토리얼 소유자 확인
  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single();

  if (!tutorial) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field required' }, { status: 400 });
  }

  // 5MB 제한
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const path = `thumbnails/${auth.userId}/${id}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('naviaction')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from('naviaction')
    .getPublicUrl(path);

  // thumbnail_url 저장
  await supabase
    .from('mm_tutorials')
    .update({ thumbnail_url: publicUrl })
    .eq('id', id);

  return NextResponse.json({ thumbnail_url: publicUrl });
}

// DELETE: 썸네일 제거
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, thumbnail_url')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single();

  if (!tutorial) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Storage 파일 삭제 시도 (실패해도 DB는 null 처리)
  if (tutorial.thumbnail_url) {
    const match = tutorial.thumbnail_url.match(/naviaction\/(.+)$/);
    if (match) {
      await supabase.storage.from('naviaction').remove([match[1]]);
    }
  }

  await supabase
    .from('mm_tutorials')
    .update({ thumbnail_url: null })
    .eq('id', id);

  return new NextResponse(null, { status: 204 });
}
