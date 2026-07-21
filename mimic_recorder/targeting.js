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

  function normalizeText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  function textSimilarity(left, right) {
    const a = normalizeText(left);
    const b = normalizeText(right);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) {
      return Math.max(0.68, Math.min(a.length, b.length) / Math.max(a.length, b.length));
    }
    const aTokens = new Set(a.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
    const bTokens = new Set(b.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
    if (!aTokens.size || !bTokens.size) return 0;
    let overlap = 0;
    aTokens.forEach(token => { if (bTokens.has(token)) overlap += 1; });
    return overlap / (aTokens.size + bTokens.size - overlap);
  }

  // Replay targets are accepted only when multiple independent signals agree.
  // This intentionally favors hiding guidance over highlighting a plausible but wrong element.
  function scoreReplayFacts(facts) {
    if (!facts || !facts.visible || facts.disabled) return -1000;
    let score = 0;
    if (facts.exactSelector) score += 28;
    if (facts.uniqueSelector) score += 14;
    if (facts.stableSelector) score += 24;
    if (facts.xpathMatch) score += 22;
    if (facts.fuzzyMatch) score += 6;
    if (facts.manualTarget) score += 18;
    if (facts.interactive) score += 12;
    if (facts.stableAttribute) score += 8;
    score += Math.max(0, Math.min(1, finite(facts.accessibleSimilarity))) * 34;
    score += Math.max(0, Math.min(1, finite(facts.contextSimilarity))) * 12;
    score += Math.max(0, Math.min(1, finite(facts.geometrySimilarity))) * 24;
    score += Math.max(0, Math.min(1, finite(facts.pageTitleSimilarity))) * 6;
    score += Math.max(0, Math.min(1, finite(facts.aiConfidence))) * 20;
    if (facts.areaRatio > 0.5) score -= 60;
    else if (facts.areaRatio > 0.3) score -= 30;
    if (facts.areaRatio < 0.00001) score -= 18;
    return score;
  }

  function chooseReplayTarget(candidates) {
    const scored = (candidates || [])
      .map(candidate => ({ ...candidate, score: scoreReplayFacts(candidate.facts) }))
      .sort((a, b) => b.score - a.score || rectArea(a.rect) - rectArea(b.rect));
    const best = scored[0] || null;
    const runnerUp = scored[1] || null;
    const margin = best ? best.score - (runnerUp?.score ?? 0) : 0;
    const unambiguous = !runnerUp || margin >= 10;
    const confidence = !best || best.score < 58 || !unambiguous
      ? 'low'
      : (best.score >= 72 && (!runnerUp || margin >= 12) ? 'high' : 'medium');
    return {
      best,
      runnerUp,
      confidence,
      margin,
      approved: confidence !== 'low',
      scored,
    };
  }

  return {
    chooseReplayTarget,
    chooseTarget,
    normalizeText,
    pickBestClientRect,
    rectContainsPoint,
    scoreReplayFacts,
    scoreTargetFacts,
    textSimilarity,
  };
});
