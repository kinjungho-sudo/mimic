import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, createServerClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ token: string }> };

// 라이브 가이드 유료 게이팅 — 제작자(소유자) 과금. Free 소유자는 누적 5회 무료 후 페이월.
const FREE_LIVE_GUIDE_LIMIT = 5;
const PAID_PLANS = ['pro', 'team', 'enterprise'];
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://mimic-nine-ashen.vercel.app').replace(/^﻿/, '').trim();

// 소유자 플랜·사용량으로 게이트 판정. 반환: 막혔으면 gated 정보, 아니면 null.
// charge=true(공개 실행)일 때만 카운트 차감 — RPC로 원자적 check-and-increment(race 방지).
// charge=false(소유자 미리보기)는 읽기 전용 판정만 — 미리보기로 무료 한도가 소진되지 않게.
async function gateLiveGuide(
  supabase: ReturnType<typeof createServiceRoleClient>,
  ownerId: string,
  charge: boolean,
): Promise<{ gated: true; limit: number; used: number; upgradeUrl: string } | null> {
  const { data: owner } = await supabase
    .from('mm_users')
    .select('plan, live_guide_runs')
    .eq('id', ownerId)
    .single();

  const plan = owner?.plan ?? 'free';
  if (PAID_PLANS.includes(plan)) return null; // 유료=무제한(미카운트)

  const gated = { gated: true as const, limit: FREE_LIVE_GUIDE_LIMIT, used: owner?.live_guide_runs ?? 0, upgradeUrl: `${APP_URL}/settings` };

  if (!charge) {
    // 미리보기 — 차감 없이 한도만 확인
    return gated.used >= FREE_LIVE_GUIDE_LIMIT ? gated : null;
  }

  // 공개 실행 — 한도 미만일 때만 원자적으로 1회 차감. 한도 도달 시 RPC가 NULL 반환.
  const { data: newCount } = await supabase.rpc('consume_free_live_guide_run', {
    uid: ownerId,
    free_limit: FREE_LIVE_GUIDE_LIMIT,
  });
  return newCount == null ? gated : null;
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: tutorial } = await supabase
      .from('mm_tutorials')
      .select('id, title, user_id')
      .eq('id', token)
      .eq('user_id', session.user.id)
      .single();

    if (!tutorial) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 소유자 미리보기 — 차감 없이 한도만 확인
    const gated = await gateLiveGuide(supabase, tutorial.user_id, false);
    if (gated) return NextResponse.json(gated);

    return NextResponse.json(await fetchSteps(supabase, tutorial.id, tutorial.title));
  }

  // share_token으로 published 튜토리얼 조회 (공개)
  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, title, user_id')
    .eq('share_token', token)
    .eq('status', 'published')
    .single();

  if (!tutorial) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // 공개 실행 — 원자적 차감
  const gated = await gateLiveGuide(supabase, tutorial.user_id, true);
  if (gated) return NextResponse.json(gated);

  return NextResponse.json(await fetchSteps(supabase, tutorial.id, tutorial.title));
}

async function fetchSteps(supabase: ReturnType<typeof createServiceRoleClient>, tutorialId: string, title: string) {
  const { data: rawSteps } = await supabase
    .from('mm_steps')
    .select(
      'id, step_number, user_title, ai_title, user_script, ai_description, ' +
      'page_url, element_selector, element_xpath, element_rect, click_x, click_y, screenshot_url, follow_config, type_text'
    )
    .eq('tutorial_id', tutorialId)
    .order('order_index')
    .order('step_number'); // tie-break: order_index 동률/NULL(복제·레거시 데이터)일 때 순서 결정성 보장

  const steps = ((rawSteps ?? []) as unknown as Record<string, unknown>[]).map(s => {
    const fc = (s.follow_config ?? {}) as {
      kind?: string | null; typeText?: string | null; hidden?: boolean;
      hotspotX?: number | null; hotspotY?: number | null; bubbleAnchor?: string | null;
    };
    return {
      id: s.id,
      step_number: s.step_number,
      title: (s.user_title ?? s.ai_title ?? `Step ${s.step_number}`) as string,
      instruction: (s.user_script ?? s.ai_description ?? '') as string,
      page_url: s.page_url ?? null,
      element_selector: s.element_selector ?? null,
      element_xpath: s.element_xpath ?? null,
      element_rect: s.element_rect ?? null,
      click_x: s.click_x ?? null,
      click_y: s.click_y ?? null,
      screenshot_url: s.screenshot_url ?? null,
      // 라이브 가이드 자동입력용 — 스튜디오 오버라이드(fc.typeText) 우선, 없으면 캡처 원문(s.type_text) 폴백
      kind: fc.kind ?? null,
      type_text: fc.typeText ?? (s.type_text as string | null) ?? null,
      hidden: !!fc.hidden,
      // 소유자가 스튜디오에서 직접 보정한 핫스팟(0~100%)·말풍선 위치 — 라이브 가이드가 우선 적용
      hotspot_x: fc.hotspotX ?? null,
      hotspot_y: fc.hotspotY ?? null,
      bubble_anchor: fc.bubbleAnchor ?? null,
    };
  });

  // 숨김 스텝은 따라하기/라이브 가이드에서 제외 (일관성)
  return { tutorial_id: tutorialId, title, steps: steps.filter(s => !s.hidden) };
}
