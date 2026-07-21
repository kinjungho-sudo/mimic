const assert = require('node:assert/strict');
const { createBuffer } = require('../../mimic_recorder/pre-capture-buffer.js');

const buffer = createBuffer({ maxAgeMs: 1000, maxEntries: 3 });

assert.equal(buffer.put('click-a', { dataUrl: 'frame-a', time: 1000, tabId: 7 }), true);
assert.equal(buffer.put('click-b', { dataUrl: 'frame-b', time: 1010, tabId: 7 }), true);
assert.equal(buffer.get('click-a', 8, { now: 1100 }), null, 'tab mismatch must not reuse a frame');
assert.equal(buffer.get('missing', 7, { now: 1100 }), null, 'capture id mismatch must not reuse a frame');
assert.equal(buffer.get('click-a', 7, { consume: false, now: 1100 })?.dataUrl, 'frame-a');
assert.equal(buffer.get('click-a', 7, { consume: true, now: 1100 })?.dataUrl, 'frame-a');
assert.equal(buffer.get('click-a', 7, { now: 1100 }), null, 'consumed frames must disappear');
assert.equal(buffer.get('click-b', 7, { now: 2500 }), null, 'expired frames must disappear');

buffer.put('one', { dataUrl: '1', time: 3000, tabId: 7 });
buffer.put('two', { dataUrl: '2', time: 3001, tabId: 7 });
buffer.put('three', { dataUrl: '3', time: 3002, tabId: 7 });
buffer.put('four', { dataUrl: '4', time: 3003, tabId: 7 });
assert.equal(buffer.size(), 3, 'buffer must stay bounded');
assert.equal(buffer.get('one', 7, { now: 3003 }), null, 'oldest frame must be evicted');
assert.equal(buffer.get('four', 7, { now: 3003 })?.dataUrl, '4');

console.log(JSON.stringify({ ok: true, cases: 9 }));
