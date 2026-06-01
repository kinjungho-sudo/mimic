import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { captureSaveStepSchema } from '@/lib/validators';
import { redactSensitive } from '@/lib/redact';

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

  const { data: step, error } = await supabase
    .from('mm_capture_events')
    .insert({
      session_id: sessionId,
      screenshot_url: d.screenshot_url,
      click_x: Math.round(d.click_x * 10000),
      click_y: Math.round(d.click_y * 10000),
      url: d.url,
      element_text: redactSensitive(d.title),
      ai_title: redactSensitive(d.title) || null,
      ai_description: redactSensitive(d.description) || null,
      domain_hostname: d.domain_hostname ?? null,
      domain_name:     d.domain_name     ?? null,
      domain_favicon:  d.domain_favicon  ?? null,
      viewport_w:        d.viewport_w        ?? null,
      viewport_h:        d.viewport_h        ?? null,
      element_selector:  d.element_selector  ?? null,
      element_xpath:     d.element_xpath     ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('save-step error:', error);
    return NextResponse.json({ error: 'Failed to save step' }, { status: 500 });
  }

  return NextResponse.json({ id: step.id, step_number: d.step_number });
}
