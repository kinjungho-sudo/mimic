import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { captureSaveStepSchema } from '@/lib/validators';
import { redactSensitive } from '@/lib/redact';
import { logServer } from '@/lib/logging/logger-server';

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = captureSaveStepSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  // session_id로 기존 세션 조회, 없으면 자동 생성
  let sessionId: string = d.session_id;
  const { data: existingSession } = await supabase
    .from('mm_capture_sessions')
    .select('id, status')
    .eq('id', d.session_id)
    .eq('user_id', auth.userId)
    .single();

  if (!existingSession) {
    // 세션이 없으면 자동 생성 (recorder가 start API를 호출하지 않는 경우)
    const { data: newSession, error: sessionError } = await supabase
      .from('mm_capture_sessions')
      .insert({ id: d.session_id, user_id: auth.userId, status: 'active' })
      .select('id')
      .single();

    if (sessionError || !newSession) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }
    sessionId = newSession.id;
  } else if (existingSession.status === 'done') {
    return NextResponse.json({ error: 'Session already finalized' }, { status: 409 });
  }

  // element_rect: recorder가 이미 0~1로 정규화해서 전송 — 서버에서 추가 변환 없이 그대로 저장
  const elementRectNormalized = d.element_rect ?? null;

  const row = {
    screenshot_url: d.screenshot_url,
    // click_x/y: recorder가 0~1로 전송, DB는 0~10000 정수로 저장 (editor에서 /100으로 읽어 0~100%)
    click_x: Math.round(d.click_x * 10000),
    click_y: Math.round(d.click_y * 10000),
    url: d.url,
    element_text: redactSensitive(d.title),
    ai_title: redactSensitive(d.title) || null,
    ai_description: redactSensitive(d.description) || null,
    domain_hostname:   d.domain_hostname   ?? null,
    domain_name:       d.domain_name       ?? null,
    domain_favicon:    d.domain_favicon    ?? null,
    element_rect:      elementRectNormalized,
    element_selector:  d.element_selector  ?? null,
    element_xpath:     d.element_xpath     ?? null,
    audio_offset_ms:   d.audio_offset_ms   ?? null,
    // Recorder가 캡처 시 결정한 확대 영역(원본 0~1) — finalize에서 image_zoom 프레이밍으로 사용
    crop_box:          d.crop_box          ?? null,
    // type 액션에서 실제 입력된 텍스트 — finalize에서 mm_steps.type_text로 전파
    type_text:         d.type_text         ?? null,
  };

  // 같은 (session, step_number) 행이 있으면 갱신 — 타이핑 디바운스 overwrite 캡처가
  // flush마다 새 행을 쌓지 않게 한다 (한 입력 = mm_capture_events 한 행).
  const { data: existing } = await supabase
    .from('mm_capture_events')
    .select('id')
    .eq('session_id', sessionId)
    .eq('step_number', d.step_number)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error: updateError } = await supabase
      .from('mm_capture_events')
      .update(row)
      .eq('id', existing.id);

    if (updateError) {
      await logServer('error', 'capture.saveStep.updateFail', { sessionId, stepNumber: d.step_number, message: updateError.message });
      return NextResponse.json({ error: 'Failed to save step' }, { status: 500 });
    }
    return NextResponse.json({ id: existing.id, step_number: d.step_number });
  }

  const { data: step, error } = await supabase
    .from('mm_capture_events')
    .insert({ session_id: sessionId, step_number: d.step_number, ...row })
    .select('id')
    .single();

  if (error) {
    console.error('save-step error:', error);
    return NextResponse.json({ error: 'Failed to save step' }, { status: 500 });
  }

  return NextResponse.json({ id: step.id, step_number: d.step_number });
}
