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

console.log(JSON.stringify({ ok: true, checks: 5, selected: result.best.element, confidence: result.confidence }));
