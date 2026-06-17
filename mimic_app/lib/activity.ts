import { createServiceRoleClient } from '@/lib/supabase/server';

export type ActivityAction =
  | 'comment_added'
  | 'comment_resolved'
  | 'comment_reopened'
  | 'reply_added'
  | 'share_invited'
  | 'share_revoked'
  | 'step_deleted'
  | 'annotation_edited';

// 협업 활동 기록. 실패해도 본 작업 흐름을 막지 않도록 throw 하지 않는다.
export async function logActivity(params: {
  tutorialId: string;
  actorId: string | null;
  action: ActivityAction;
  stepId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    await supabase.from('mm_activity').insert({
      tutorial_id: params.tutorialId,
      actor_id: params.actorId,
      action: params.action,
      step_id: params.stepId ?? null,
      meta: params.meta ?? {},
    });
  } catch {
    /* 활동 로그 실패 무시 */
  }
}
