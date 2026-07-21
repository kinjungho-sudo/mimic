import assert from 'node:assert/strict';
import { buildStepShareUrl, resolveSharedStepIndex } from '../lib/share-links.ts';

const stableStepId = 'step-2-id';
const steps = [{ id: 'step-1-id' }, { id: stableStepId }, { id: 'step-3-id' }];

assert.equal(
  buildStepShareUrl('https://parro.example/play/token?mode=follow', stableStepId),
  `https://parro.example/play/token?mode=follow&step=${stableStepId}`,
  'step links must preserve the selected viewer mode',
);
assert.equal(
  buildStepShareUrl('https://parro.example/play/token?step=old', stableStepId),
  `https://parro.example/play/token?step=${stableStepId}`,
  'copying another step must replace the prior target',
);
assert.equal(resolveSharedStepIndex(stableStepId, steps), 1, 'stable step ids must resolve to their current order');
assert.equal(resolveSharedStepIndex('2', steps), 1, 'legacy 1-based step links must remain compatible');
assert.equal(resolveSharedStepIndex('99', steps), null, 'out-of-range numeric links must fail closed');
assert.equal(resolveSharedStepIndex('missing', steps), null, 'unknown step ids must fail closed');

console.log(JSON.stringify({ ok: true, checks: 6, scope: 'share-links' }));
