// 따라하기(인터랙티브) 스텝 해석 — follow_config 오버라이드 + hidden 필터를 한 곳에서.
// 슬라이드/녹화 데이터(자동추론)와 스튜디오 저작값(follow_config)을 합쳐 플레이어 입력을 만든다.
import type { FollowConfig, StepType } from '@/types';
import type { FollowStep } from '@/components/viewer/InteractiveFollowPlayer';
import type { Annotation } from '@/components/editor/ImageAnnotationEditor';

const TYPE_RE = /입력|타이핑|작성|기입|텍스트/;
const CLICK_RE = /클릭|누르|선택|눌러|버튼|탭|체크|이동|열기/;

// 제목/본문으로 click vs type 추론 (follow_config.kind 미설정 시 폴백)
export function inferKind(title?: string | null, body?: string | null): 'click' | 'type' {
  const t = `${title ?? ''} ${body ?? ''}`;
  return TYPE_RE.test(t) && !CLICK_RE.test(t) ? 'type' : 'click';
}

// DB click 좌표 → 0~100 pct (현행 0~1 실수, 레거시 0~10000 정수 혼재 방어)
export function clickToPct(v: number | null | undefined): number | null {
  if (v == null) return null;
  if (v <= 1) return v * 100;
  if (v > 100) return v / 100;
  return v;
}

// follow_config에 '학습 가이드/Live Guide'에서 의미있는 저작값이 있는지 — 스텝 삭제 경고용.
// 녹화 좌표(clickX/Y)는 follow_config가 아니므로 여기 포함하지 않는다(스튜디오에서 직접 저작한 값만 감지).
export function hasGuideConfig(fc?: FollowConfig | null): boolean {
  if (!fc) return false;
  return (
    fc.hotspotX != null ||
    fc.hotspotY != null ||
    fc.kind != null ||
    (!!fc.typeText && fc.typeText.trim() !== '') ||
    fc.typeInputMode != null ||
    fc.typeBoxWidth != null ||
    fc.typeBoxHeight != null ||
    fc.bubbleAnchor != null ||
    fc.hidden === true
  );
}

// 플레이어로 넘기기 전 각 호출부가 자기 데이터를 이 형태로 정규화한다.
export type FollowSource = {
  title: string;
  body?: string | null;
  screenshotUrl?: string | null;
  clickXPct: number | null;        // 0~100 (녹화 좌표, 이미 변환됨)
  clickYPct: number | null;
  audioUrl?: string | null;
  audioStartMs?: number | null;
  audioEndMs?: number | null;
  typeText?: string | null;
  followConfig?: FollowConfig | null;
  stepType?: StepType | string | null;
  annotations?: Annotation[] | null;
  domRect?: { x: number; y: number; w: number; h: number } | null; // element_rect × 100 (0~100 pct)
};

function isExplanationStepType(stepType?: StepType | string | null): boolean {
  return stepType === 'visual_only_step'
    || stepType === 'visual_overlay_step'
    || stepType === 'manual_capture_step'
    || stepType === 'blocked_step';
}

// follow_config 우선, 미설정 필드는 자동추론. hidden 스텝은 제외.
export function toFollowSteps(sources: FollowSource[]): FollowStep[] {
  return sources
    .filter(s => !s.followConfig?.hidden)
    .map(s => {
      const fc = s.followConfig ?? {};
      const resolvedKind = fc.kind ?? inferKind(s.title, s.body);
      // 'none' = 인디케이터 미표시 → 핫스팟 좌표를 null로 강제(플레이어가 하단 안내로 전환)
      const isNone = resolvedKind === 'none' || isExplanationStepType(s.stepType);
      return {
        // 제목·설명은 문서 매뉴얼과 공유 — user_title/user_script가 그대로 흐른다
        title: s.title,
        body: s.body ?? undefined,
        screenshotUrl: s.screenshotUrl,
        hotspotX: isNone ? null : (fc.hotspotX != null ? fc.hotspotX : s.clickXPct),
        hotspotY: isNone ? null : (fc.hotspotY != null ? fc.hotspotY : s.clickYPct),
        // 스튜디오 저작 좌표는 좌상단도 유효 — 자동추론 0,0 아티팩트만 억제
        hotspotUserPlaced: !isNone && fc.hotspotX != null,
        kind: isNone ? 'click' : resolvedKind,  // none이면 핫스팟 없으니 kind 값은 무의미
        typeText: fc.typeText?.trim() || s.typeText?.trim() || null,
        typeInputMode: fc.typeInputMode ?? 'copy',
        typeBoxWidth: fc.typeBoxWidth ?? null,
        typeBoxHeight: fc.typeBoxHeight ?? null,
        audioUrl: s.audioUrl ?? null,
        audioStartMs: s.audioStartMs ?? null,
        audioEndMs: s.audioEndMs ?? null,
        bubbleAnchor: fc.bubbleAnchor ?? null,
        domRect: s.domRect ?? null,
        zoomAnim: fc.zoomAnim ?? false,
        stepType: s.stepType ?? null,
        annotations: s.annotations ?? null,
        guideMode: isNone ? 'explanation' : 'interactive',
      };
    });
}
