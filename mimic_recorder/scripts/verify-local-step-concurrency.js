'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backgroundPath = path.resolve(__dirname, '..', 'background.js');
const background = fs.readFileSync(backgroundPath, 'utf8');
const sectionStart = background.indexOf('// ── 로컬 스텝 저장');
const sectionEnd = background.indexOf('// ── sessionId 가져오기', sectionStart);

assert.ok(sectionStart >= 0 && sectionEnd > sectionStart, 'local step storage section must be present');

const localStepStorageSource = background.slice(sectionStart, sectionEnd);
const createLocalStepStorage = new Function(
  'storageGet',
  'storageSet',
  'pushUndo',
  `${localStepStorageSource}\nreturn { saveStepLocally };`,
);

function clone(value) {
  return structuredClone(value);
}

async function runConcurrentSaveScenario() {
  const state = {
    steps: [],
    sessionId: 'session_test',
    _undoStack: [],
  };
  let pendingReads = [];

  function storageGet(keys) {
    const names = Array.isArray(keys) ? keys : [keys];
    const snapshot = Object.fromEntries(names.map((name) => [name, clone(state[name])]));
    return new Promise((resolve) => {
      pendingReads.push(() => resolve(snapshot));
    });
  }

  async function storageSet(values) {
    Object.assign(state, clone(values));
  }

  async function pushUndo(action) {
    const { _undoStack } = await storageGet('_undoStack');
    const stack = _undoStack || [];
    stack.push(action);
    await storageSet({ _undoStack: stack });
  }

  const { saveStepLocally } = createLocalStepStorage(storageGet, storageSet, pushUndo);
  let settled = 0;
  const saves = [1, 2].map((stepNumber) => saveStepLocally({
    stepNumber,
    url: `https://example.test/step-${stepNumber}`,
    timestamp: stepNumber,
    imageUrl: `https://example.test/step-${stepNumber}.jpg`,
  }).finally(() => {
    settled += 1;
  }));

  for (let turn = 0; settled < saves.length && turn < 20; turn += 1) {
    await Promise.resolve();
    const releases = pendingReads;
    pendingReads = [];
    releases.forEach((release) => release());
    await Promise.resolve();
    await Promise.resolve();
  }

  await Promise.all(saves);
  return state;
}

async function runRecoveryScenario() {
  const state = { steps: [], sessionId: 'session_test', _undoStack: [] };
  let failNextStepWrite = true;

  async function storageGet(keys) {
    const names = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(names.map((name) => [name, clone(state[name])]));
  }

  async function storageSet(values) {
    if (failNextStepWrite && Object.hasOwn(values, 'steps')) {
      failNextStepWrite = false;
      throw new Error('synthetic local write failure');
    }
    Object.assign(state, clone(values));
  }

  async function pushUndo(action) {
    const { _undoStack } = await storageGet('_undoStack');
    const stack = _undoStack || [];
    stack.push(action);
    await storageSet({ _undoStack: stack });
  }

  const { saveStepLocally } = createLocalStepStorage(storageGet, storageSet, pushUndo);
  await assert.rejects(saveStepLocally({ stepNumber: 1, url: 'https://example.test/failed' }));
  await saveStepLocally({ stepNumber: 2, url: 'https://example.test/recovered' });
  return state;
}

(async () => {
  const state = await runConcurrentSaveScenario();
  assert.deepEqual(state.steps.map((step) => step.stepNumber), [1, 2]);
  assert.equal(state._undoStack.length, 2);
  assert.deepEqual(
    state._undoStack.map((action) => action.stepId),
    state.steps.map((step) => step.id),
  );
  const recovered = await runRecoveryScenario();
  assert.deepEqual(recovered.steps.map((step) => step.stepNumber), [2]);
  assert.equal(recovered._undoStack.length, 1);

  console.log(JSON.stringify({
    ok: true,
    steps: state.steps.map((step) => step.stepNumber),
    undoEntries: state._undoStack.length,
    recoveredAfterWriteFailure: true,
    liveCapture: false,
    externalWrites: false,
  }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
