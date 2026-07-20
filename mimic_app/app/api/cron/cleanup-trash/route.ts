import { NextRequest, NextResponse } from 'next/server';
import { logSystem } from '@/lib/logging/logger-server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { TRASH_CLEANUP_BATCH_SIZE, TRASH_RETENTION_DAYS, trashCutoff } from '@/lib/trash-retention';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.replace(/^﻿/, '').trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const cutoff = trashCutoff();
  const dryRun = request.nextUrl.searchParams.get('dry_run') === '1';
  const { data: candidates, error: listError } = await supabase
    .from('mm_tutorials')
    .select('id')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)
    .order('deleted_at', { ascending: true })
    .limit(TRASH_CLEANUP_BATCH_SIZE);

  if (listError) {
    logSystem('cron.cleanup-trash.fail', { stage: 'list', message: listError.message });
    return NextResponse.json({ error: 'Trash cleanup preflight failed' }, { status: 500 });
  }

  const ids = (candidates ?? []).map(candidate => candidate.id);
  if (dryRun || ids.length === 0) {
    logSystem('cron.cleanup-trash', { dryRun, eligible: ids.length, deleted: 0, retentionDays: TRASH_RETENTION_DAYS });
    return NextResponse.json({ dryRun, eligible: ids.length, deleted: 0, retentionDays: TRASH_RETENTION_DAYS });
  }

  const { error: deleteError, count } = await supabase
    .from('mm_tutorials')
    .delete({ count: 'exact' })
    .in('id', ids)
    .lt('deleted_at', cutoff);

  if (deleteError) {
    logSystem('cron.cleanup-trash.fail', { stage: 'delete', eligible: ids.length, message: deleteError.message });
    return NextResponse.json({ error: 'Trash cleanup failed', eligible: ids.length }, { status: 500 });
  }

  const deleted = count ?? ids.length;
  logSystem('cron.cleanup-trash', { dryRun: false, eligible: ids.length, deleted, retentionDays: TRASH_RETENTION_DAYS });
  return NextResponse.json({ dryRun: false, eligible: ids.length, deleted, retentionDays: TRASH_RETENTION_DAYS });
}
