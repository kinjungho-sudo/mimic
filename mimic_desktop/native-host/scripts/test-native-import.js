'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const hostPath = path.join(root, 'src', 'host.js');
const dataDir = path.join(root, 'dist', 'native-import-test');
const sessionId = 'desktop-import-test';
const captureDir = path.join(dataDir, 'captures', sessionId);

function encode(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

function decodeAvailable(buffer) {
  const messages = [];
  let pending = buffer;
  while (pending.length >= 4) {
    const length = pending.readUInt32LE(0);
    if (pending.length < length + 4) break;
    messages.push(JSON.parse(pending.subarray(4, length + 4).toString('utf8')));
    pending = pending.subarray(length + 4);
  }
  return { messages, pending };
}

async function main() {
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(captureDir, { recursive: true });
  const image = Buffer.alloc(800 * 1024);
  for (let i = 0; i < image.length; i += 1) image[i] = i % 251;
  const imagePath = path.join(captureDir, 'step-0001-test.png');
  fs.writeFileSync(imagePath, image);
  fs.writeFileSync(path.join(captureDir, 'session.json'), JSON.stringify({
    session_id: sessionId,
    status: 'stopped',
    started_at: '2026-07-16T00:00:00.000Z',
    updated_at: '2026-07-16T00:01:00.000Z',
    captured_steps: 1,
  }));
  fs.writeFileSync(path.join(captureDir, 'events.jsonl'), `${JSON.stringify({
    session_id: sessionId,
    step_number: 1,
    event_type: 'click',
    captured_at: '2026-07-16T00:00:30.000Z',
    click_x: 640,
    click_y: 360,
    normalized_x: 0.5,
    normalized_y: 0.5,
    screen: { left: 0, top: 0, width: 1280, height: 720 },
    screenshot_path: imagePath,
    window_title: '테스트 설정',
    process_name: 'test-app',
    ui_element: {
      name: '저장',
      automation_id: 'SaveButton',
      control_type: 'Button',
      class_name: 'Button',
      left: 600,
      top: 320,
      width: 80,
      height: 40,
    },
  })}\n`);

  const child = spawn(process.execPath, [hostPath], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: { ...process.env, PARRO_DESKTOP_DATA_DIR: dataDir },
  });
  let pending = Buffer.alloc(0);
  const received = [];
  child.stdout.on('data', chunk => {
    const decoded = decodeAvailable(Buffer.concat([pending, chunk]));
    pending = decoded.pending;
    received.push(...decoded.messages);
  });

  child.stdin.write(encode({ type: 'GET_CAPTURE_SESSION', capture_session_id: sessionId, request_id: 'summary' }));
  for (const offset of [0, 384 * 1024, 768 * 1024]) {
    child.stdin.write(encode({
      type: 'READ_CAPTURE_IMAGE_CHUNK',
      capture_session_id: sessionId,
      step_number: 1,
      offset,
      request_id: `chunk-${offset}`,
    }));
  }
  child.stdin.end();
  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', code => code ? reject(new Error(`host exited with ${code}`)) : resolve());
  });

  const summary = received.find(message => message.request_id === 'summary');
  assert.equal(summary?.events?.length, 1);
  assert.equal(summary.events[0].window_title, '테스트 설정');
  assert.equal(summary.events[0].ui_element.name, '저장');
  assert.equal(summary.events[0].ui_element.automation_id, 'SaveButton');
  assert.equal(summary.events[0].screenshot_size, image.length);
  const chunks = received.filter(message => String(message.request_id).startsWith('chunk-'));
  assert.equal(chunks.length, 3);
  const restored = Buffer.concat(chunks.map(message => Buffer.from(message.data, 'base64')));
  assert.deepEqual(restored, image);
  assert.equal(chunks[2].done, true);

  console.log(JSON.stringify({ ok: true, events: summary.events.length, chunks: chunks.length, bytes: restored.length }));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
