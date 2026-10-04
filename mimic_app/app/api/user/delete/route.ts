import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/logging/logger-server';

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

const STORAGE_PAGE_SIZE = 1000;
const STORAGE_REMOVE_BATCH_SIZE = 100;

async function listFiles(
  supabase: ServiceRoleClient,
  bucket: string,
  prefix: string,
) {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: STORAGE_PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);

    const entries = data ?? [];
    for (const entry of entries) {
      if (entry.id) paths.push(`${prefix}/${entry.name}`);
    }
    if (entries.length < STORAGE_PAGE_SIZE) break;
    offset += entries.length;
  }

  return paths;
}

async function removePaths(
  supabase: ServiceRoleClient,
  bucket: string,
  paths: string[],
) {
  for (let index = 0; index < paths.length; index += STORAGE_REMOVE_BATCH_SIZE) {
    const batch = paths.slice(index, index + STORAGE_REMOVE_BATCH_SIZE);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw new Error(`${bucket}: ${error.message}`);
  }
}

async function removePrefix(
  supabase: ServiceRoleClient,
  bucket: string,
  prefix: string,
) {
  await removePaths(supabase, bucket, await listFiles(supabase, bucket, prefix));
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  const [sessionsResult, tutorialsResult] = await Promise.all([
    supabase.from('mm_capture_sessions').select('id').eq('user_id', auth.userId),
    supabase.from('mm_tutorials').select('id').eq('user_id', auth.userId),
  ]);
  if (sessionsResult.error || tutorialsResult.error) {
    const reason = sessionsResult.error?.message ?? tutorialsResult.error?.message ?? 'unknown lookup error';
    logAudit('auth.account.delete.prepare.fail', { userId: auth.userId, reason }, 'warn');
    return NextResponse.json({ error: 'Failed to prepare account deletion' }, { status: 500 });
  }

  const sessionIds = (sessionsResult.data ?? []).map(row => row.id);
  const tutorialIds = (tutorialsResult.data ?? []).map(row => row.id);
  const stepsResult = tutorialIds.length
    ? await supabase.from('mm_steps').select('id').in('tutorial_id', tutorialIds)
    : { data: [], error: null };
  if (stepsResult.error) {
    logAudit('auth.account.delete.prepare.fail', {
      userId: auth.userId,
      reason: stepsResult.error.message,
    }, 'warn');
    return NextResponse.json({ error: 'Failed to prepare account deletion' }, { status: 500 });
  }

  const naviactionPrefixes = [
    ...sessionIds,
    `playbook-uploads/${auth.userId}`,
    `manual-captures/${auth.userId}`,
    `blurred/${auth.userId}`,
    `thumbnails/${auth.userId}`,
    ...tutorialIds.map(tutorialId => `live-guide-help/${tutorialId}/${auth.userId}`),
  ];

  try {
    for (const prefix of naviactionPrefixes) {
      await removePrefix(supabase, 'naviaction', prefix);
    }
    await removePrefix(supabase, 'avatars', auth.userId);
    await removePrefix(supabase, 'branding', auth.userId);
    await removePrefix(supabase, 'screenshots', auth.userId);
    await removePrefix(supabase, 'audio', auth.userId);
    await removePaths(
      supabase,
      'mimic-tts',
      (stepsResult.data ?? []).map(step => `tts/${step.id}.mp3`),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown storage cleanup error';
    logAudit('auth.account.delete.storage.fail', { userId: auth.userId, reason }, 'warn');
    return NextResponse.json({ error: 'Failed to remove account files' }, { status: 500 });
  }

  // 사용자 데이터 삭제 (RLS bypass)
  // mm_capture_sessions는 user_id에 FK CASCADE가 없어 직접 삭제 (capture_events는 session FK로 연쇄 삭제됨)
  const captureDelete = await supabase.from('mm_capture_sessions').delete().eq('user_id', auth.userId);
  if (captureDelete.error) {
    logAudit('auth.account.delete.db.fail', {
      userId: auth.userId,
      table: 'mm_capture_sessions',
      reason: captureDelete.error.message,
    }, 'warn');
    return NextResponse.json({ error: 'Failed to remove account data' }, { status: 500 });
  }

  const tutorialDelete = await supabase.from('mm_tutorials').delete().eq('user_id', auth.userId);
  if (tutorialDelete.error) {
    logAudit('auth.account.delete.db.fail', {
      userId: auth.userId,
      table: 'mm_tutorials',
      reason: tutorialDelete.error.message,
    }, 'warn');
    return NextResponse.json({ error: 'Failed to remove account data' }, { status: 500 });
  }

  // mm_users 삭제 시 FK ON DELETE CASCADE로 folders/pages/branding/workspaces/extension_tokens 등 연쇄 삭제됨
  const userDelete = await supabase.from('mm_users').delete().eq('id', auth.userId);
  if (userDelete.error) {
    logAudit('auth.account.delete.db.fail', {
      userId: auth.userId,
      table: 'mm_users',
      reason: userDelete.error.message,
    }, 'warn');
    return NextResponse.json({ error: 'Failed to remove account data' }, { status: 500 });
  }

  // Supabase Auth 계정 삭제
  const { error } = await supabase.auth.admin.deleteUser(auth.userId);
  if (error) {
    logAudit('auth.account.delete.fail', { userId: auth.userId, reason: error.message }, 'warn');
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logAudit('auth.account.delete', { userId: auth.userId });
  return NextResponse.json({ success: true });
}
