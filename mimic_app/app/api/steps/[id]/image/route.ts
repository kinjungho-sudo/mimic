import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardStepAccess } from '@/lib/auth/workspace-guard';
import { logServer } from '@/lib/logging/logger-server';

type Params = { params: Promise<{ id: string }> };

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

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
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `manual-captures/${auth.userId}/${id}_${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('naviaction')
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    await logServer('error', 'step.image.upload.fail', { stepId: id, userId: auth.userId, message: uploadError.message });
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from('naviaction').getPublicUrl(path);
  const update = {
    screenshot_url: publicUrl,
    step_type: 'visual_overlay_step',
    capture_source: 'manual',
    capture_failure_reason: null,
    click_x: null,
    click_y: null,
    element_rect: null,
    element_selector: null,
    element_xpath: null,
    follow_config: { kind: 'none' },
  };

  let { error: updateError } = await supabase
    .from('mm_steps')
    .update(update)
    .eq('id', id);

  if (updateError && (updateError.code === '42703' || /step_type|capture_source|capture_failure_reason/i.test(updateError.message))) {
    const legacyUpdate = {
      screenshot_url: publicUrl,
      click_x: null,
      click_y: null,
      element_rect: null,
      element_selector: null,
      element_xpath: null,
      follow_config: { kind: 'none' },
    };
    const retry = await supabase
      .from('mm_steps')
      .update(legacyUpdate)
      .eq('id', id);
    updateError = retry.error;
  }

  if (updateError) {
    await logServer('error', 'step.image.update.fail', { stepId: id, userId: auth.userId, message: updateError.message });
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ screenshot_url: publicUrl, step_type: 'visual_overlay_step', capture_source: 'manual' });
}
