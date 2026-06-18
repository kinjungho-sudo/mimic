// 플랜 한도 — 한 곳에서 관리(향후 변경 가능)

export const PAID_PLANS = ['pro', 'team', 'enterprise'];

// 무료 플랜 플레이북(통합 문서) 총 보유 한도. Pro/Team은 무제한.
export const FREE_PLAYBOOK_LIMIT = 3;

export function isPaidPlan(plan: string | null | undefined): boolean {
  return PAID_PLANS.includes(plan ?? '');
}
