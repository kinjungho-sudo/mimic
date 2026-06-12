import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { captureDiscardSchema } from '@/lib/validators';

// 녹화 중지(저장 없이) 시 staging 정리 — 세션의 mm_capture_events 행과
// Storage 이미지를 삭제한다. 호출이 누락돼도 cron 청소가 보완하는 best-effort 경로.

const BUCKET = 'naviaction';

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

  const parsed = captureDiscardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { session_id } = parsed.data;

  // 세션 소유자 확인
  const { data: session } = await supabase
    .from('mm_capture_sessions')
    .select('id, status')
    .eq('id', session_id)
    .eq('user_id', auth.userId)
    .single();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  // 이미 매뉴얼로 변환된 세션은 건드리지 않는다 (mm_steps가 이미지를 참조 중)
  if (session.status === 'completed') {
    return NextResponse.json({ error: 'Session already finalized' }, { status: 409 });
  }

  // Storage 폴더({session_id}/) → 이벤트 행 → 세션 상태 순으로 정리
  const { data: files } = await supabase.storage.from(BUCKET).list(session_id, { limit: 1000 });
  if (files?.length) {
    await supabase.storage.from(BUCKET).remove(files.map(f => `${session_id}/${f.name}`));
  }
  await supabase.from('mm_capture_events').delete().eq('session_id', session_id);
  await supabase
    .from('mm_capture_sessions')
    .update({ status: 'abandoned', ended_at: new Date().toISOString() })
    .eq('id', session_id);

  return NextResponse.json({ ok: true });
}
