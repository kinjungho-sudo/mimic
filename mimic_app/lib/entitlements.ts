export type ProductPlan = 'free' | 'pro_waitlist' | 'basic' | 'pro' | 'team' | 'enterprise';

export type ProductEntitlement =
  | 'ai_rewrite'
  | 'ai_voice'
  | 'branding'
  | 'desktop_companion'
  | 'live_guide'
  | 'office_export'
  | 'protected_sharing'
  | 'team_workspace';

const ENTITLED_PLANS: Record<ProductEntitlement, readonly ProductPlan[]> = {
  ai_rewrite: ['basic', 'pro', 'team', 'enterprise'],
  ai_voice: ['pro', 'team', 'enterprise'],
  branding: ['pro', 'team', 'enterprise'],
  desktop_companion: ['pro', 'team', 'enterprise'],
  live_guide: ['pro', 'team', 'enterprise'],
  office_export: ['basic', 'pro', 'team', 'enterprise'],
  protected_sharing: ['basic', 'pro', 'team', 'enterprise'],
  team_workspace: ['team', 'enterprise'],
};

export const ENTITLEMENT_UPGRADE_COPY: Record<ProductEntitlement, string> = {
  ai_rewrite: 'AI 다듬기는 Basic 이상 플랜에서 사용할 수 있습니다.',
  ai_voice: 'AI 음성은 Pro 이상 플랜에서 사용할 수 있습니다.',
  branding: '브랜드 표기는 Pro 이상 플랜에서 사용할 수 있습니다.',
  desktop_companion: 'Desktop Companion은 Pro 이상 플랜에서 사용할 수 있습니다.',
  live_guide: 'Live Guide Beta는 Pro 이상 플랜에서 사용할 수 있습니다.',
  office_export: 'PPTX·Word 내보내기는 Basic 이상 플랜에서 사용할 수 있습니다.',
  protected_sharing: '비밀번호 보호는 Basic 이상 플랜에서 사용할 수 있습니다.',
  team_workspace: '팀 워크스페이스는 Team 플랜에서 사용할 수 있습니다.',
};

export function normalizeProductPlan(plan: string | null | undefined): ProductPlan {
  if (plan === 'basic' || plan === 'pro' || plan === 'team' || plan === 'enterprise' || plan === 'pro_waitlist') {
    return plan;
  }
  return 'free';
}

export function hasEntitlement(
  plan: string | null | undefined,
  entitlement: ProductEntitlement,
): boolean {
  return ENTITLED_PLANS[entitlement].includes(normalizeProductPlan(plan));
}

export function entitlementsForPlan(plan: string | null | undefined): Record<ProductEntitlement, boolean> {
  return {
    ai_rewrite: hasEntitlement(plan, 'ai_rewrite'),
    ai_voice: hasEntitlement(plan, 'ai_voice'),
    branding: hasEntitlement(plan, 'branding'),
    desktop_companion: hasEntitlement(plan, 'desktop_companion'),
    live_guide: hasEntitlement(plan, 'live_guide'),
    office_export: hasEntitlement(plan, 'office_export'),
    protected_sharing: hasEntitlement(plan, 'protected_sharing'),
    team_workspace: hasEntitlement(plan, 'team_workspace'),
  };
}
