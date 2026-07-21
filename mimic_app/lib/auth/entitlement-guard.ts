import { NextResponse } from 'next/server';
import {
  ENTITLEMENT_UPGRADE_COPY,
  hasEntitlement,
  normalizeProductPlan,
  type ProductEntitlement,
  type ProductPlan,
} from '@/lib/entitlements';
import { createServiceRoleClient } from '@/lib/supabase/server';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

type EntitlementResult =
  | { ok: true; plan: ProductPlan; billingUserId: string }
  | { ok: false; response: NextResponse };

function denied(entitlement: ProductEntitlement): EntitlementResult {
  return {
    ok: false,
    response: NextResponse.json(
      {
        error: ENTITLEMENT_UPGRADE_COPY[entitlement],
        code: 'plan_upgrade_required',
        entitlement,
        upgradeUrl: '/landingpage#pricing',
      },
      { status: 403 },
    ),
  };
}

async function checkBillingUser(
  supabase: ServiceClient,
  billingUserId: string,
  entitlement: ProductEntitlement,
): Promise<EntitlementResult> {
  const { data: user } = await supabase
    .from('mm_users')
    .select('plan')
    .eq('id', billingUserId)
    .maybeSingle();
  const plan = normalizeProductPlan(user?.plan);
  return hasEntitlement(plan, entitlement)
    ? { ok: true, plan, billingUserId }
    : denied(entitlement);
}

export function requireUserEntitlement(
  userId: string,
  entitlement: ProductEntitlement,
  supabase = createServiceRoleClient(),
): Promise<EntitlementResult> {
  return checkBillingUser(supabase, userId, entitlement);
}

export async function requireWorkspaceEntitlement(
  workspaceId: string,
  entitlement: ProductEntitlement,
  supabase = createServiceRoleClient(),
): Promise<EntitlementResult> {
  const { data: workspace } = await supabase
    .from('mm_workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .maybeSingle();
  if (!workspace?.owner_id) {
    return { ok: false, response: NextResponse.json({ error: 'Workspace not found' }, { status: 404 }) };
  }
  return checkBillingUser(supabase, workspace.owner_id, entitlement);
}

export async function requireTutorialEntitlement(
  tutorialId: string,
  entitlement: ProductEntitlement,
  supabase = createServiceRoleClient(),
): Promise<EntitlementResult> {
  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('user_id, workspace_id')
    .eq('id', tutorialId)
    .maybeSingle();
  if (!tutorial?.user_id) {
    return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  if (tutorial.workspace_id) {
    return requireWorkspaceEntitlement(tutorial.workspace_id, entitlement, supabase);
  }
  return checkBillingUser(supabase, tutorial.user_id, entitlement);
}
