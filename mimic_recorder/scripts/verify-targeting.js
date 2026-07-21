'use strict';

const assert = require('node:assert/strict');
const targeting = require('../targeting.js');

const lineRects = [
  { left: 10, top: 10, width: 180, height: 20 },
  { left: 10, top: 34, width: 90, height: 20 },
];
assert.deepEqual(
  targeting.pickBestClientRect(lineRects, 42, 42),
  { x: 10, y: 34, left: 10, top: 34, width: 90, height: 20 },
  'multi-line targets must use the clicked client rect',
);

const result = targeting.chooseTarget([
  {
    element: 'icon',
    rect: { left: 20, top: 20, width: 12, height: 12 },
    facts: { visible: true, containsClick: true, exactEventTarget: true, iconOnly: true, areaRatio: 0.0001, depthFromTarget: 0 },
  },
  {
    element: 'button',
    rect: { left: 12, top: 12, width: 120, height: 40 },
    facts: { visible: true, containsClick: true, nativeInteractive: true, accessibleName: '저장', stableAttribute: true, areaRatio: 0.01, depthFromTarget: 1 },
  },
  {
    element: 'card',
    rect: { left: 0, top: 0, width: 1200, height: 700 },
    facts: { visible: true, containsClick: true, pointerCursor: true, accessibleName: '설정 카드', areaRatio: 0.72, depthFromTarget: 3 },
  },
]);

assert.equal(result.best.element, 'button', 'semantic control must beat icon child and oversized clickable card');
assert.equal(result.confidence, 'high');
assert.equal(targeting.rectContainsPoint({ left: 5, top: 5, width: 20, height: 20 }, 25, 25), true);

assert.equal(targeting.textSimilarity('새로 만들기', '  새로   만들기 '), 1);

const replay = targeting.chooseReplayTarget([
  {
    element: 'recorded-button',
    rect: { left: 900, top: 20, width: 120, height: 40 },
    facts: {
      visible: true,
      interactive: true,
      exactSelector: true,
      uniqueSelector: true,
      stableSelector: true,
      accessibleSimilarity: 1,
      geometrySimilarity: 0.95,
      areaRatio: 0.005,
    },
  },
  {
    element: 'screenshot-card',
    rect: { left: 300, top: 300, width: 480, height: 270 },
    facts: {
      visible: true,
      interactive: false,
      geometrySimilarity: 0.7,
      areaRatio: 0.18,
    },
  },
]);
assert.equal(replay.approved, true);
assert.equal(replay.best.element, 'recorded-button');

const ambiguous = targeting.chooseReplayTarget([
  { element: 'first', rect: { left: 0, top: 0, width: 100, height: 30 }, facts: { visible: true, interactive: true, accessibleSimilarity: 1, geometrySimilarity: 0.8, areaRatio: 0.01 } },
  { element: 'second', rect: { left: 0, top: 40, width: 100, height: 30 }, facts: { visible: true, interactive: true, accessibleSimilarity: 1, geometrySimilarity: 0.78, areaRatio: 0.01 } },
]);
assert.equal(ambiguous.approved, false, 'ambiguous replay candidates must fail closed');

const coordinateOnly = targeting.chooseReplayTarget([
  { element: 'image-card', rect: { left: 0, top: 0, width: 600, height: 350 }, facts: { visible: true, geometrySimilarity: 1, areaRatio: 0.24 } },
]);
assert.equal(coordinateOnly.approved, false, 'coordinate-only fallback must not create a live target');

console.log(JSON.stringify({ ok: true, checks: 11, selected: result.best.element, confidence: result.confidence }));
