import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardStepAccess } from '@/lib/auth/workspace-guard';
import { logServer } from '@/lib/logging/logger-server';

type Params = { params: Promise<{ id: string }> };

// POST: 클라이언트에서 픽셀화한 이미지(multipart, field "file")를 받아 영구 반영.
//  - 최초 1회 원본 screenshot_url을 original_screenshot_url에 백업
//  - 새 파일을 고유 경로로 업로드 후 screenshot_url 갱신 (경로가 유니크 → 캐시 무효)
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const guard = await guardStepAccess(id, auth.userId, 'editor');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
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
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: step } = await supabase
    .from('mm_steps')
    .select('id, screenshot_url, original_screenshot_url')
    .eq('id', id)
    .single();

  if (!step) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const path = `blurred/${auth.userId}/${id}_${Date.now()}.jpg`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('naviaction')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) {
    await logServer('error', 'step.blur.upload.fail', { stepId: id, userId: auth.userId, message: uploadError.message });
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from('naviaction').getPublicUrl(path);

  // 최초 블러일 때만 원본 백업 (이미 블러된 이미지를 백업으로 덮어쓰지 않도록)
  const update: Record<string, string> = { screenshot_url: publicUrl };
  if (!step.original_screenshot_url) {
    update.original_screenshot_url = step.screenshot_url;
  }

  const { error: updErr } = await supabase
    .from('mm_steps')
    .update(update)
    .eq('id', id);

  if (updErr) {
    await logServer('error', 'step.blur.update.fail', { stepId: id, userId: auth.userId, message: updErr.message });
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({
    screenshot_url: publicUrl,
    original_screenshot_url: step.original_screenshot_url ?? step.screenshot_url,
  });
}

// DELETE: 블러 되돌리기 — screenshot_url을 백업된 원본으로 복원.
//  original_screenshot_url은 유지(재블러 가능). 원본이 없으면(블러 이력 없음) no-op.
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const guard = await guardStepAccess(id, auth.userId, 'editor');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createServiceRoleClient();

  const { data: step } = await supabase
    .from('mm_steps')
    .select('id, screenshot_url, original_screenshot_url')
    .eq('id', id)
    .single();

  if (!step) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!step.original_screenshot_url) {
    return NextResponse.json({ error: '되돌릴 원본이 없습니다' }, { status: 400 });
  }

  const { error: updErr } = await supabase
    .from('mm_steps')
    .update({ screenshot_url: step.original_screenshot_url })
    .eq('id', id);

  if (updErr) {
    return NextResponse.json({ error: 'Revert failed' }, { status: 500 });
  }

  return NextResponse.json({ screenshot_url: step.original_screenshot_url });
}
