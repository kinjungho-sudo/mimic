import { createServiceRoleClient } from '@/lib/supabase/server';

// ⚠️ 최신성(freshness) 검사 비활성화 (2026-06).
// 기존 구현은 저장된 앱 스크린샷과 페이지 og:image를 Claude Vision으로 비교했으나,
// og:image는 앱 화면이 아니라 SNS 공유용 배너라 비교가 무의미했고(대부분 false),
// 신뢰할 수 없는 결과로 사용자에게 오해(false confidence)를 줬다.
// 실제 화면 캡처(헤드리스/스크린샷 서비스) 도입 전까지 no-op으로 둔다 — 외부 fetch(SSRF)·AI 비용 없음.
// editor의 '최신성 확인' UI 트리거도 함께 제거됨(app/manual/[id]/editor/page.tsx).
export async function checkStepFreshness(
  stepId: string,
  _pageUrl: string,
  _savedScreenshotUrl: string,
): Promise<{ stepId: string; is_stale: boolean; similarity: number }> {
  void _pageUrl; void _savedScreenshotUrl; // 비활성화 동안 미사용 (시그니처는 호출부 호환 위해 유지)
  const supabase = createServiceRoleClient();
  await supabase
    .from('mm_steps')
    .update({ freshness_checked_at: new Date().toISOString(), is_stale: false })
    .eq('id', stepId);
  return { stepId, is_stale: false, similarity: 1 };
}
