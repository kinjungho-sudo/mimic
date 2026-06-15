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

// 매뉴얼별 이메일 초대 공유(mm_manual_shares)로 부여된 역할을 조회.
// user_id 또는 (요청자 이메일 == 초대 이메일)로 매칭. 이메일로만 매칭되면 user_id를 연결한다.
async function resolveManualShareRole(
  supabase: ReturnType<typeof createServiceRoleClient>,
  tutorialId: string,
  requestUserId: string
): Promise<WorkspaceRole | null> {
  const { data: shares } = await supabase
    .from('mm_manual_shares')
    .select('id, role, user_id, email')
    .eq('tutorial_id', tutorialId);
  if (!shares || shares.length === 0) return null;

  let byId = shares.find(s => s.user_id === requestUserId);
  if (!byId) {
    const { data: me } = await supabase.from('mm_users').select('email').eq('id', requestUserId).single();
    const email = me?.email?.toLowerCase();
    if (email) {
      const byEmail = shares.find(s => !s.user_id && s.email?.toLowerCase() === email);
      if (byEmail) {
        // 향후 빠른 매칭 + 활동 귀속을 위해 user_id 연결
        await supabase.from('mm_manual_shares').update({ user_id: requestUserId }).eq('id', byEmail.id);
        byId = byEmail;
      }
    }
  }
  return byId ? (byId.role as WorkspaceRole) : null;
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
    // 매뉴얼별 공유(이메일 초대)로 부여된 권한 확인
    const sharedRole = await resolveManualShareRole(supabase, tutorialId, requestUserId);
    if (sharedRole && hasRole(sharedRole, requiredRole)) {
      return { ok: true, role: sharedRole };
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

  const memberRole = member?.role as WorkspaceRole | undefined;
  if (memberRole && hasRole(memberRole, requiredRole)) {
    return { ok: true, role: memberRole };
  }

  // 워크스페이스 권한이 없거나 부족하면 매뉴얼별 공유(이메일 초대) 확인
  const sharedRole = await resolveManualShareRole(supabase, tutorialId, requestUserId);
  if (sharedRole && hasRole(sharedRole, requiredRole)) {
    return { ok: true, role: sharedRole };
  }

  if (!member) {
    return { ok: false, status: 403, error: 'Not a workspace member' };
  }
  return {
    ok: false,
    status: 403,
    error: `Requires '${requiredRole}' role or above (current: '${memberRole}')`,
  };
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
 * Page 접근 권한 검사.
 * 개인 페이지(workspace_id=null)는 소유자만, 워크스페이스 페이지는 멤버이고 requiredRole 이상.
 */
export async function guardPageAccess(
  pageId: string,
  requestUserId: string,
  requiredRole: WorkspaceRole = 'editor'
): Promise<GuardResult> {
  const supabase = createServiceRoleClient();

  const { data: page, error } = await supabase
    .from('mm_pages')
    .select('id, user_id, workspace_id')
    .eq('id', pageId)
    .single();

  if (error || !page) {
    return { ok: false, status: 404, error: 'Page not found' };
  }

  if (!page.workspace_id) {
    if (page.user_id === requestUserId) return { ok: true, role: 'owner' };
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return guardWorkspaceAccess(page.workspace_id, requestUserId, requiredRole);
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
