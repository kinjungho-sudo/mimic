import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logSystem } from '@/lib/logging/logger-server';

// 버려진 녹화 세션 청소 (안전망) — 브라우저 종료 등으로 discard 호출이 누락된
// 오래된 active 세션의 staging 데이터(mm_capture_events + Storage 이미지)를 삭제한다.
// vercel.json crons에서 매일 호출 (Vercel이 Authorization: Bearer ${CRON_SECRET} 자동 첨부)

const BUCKET = 'naviaction';
const ABANDON_AFTER_DAYS = 7;
const BATCH = 50;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.replace(/^﻿/, '').trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const cutoff = new Date(Date.now() - ABANDON_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: sessions } = await supabase
    .from('mm_capture_sessions')
    .select('id')
    .eq('status', 'active')
    .lt('started_at', cutoff)
    .limit(BATCH);

  if (!sessions?.length) {
    logSystem('cron.cleanup-sessions', { cleaned: 0, total: 0 });
    return NextResponse.json({ cleaned: 0 });
  }

  let cleaned = 0;
  for (const session of sessions) {
    try {
      const { data: files } = await supabase.storage.from(BUCKET).list(session.id, { limit: 1000 });
      if (files?.length) {
        await supabase.storage.from(BUCKET).remove(files.map(f => `${session.id}/${f.name}`));
      }
      await supabase.from('mm_capture_events').delete().eq('session_id', session.id);
      const { error: updateError } = await supabase
        .from('mm_capture_sessions')
        .update({ status: 'cancelled', ended_at: new Date().toISOString() })
        .eq('id', session.id);
      if (updateError) throw updateError;
      cleaned++;
    } catch {
      /* 개별 세션 실패는 다음 실행에서 재시도 */
    }
  }

  logSystem('cron.cleanup-sessions', { cleaned, total: sessions.length });
  return NextResponse.json({ cleaned, total: sessions.length });
}
