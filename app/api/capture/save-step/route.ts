import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { captureSaveStepSchema } from '@/lib/validators';

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  // 토큰으로 user_id 조회
  const { data: tokenRow } = await supabase
    .from('mm_extension_tokens')
    .select('user_id')
    .eq('token', auth.token)
    .single();

  if (!tokenRow) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

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

  // mm_capture_events에 저장 (NA_steps 테이블 없음)
  const { data: sessionRow } = await supabase
    .from('mm_capture_sessions')
    .select('id')
    .eq('user_id', tokenRow.user_id)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (!sessionRow) {
    return NextResponse.json({ error: 'No active capture session' }, { status: 409 });
  }
  const sessionId = sessionRow.id;

  const { data: step, error } = await supabase
    .from('mm_capture_events')
    .insert({
      session_id: sessionId,
      screenshot_url: d.screenshot_url,
      click_x: Math.round(d.click_x * 10000),
      click_y: Math.round(d.click_y * 10000),
      url: d.url,
      element_text: d.title,
    })
    .select('id')
    .single();

  if (error) {
    console.error('save-step error:', error);
    return NextResponse.json({ error: 'Failed to save step' }, { status: 500 });
  }

  return NextResponse.json({ id: step.id, step_number: d.step_number });
}
