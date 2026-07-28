import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, createServerClient } from '@/lib/supabase/server';
import { fetchLiveGuideSteps, gateLiveGuide } from '@/lib/live-guide/server';
import { resolvePublishedPlaybookLiveGuide } from '@/lib/live-guide/playbook-server';

type Params = { params: Promise<{ token: string }> };

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GUIDE_RESPONSE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
};

function guideJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: GUIDE_RESPONSE_HEADERS });
}

// GET /api/guide/{share_token}  — published, 인증 불필요 (Extension용)
// GET /api/guide/{tutorial_id}  — draft 포함, 로그인한 소유자만 (본인 미리보기용)
export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  // UUID 형식이면 tutorial_id로 해석 → 소유자 인증 후 반환
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

  if (isUuid) {
    // 로그인 세션 확인
    const serverClient = await createServerClient();
    const { data: { session } } = await serverClient.auth.getSession();
    if (!session?.user) {
      return guideJson({ error: 'Unauthorized' }, 401);
    }

    const { data: tutorial } = await supabase
      .from('mm_tutorials')
      .select('id, title, user_id, tts_enabled')
      .eq('id', token)
      .eq('user_id', session.user.id)
      .single();

    if (!tutorial) {
      return guideJson({ error: 'Not found' }, 404);
    }

    // 소유자 미리보기 — 차감 없이 한도만 확인
    const gated = await gateLiveGuide(supabase, tutorial.user_id);
    if (gated) return guideJson(gated);

    return guideJson(await fetchLiveGuideSteps(supabase, tutorial.id, tutorial.title, tutorial.user_id, !!tutorial.tts_enabled));
  }

  // share_token으로 published 튜토리얼 조회 (공개)
  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, title, user_id, tts_enabled')
    .eq('share_token', token)
    .eq('status', 'published')
    .single();

  if (!tutorial) {
    // Recorder 1.7.11 이하에서는 guide_source를 전달해도 기존 경로를 사용한다.
    // 단일 매뉴얼 토큰이 아니면 게시된 플레이북 토큰으로 한 번 더 해석해 하위 호환한다.
    const playbook = await resolvePublishedPlaybookLiveGuide(token, supabase);
    return guideJson(playbook.payload, playbook.status);
  }

  const gated = await gateLiveGuide(supabase, tutorial.user_id);
  if (gated) return guideJson(gated);

  return guideJson(await fetchLiveGuideSteps(supabase, tutorial.id, tutorial.title, tutorial.user_id, !!tutorial.tts_enabled));
}
