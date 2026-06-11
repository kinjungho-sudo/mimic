import { createServiceRoleClient } from '@/lib/supabase/server';

export type WorkspaceRole = 'admin' | 'editor' | 'viewer';

// 역할 계층: admin > editor > viewer
const ROLE_RANK: Record<WorkspaceRole, number> = {
  admin:  3,
  editor: 2,
  viewer: 1,
};

function hasRole(actual: WorkspaceRole, required: WorkspaceRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

type GuardResult =
  | { ok: true;  role: WorkspaceRole | 'owner' }
  | { ok: false; status: 403 | 404; error: string };

/**
 * 튜토리얼에 대한 접근 권한을 검사합니다.
 *
 * 개인 튜토리얼 (workspace_id = null):
 *   → user_id === requestUserId 인 경우만 허용
 *
 * 워크스페이스 튜토리얼 (workspace_id = uuid):
 *   → 워크스페이스 멤버이고 requiredRole 이상인 경우 허용
 *   → 워크스페이스 owner는 모든 작업 허용
 *
 * @param tutorialId  검사할 튜토리얼 ID
 * @param requestUserId  요청한 유저 ID
 * @param requiredRole  최소 필요 역할 (워크스페이스 튜토리얼일 때만 사용)
 */
export async function guardTutorialAccess(
  tutorialId: string,
  requestUserId: string,
  requiredRole: WorkspaceRole = 'editor'
): Promise<GuardResult> {
  const supabase = createServiceRoleClient();

  // 튜토리얼 조회 (user_id + workspace_id)
  const { data: tutorial, error } = await supabase
    .from('mm_tutorials')
    .select('id, user_id, workspace_id')
    .eq('id', tutorialId)
    .single();

  if (error || !tutorial) {
    return { ok: false, status: 404, error: 'Tutorial not found' };
  }

  // ── 개인 튜토리얼 ──
  if (!tutorial.workspace_id) {
    if (tutorial.user_id === requestUserId) {
      return { ok: true, role: 'owner' };
    }
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  // ── 워크스페이스 튜토리얼 ──
  // 워크스페이스 owner는 무조건 허용
  const { data: workspace } = await supabase
    .from('mm_workspaces')
    .select('owner_id')
    .eq('id', tutorial.workspace_id)
    .single();

  if (workspace?.owner_id === requestUserId) {
    return { ok: true, role: 'owner' };
  }

  // 멤버 역할 조회
  const { data: member } = await supabase
    .from('mm_workspace_members')
    .select('role')
    .eq('workspace_id', tutorial.workspace_id)
    .eq('user_id', requestUserId)
    .single();

  if (!member) {
    return { ok: false, status: 403, error: 'Not a workspace member' };
  }

  const memberRole = member.role as WorkspaceRole;

  if (!hasRole(memberRole, requiredRole)) {
    return {
      ok: false,
      status: 403,
      error: `Requires '${requiredRole}' role or above (current: '${memberRole}')`,
    };
  }

  return { ok: true, role: memberRole };
}

/**
 * 워크스페이스 직접 접근 권한 검사.
 * 오너는 무조건 허용, 아니면 멤버이고 requiredRole 이상이어야 허용.
 */
export async function guardWorkspaceAccess(
  workspaceId: string,
  requestUserId: string,
  requiredRole: WorkspaceRole = 'editor'
): Promise<GuardResult> {
  const supabase = createServiceRoleClient();

  const { data: workspace, error } = await supabase
    .from('mm_workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .single();

  if (error || !workspace) {
    return { ok: false, status: 404, error: 'Workspace not found' };
  }

  if (workspace.owner_id === requestUserId) {
    return { ok: true, role: 'owner' };
  }

  const { data: member } = await supabase
    .from('mm_workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', requestUserId)
    .single();

  if (!member) {
    return { ok: false, status: 403, error: 'Not a workspace member' };
  }

  const memberRole = member.role as WorkspaceRole;
  if (!hasRole(memberRole, requiredRole)) {
    return { ok: false, status: 403, error: `Requires '${requiredRole}' role or above (current: '${memberRole}')` };
  }

  return { ok: true, role: memberRole };
}

/**
 * 스텝 → 튜토리얼 경유 접근 권한 검사.
 * guardTutorialAccess와 동일하지만 step_id에서 tutorial_id를 먼저 조회합니다.
 */
export async function guardStepAccess(
  stepId: string,
  requestUserId: string,
  requiredRole: WorkspaceRole = 'editor'
): Promise<GuardResult & { tutorialId?: string }> {
  const supabase = createServiceRoleClient();

  const { data: step, error } = await supabase
    .from('mm_steps')
    .select('id, tutorial_id')
    .eq('id', stepId)
    .single();

  if (error || !step) {
    return { ok: false, status: 404, error: 'Step not found' };
  }

  const result = await guardTutorialAccess(step.tutorial_id, requestUserId, requiredRole);
  return { ...result, tutorialId: step.tutorial_id };
}
