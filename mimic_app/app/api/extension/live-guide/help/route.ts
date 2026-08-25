import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logActivity } from '@/lib/activity';
import { requireExtensionToken } from '@/lib/auth/auth-guard';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  tutorial_id: z.string().uuid(),
  step_id: z.string().uuid(),
  guide_token: z.string().min(1).max(80),
  message: z.string().trim().max(1000).optional().default(''),
  screenshot_data_url: z.string().max(7_000_000).nullable().optional(),
  page_url: z.string().url().max(2048).nullable().optional(),
});

function decodeScreenshot(value: string | null | undefined) {
  if (!value) return null;
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) return null;
  return {
    buffer,
    extension: match[1] === 'jpeg' ? 'jpg' : 'png',
    contentType: match[1] === 'jpeg' ? 'image/jpeg' : 'image/png',
  };
}

async function canSubmitRequest(
  tutorialId: string,
  guideToken: string,
  userId: string,
) {
  const uuidToken = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guideToken);
  if (uuidToken) {
    if (guideToken !== tutorialId) return false;
    return (await guardTutorialAccess(tutorialId, userId, 'viewer')).ok;
  }

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('mm_tutorials')
    .select('id')
    .eq('id', tutorialId)
    .eq('share_token', guideToken)
    .eq('status', 'published')
    .maybeSingle();
  return !!data;
}

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  if (!(await canSubmitRequest(body.tutorial_id, body.guide_token, auth.userId))) {
    return NextResponse.json({ error: 'Guide access denied' }, { status: 403 });
  }

  const supabase = createServiceRoleClient();
  const { data: step } = await supabase
    .from('mm_steps')
    .select('id, step_number')
    .eq('id', body.step_id)
    .eq('tutorial_id', body.tutorial_id)
    .maybeSingle();
  if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 });

  let attachmentPath: string | null = null;
  const screenshot = decodeScreenshot(body.screenshot_data_url);
  if (body.screenshot_data_url && !screenshot) {
    return NextResponse.json({ error: 'Invalid screenshot' }, { status: 400 });
  }
  if (screenshot) {
    attachmentPath = `${body.tutorial_id}/${auth.userId}/${randomUUID()}.${screenshot.extension}`;
    const { error } = await supabase.storage
      .from('live-guide-help')
      .upload(attachmentPath, screenshot.buffer, {
        contentType: screenshot.contentType,
        upsert: false,
      });
    if (error) return NextResponse.json({ error: 'Screenshot upload failed' }, { status: 500 });
  }

  const text = body.message || `${step.step_number ?? ''}단계에서 도움이 필요합니다.`.trim();
  const { data: comment, error } = await supabase
    .from('mm_comments')
    .insert({
      tutorial_id: body.tutorial_id,
      step_id: body.step_id,
      author_id: auth.userId,
      body: text,
      request_kind: 'live_guide_help',
      attachment_path: attachmentPath,
      request_context: {
        source: 'live_guide',
        step_number: step.step_number,
        page_url: body.page_url ?? null,
      },
    })
    .select('id, created_at')
    .single();

  if (error) {
    if (attachmentPath) await supabase.storage.from('live-guide-help').remove([attachmentPath]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity({
    tutorialId: body.tutorial_id,
    actorId: auth.userId,
    action: 'comment_added',
    stepId: body.step_id,
    meta: { request_kind: 'live_guide_help', has_screenshot: !!attachmentPath, snippet: text.slice(0, 60) },
  });

  return NextResponse.json({ ok: true, request_id: comment.id, created_at: comment.created_at }, { status: 201 });
}
