import assert from 'node:assert/strict';

import {
  removeUnsupportedCaptureColumns,
  writeWithCaptureSchemaCompatibility,
} from '../lib/capture/schema-compat.ts';

const completeRow = {
  session_id: 'session-id',
  step_number: 1,
  screenshot_url: 'https://example.com/step.png',
  action_info: { type: 'click' },
  target_context: { accessibleName: '저장' },
  step_type: 'normal_interactive_step',
  capture_source: 'auto',
  capture_failure_reason: null,
};

const attempts = [];
const result = await writeWithCaptureSchemaCompatibility(completeRow, async candidate => {
  attempts.push(structuredClone(candidate));

  if ('target_context' in candidate) {
    return {
      data: null,
      error: {
        code: 'PGRST204',
        message: "Could not find the 'target_context' column of 'mm_capture_events' in the schema cache",
      },
    };
  }

  if ('step_type' in candidate) {
    return {
      data: null,
      error: {
        code: 'PGRST204',
        message: "Could not find the 'step_type' column of 'mm_capture_events' in the schema cache",
      },
    };
  }

  return { data: { id: 'saved-step' }, error: null };
});

assert.equal(result.error, null);
assert.equal(attempts.length, 3);
assert.ok('target_context' in attempts[0]);
assert.ok(!('target_context' in attempts[1]));
assert.ok('step_type' in attempts[1]);
assert.ok(!('step_type' in attempts[2]));
assert.ok(!('capture_source' in attempts[2]));
assert.ok(!('capture_failure_reason' in attempts[2]));
assert.deepEqual(attempts[2].action_info, completeRow.action_info);
assert.equal(attempts[2].screenshot_url, completeRow.screenshot_url);

const actionInfoFallback = removeUnsupportedCaptureColumns(completeRow, {
  code: 'PGRST204',
  message: "Could not find the 'action_info' column of 'mm_capture_events' in the schema cache",
});
assert.equal(actionInfoFallback.removed, true);
assert.ok(!('action_info' in actionInfoFallback.row));
assert.ok('target_context' in actionInfoFallback.row);

const bulkAttempts = [];
const bulkResult = await writeWithCaptureSchemaCompatibility([completeRow, completeRow], async candidate => {
  bulkAttempts.push(structuredClone(candidate));
  if ('step_type' in candidate[0]) {
    return {
      error: {
        code: 'PGRST204',
        message: "Could not find the 'step_type' column of 'mm_steps' in the schema cache",
      },
    };
  }
  return { error: null };
});
assert.equal(bulkResult.error, null);
assert.equal(bulkAttempts.length, 2);
assert.ok(bulkAttempts[1].every(row => !('step_type' in row)));

let unknownErrorAttempts = 0;
const unknownError = await writeWithCaptureSchemaCompatibility(completeRow, async () => {
  unknownErrorAttempts += 1;
  return { error: { code: '23503', message: 'Foreign key violation' } };
});
assert.equal(unknownError.error?.code, '23503');
assert.equal(unknownErrorAttempts, 1);

console.log(JSON.stringify({
  ok: true,
  contract: 'capture-schema-compatibility-retries',
  checks: 17,
}));
