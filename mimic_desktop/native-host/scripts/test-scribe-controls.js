const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const hostPath = path.join(root, 'src', 'host.js');
const dataDir = path.join(root, 'dist', 'scribe-controls-test');
const sessionId = 'scribe-controls-test';
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
  fs.mkdirSync(dataDir, { recursive: true });
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

  const messages = [
    { type: 'START_CAPTURE_SESSION', capture_session_id: sessionId, request_id: 'start' },
    { type: 'MARK_NEXT_CAPTURE_PRIVATE', capture_session_id: sessionId, request_id: 'blur' },
    { type: 'REQUEST_MANUAL_CAPTURE', capture_session_id: sessionId, request_id: 'manual' },
    { type: 'UPDATE_TOOLBAR_BOUNDS', capture_session_id: sessionId, bounds: { left: 10, top: 20, right: 220, bottom: 80 }, request_id: 'bounds' },
    { type: 'STOP_CAPTURE_SESSION', capture_session_id: sessionId, request_id: 'stop' },
  ];
  for (const message of messages) child.stdin.write(encode(message));
  child.stdin.end();

  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', code => code ? reject(new Error(`host exited with ${code}`)) : resolve());
  });

  const byId = Object.fromEntries(received.filter(message => message.request_id).map(message => [message.request_id, message]));
  assert.equal(byId.start?.type, 'CAPTURE_SESSION_STARTED');
  assert.equal(byId.blur?.type, 'NEXT_CAPTURE_MARKED_PRIVATE');
  assert.equal(byId.manual?.type, 'MANUAL_CAPTURE_REQUESTED');
  assert.equal(byId.bounds?.type, 'TOOLBAR_BOUNDS_UPDATED');
  assert.equal(byId.stop?.type, 'CAPTURE_SESSION_STOPPED');

  assert.equal(fs.existsSync(path.join(captureDir, '.blur-next')), true, 'blur marker should be written for the capture agent');
  assert.equal(fs.existsSync(path.join(captureDir, '.manual-capture')), true, 'manual marker should be written for the capture agent');
  const bounds = JSON.parse(fs.readFileSync(path.join(captureDir, '.toolbar-bounds.json'), 'utf8'));
  assert.deepEqual(bounds, { left: 10, top: 20, right: 220, bottom: 80 });

  console.log(JSON.stringify({ ok: true, scribe_controls: ['mark-private-next', 'manual-capture', 'toolbar-bounds'], captureDir }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
