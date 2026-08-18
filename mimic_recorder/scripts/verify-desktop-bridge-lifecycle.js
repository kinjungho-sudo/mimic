'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createEvent() {
  let listener = null;
  return {
    addListener(nextListener) {
      listener = nextListener;
    },
    emit(value) {
      listener?.(value);
    },
  };
}

function createPort() {
  return {
    onDisconnect: createEvent(),
    onMessage: createEvent(),
    posted: [],
    disconnect() {},
    postMessage(message) {
      this.posted.push(message);
    },
  };
}

async function main() {
  const ports = [];
  const timers = [];
  const chrome = {
    runtime: {
      id: 'test-extension',
      lastError: null,
      connectNative() {
        const port = createPort();
        ports.push(port);
        return port;
      },
    },
  };
  const context = vm.createContext({
    chrome,
    console,
    Date,
    Error,
    Promise,
    clearTimeout(timer) {
      timer.cleared = true;
    },
    setTimeout(callback) {
      const timer = { callback, cleared: false };
      timers.push(timer);
      return timer;
    },
  });
  const bridgePath = process.env.PARRO_DESKTOP_BRIDGE_PATH
    ? path.resolve(process.env.PARRO_DESKTOP_BRIDGE_PATH)
    : path.resolve(__dirname, '..', 'desktop-bridge.js');
  vm.runInContext(fs.readFileSync(bridgePath, 'utf8'), context, { filename: bridgePath });

  const first = vm.runInContext("requestDesktopMessage({ type: 'FIRST' }, 1)", context);
  assert.equal(ports.length, 1);
  timers[0].callback();
  await assert.rejects(first, /desktop_host_timeout/);

  const second = vm.runInContext("requestDesktopMessage({ type: 'SECOND' }, 1)", context);
  assert.equal(ports.length, 2, 'retry must connect a replacement port');
  const secondRequestId = ports[1].posted[0].request_id;

  chrome.runtime.lastError = { message: 'old_port_closed' };
  ports[0].onDisconnect.emit();
  chrome.runtime.lastError = null;
  assert.equal(vm.runInContext('desktopBridgeStatus().connected', context), true);

  ports[1].onMessage.emit({ request_id: secondRequestId, ok: true });
  assert.deepEqual(await second, { request_id: secondRequestId, ok: true });
  assert.equal(vm.runInContext('desktopBridgeStatus().connected', context), true);

  console.log(JSON.stringify({
    ok: true,
    checks: 5,
    portsCreated: ports.length,
    liveNativeHost: false,
    osMutation: false,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
