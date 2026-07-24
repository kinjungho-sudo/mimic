import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  ONBOARDING_EVENT_TYPES,
  ONBOARDING_STEP_IDS,
  PARRO_ONBOARDING_KEY,
  PARRO_ONBOARDING_VERSION,
  buildOnboardingCompletionPatch,
  buildOnboardingStartPatch,
} from '@/lib/onboarding';

const progressColumns = 'user_id, guide_key, guide_version, status, current_step, initial_completed_at, last_started_at, last_completed_at, dismissed_at, run_count, practice_manual_id, created_at, updated_at' as const;

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('impression') }),
  z.object({ action: z.literal('start'), replay: z.boolean().optional().default(false) }),
  z.object({
    action: z.literal('progress'),
    current_step: z.string().trim().min(1).max(80)
      .refine(step => ONBOARDING_STEP_IDS.has(step), 'Unknown onboarding step'),
  }),
  z.object({ action: z.literal('complete') }),
  z.object({ action: z.literal('dismiss') }),
  z.object({ action: z.literal('clear_practice_manual') }),
]);

const eventSchema = z.object({
  event_type: z.enum(ONBOARDING_EVENT_TYPES),
  step_id: z.string().trim().min(1).max(80)
    .refine(step => ONBOARDING_STEP_IDS.has(step), 'Unknown onboarding step')
    .nullable()
    .optional(),
  browser_type: z.enum(['chrome', 'edge', 'firefox', 'safari', 'other', 'unknown']).nullable().optional(),
  extension_state: z.enum(['installed', 'missing', 'unlinked', 'unknown']).nullable().optional(),
});

async function readProgress(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
) {
  const { data } = await supabase
    .from('mm_user_onboarding_progress')
    .select(progressColumns)
    .eq('user_id', userId)
    .eq('guide_key', PARRO_ONBOARDING_KEY)
    .eq('guide_version', PARRO_ONBOARDING_VERSION)
    .maybeSingle();
  return data;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();
  const [progress, tutorialsResult, pagesResult, legacyManualsResult] = await Promise.all([
    readProgress(supabase, auth.userId),
    supabase
      .from('mm_tutorials')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.userId)
      .is('deleted_at', null),
    supabase
      .from('mm_pages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.userId)
      .is('deleted_at', null),
    supabase
      .from('mm_manuals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.userId),
  ]);

  const contentCount = (tutorialsResult.count ?? 0)
    + (pagesResult.count ?? 0)
    + (legacyManualsResult.count ?? 0);

  return NextResponse.json({
    guide_key: PARRO_ONBOARDING_KEY,
    guide_version: PARRO_ONBOARDING_VERSION,
    progress,
    eligible_for_auto_prompt: !progress && contentCount === 0,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const existing = await readProgress(supabase, auth.userId);
  const now = new Date().toISOString();
  const key = {
    user_id: auth.userId,
    guide_key: PARRO_ONBOARDING_KEY,
    guide_version: PARRO_ONBOARDING_VERSION,
  };
  let values: Record<string, unknown>;

  switch (parsed.data.action) {
    case 'impression':
      values = existing
        ? { impression_at: now }
        : { ...key, status: 'not_started', impression_at: now, run_count: 0 };
      break;
    case 'start':
      values = {
        ...(!existing ? key : {}),
        ...buildOnboardingStartPatch(existing, now),
      };
      break;
    case 'progress':
      if (!existing) {
        return NextResponse.json({ error: 'Onboarding has not started' }, { status: 409 });
      }
      values = { status: 'in_progress', current_step: parsed.data.current_step };
      break;
    case 'complete':
      if (!existing) {
        return NextResponse.json({ error: 'Onboarding has not started' }, { status: 409 });
      }
      values = buildOnboardingCompletionPatch(existing, now);
      break;
    case 'dismiss':
      values = existing
        ? { status: 'dismissed', dismissed_at: now }
        : { ...key, status: 'dismissed', dismissed_at: now, run_count: 0 };
      break;
    case 'clear_practice_manual':
      if (!existing) {
        return NextResponse.json({ error: 'Onboarding progress not found' }, { status: 404 });
      }
      values = { practice_manual_id: null };
      break;
  }

  const query = existing
    ? supabase
        .from('mm_user_onboarding_progress')
        .update(values)
        .eq('user_id', auth.userId)
        .eq('guide_key', PARRO_ONBOARDING_KEY)
        .eq('guide_version', PARRO_ONBOARDING_VERSION)
    : supabase.from('mm_user_onboarding_progress').insert(values);

  const { data, error } = await query.select(progressColumns).single();
  if (error) {
    return NextResponse.json({ error: 'Failed to save onboarding progress' }, { status: 500 });
  }

  return NextResponse.json({ progress: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('mm_onboarding_events').insert({
    user_id: auth.userId,
    guide_key: PARRO_ONBOARDING_KEY,
    guide_version: PARRO_ONBOARDING_VERSION,
    event_type: parsed.data.event_type,
    step_id: parsed.data.step_id ?? null,
    browser_type: parsed.data.browser_type ?? null,
    extension_state: parsed.data.extension_state ?? null,
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to record onboarding event' }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
