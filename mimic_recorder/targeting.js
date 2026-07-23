(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ParroTargeting = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function finite(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function rectArea(rect) {
    return Math.max(0, finite(rect?.width)) * Math.max(0, finite(rect?.height));
  }

  function rectContainsPoint(rect, x, y, tolerance = 1) {
    if (!rect) return false;
    const left = finite(rect.left, finite(rect.x));
    const top = finite(rect.top, finite(rect.y));
    const right = left + Math.max(0, finite(rect.width));
    const bottom = top + Math.max(0, finite(rect.height));
    return x >= left - tolerance && x <= right + tolerance && y >= top - tolerance && y <= bottom + tolerance;
  }

  function copyRect(rect) {
    const left = finite(rect?.left, finite(rect?.x));
    const top = finite(rect?.top, finite(rect?.y));
    return {
      x: left,
      y: top,
      left,
      top,
      width: Math.max(0, finite(rect?.width)),
      height: Math.max(0, finite(rect?.height)),
    };
  }

  function pickBestClientRect(rects, x, y) {
    const visible = Array.from(rects || [])
      .map(copyRect)
      .filter(rect => rect.width > 0 && rect.height > 0);
    if (!visible.length) return null;

    const containing = visible.filter(rect => rectContainsPoint(rect, x, y, 2));
    const candidates = containing.length ? containing : visible;
    return candidates.reduce((best, rect) => (
      !best || rectArea(rect) < rectArea(best) ? rect : best
    ), null);
  }

  function scoreTargetFacts(facts) {
    if (!facts || !facts.visible || facts.disabled) return -1000;
    let score = 0;
    if (facts.nativeInteractive) score += 44;
    if (facts.semanticRole) score += 34;
    if (facts.hasClickHandler) score += 22;
    if (facts.pointerCursor) score += 12;
    if (facts.containsClick) score += 30;
    if (facts.accessibleName) score += Math.min(18, 6 + String(facts.accessibleName).length / 4);
    if (facts.stableAttribute) score += 12;
    if (facts.exactEventTarget) score += 5;
    if (facts.iconOnly) score -= 14;
    if (facts.areaRatio > 0.5) score -= 36;
    else if (facts.areaRatio > 0.25) score -= 18;
    if (facts.areaRatio < 0.00002) score -= 20;
    if (facts.depthFromTarget > 5) score -= (facts.depthFromTarget - 5) * 3;
    return score;
  }

  function chooseTarget(candidates) {
    const scored = (candidates || [])
      .map(candidate => ({ ...candidate, score: scoreTargetFacts(candidate.facts) }))
      .sort((a, b) => b.score - a.score || rectArea(a.rect) - rectArea(b.rect));
    const best = scored[0] || null;
    const runnerUp = scored[1] || null;
    const margin = best ? best.score - (runnerUp?.score ?? 0) : 0;
    const confidence = !best || best.score < 35
      ? 'low'
      : (best.score >= 70 && margin >= 8 ? 'high' : 'medium');
    return { best, runnerUp, confidence, margin, scored };
  }

  return {
    chooseTarget,
    pickBestClientRect,
    rectContainsPoint,
    scoreTargetFacts,
  };
});
