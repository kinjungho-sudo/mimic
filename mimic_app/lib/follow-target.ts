export type GuideTargetRect = { x: number; y: number; w: number; h: number };

const LARGE_TARGET_MAX_WIDTH_PCT = 34;
const LARGE_TARGET_MAX_HEIGHT_PCT = 30;
const LARGE_TARGET_MAX_AREA = 900;
const COMPACT_TARGET_MAX_WIDTH_PX = 180;
const COMPACT_TARGET_MAX_HEIGHT_PX = 112;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * 큰 컨테이너 DOM이 선택되면 사용자가 실제로 눌러야 할 지점이 흐려진다.
 * 화면의 약 9% 이상을 차지하거나 한 축이 지나치게 긴 요소는 큰 대상으로 본다.
 */
export function isOversizedGuideTarget(rect?: GuideTargetRect | null): boolean {
  if (!rect) return false;
  return rect.w > LARGE_TARGET_MAX_WIDTH_PCT
    || rect.h > LARGE_TARGET_MAX_HEIGHT_PCT
    || rect.w * rect.h > LARGE_TARGET_MAX_AREA;
}

/**
 * 큰 DOM은 원본 요소 범위 안에서 실제 클릭 좌표를 중심으로 작은 학습용 타깃을 만든다.
 * 작은 버튼이나 입력창은 감지된 DOM 크기를 그대로 유지한다.
 */
export function resolveGuideTargetRect(
  rect: GuideTargetRect | null | undefined,
  hotspotX: number | null,
  hotspotY: number | null,
  viewportWidth: number,
  viewportHeight: number,
): GuideTargetRect | null {
  if (!rect) return null;
  if (!isOversizedGuideTarget(rect) || hotspotX == null || hotspotY == null) return rect;

  const maxWidthPct = viewportWidth > 0 ? (COMPACT_TARGET_MAX_WIDTH_PX / viewportWidth) * 100 : 18;
  const maxHeightPct = viewportHeight > 0 ? (COMPACT_TARGET_MAX_HEIGHT_PX / viewportHeight) * 100 : 14;
  const w = Math.min(rect.w, Math.max(6, maxWidthPct));
  const h = Math.min(rect.h, Math.max(6, maxHeightPct));
  const maxX = rect.x + rect.w - w;
  const maxY = rect.y + rect.h - h;

  return {
    x: clamp(hotspotX - w / 2, rect.x, maxX),
    y: clamp(hotspotY - h / 2, rect.y, maxY),
    w,
    h,
  };
}
