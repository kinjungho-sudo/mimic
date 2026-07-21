import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { guardStepAccess } from '@/lib/auth/workspace-guard';
import { logServer } from '@/lib/logging/logger-server';
import { logActivity } from '@/lib/activity';

const stepPatchSchema = z.object({
  user_title: z.string().max(200).nullable().optional(),
  user_script: z.string().max(2000).nullable().optional(),
  image_alt_text: z.string().max(500).nullable().optional(),
  title_font_size: z.number().int().min(10).max(48).nullable().optional(),
  user_annotations: z.array(z.unknown()).nullable().optional(),
  image_zoom: z.number().min(0.5).max(4).nullable().optional(),
  image_offset_x: z.number().min(-1.5).max(1.5).nullable().optional(),
  image_offset_y: z.number().min(-1.5).max(1.5).nullable().optional(),
  domain_name: z.string().max(100).nullable().optional(),
  domain_hostname: z.string().max(255).nullable().optional(),
  // 따라하기 스튜디오 저작 데이터 (null=자동추론)
  page_url: z.string().url().nullable().optional(),
  element_selector: z.string().max(500).nullable().optional(),
  element_xpath: z.string().max(500).nullable().optional(),
  element_rect: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  }).nullable().optional(),
  target_context: z.record(z.string(), z.unknown()).nullable().optional(),
  click_x: z.number().min(0).max(1).nullable().optional(),
  click_y: z.number().min(0).max(1).nullable().optional(),
  follow_config: z.object({
    hotspotX: z.number().min(0).max(100).nullable().optional(),
    hotspotY: z.number().min(0).max(100).nullable().optional(),
    kind: z.enum(['click', 'type', 'none']).nullable().optional(),
    typeText: z.string().max(500).nullable().optional(),
    typeInputMode: z.enum(['copy', 'auto']).nullable().optional(),
    typeBoxWidth: z.number().int().min(120).max(520).nullable().optional(),
    typeBoxHeight: z.number().int().min(32).max(96).nullable().optional(),
    hidden: z.boolean().optional(),
    bubbleAnchor: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).nullable().optional(),
    zoomAnim: z.boolean().optional(),
  }).nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = stepPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // 워크스페이스 역할 체크 (개인이면 소유자, 워크스페이스면 editor 이상)
  const guard = await guardStepAccess(id, auth.userId, 'editor');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('mm_steps')
    .update(parsed.data)
    .eq('id', id)
    .select('id, tutorial_id, user_title, user_script, image_alt_text, user_annotations, follow_config, page_url, element_selector, element_xpath, element_rect, target_context, click_x, click_y')
    .single();

  if (error || !data) {
    await logServer('error', 'step.update.fail', { stepId: id, userId: auth.userId, message: error?.message });
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  // 이미지 편집(어노테이션 변경)은 활동 로그에 기록
  if (parsed.data.user_annotations !== undefined) {
    await logActivity({
      tutorialId: data.tutorial_id,
      actorId: auth.userId,
      action: 'annotation_edited',
      stepId: id,
    });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // 스텝 삭제는 editor 이상 허용
  const guard = await guardStepAccess(id, auth.userId, 'editor');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createServiceRoleClient();
  // 삭제 전 단계 정보 확보 — 삭제 후엔 step_id 조인이 끊기므로 step_number를 meta에 남긴다
  const { data: stepRow } = await supabase
    .from('mm_steps').select('tutorial_id, step_number').eq('id', id).single();

  const { error } = await supabase.from('mm_steps').delete().eq('id', id);
  if (error) {
    await logServer('error', 'step.delete.fail', { stepId: id, userId: auth.userId, message: error.message });
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  if (stepRow?.tutorial_id) {
    await logActivity({
      tutorialId: stepRow.tutorial_id,
      actorId: auth.userId,
      action: 'step_deleted',
      meta: { step_number: stepRow.step_number },
    });
  }

  return new NextResponse(null, { status: 204 });
}
