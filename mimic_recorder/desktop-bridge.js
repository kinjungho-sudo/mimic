const MIMIC_DESKTOP_HOST = 'com.mimic.desktop_companion.dev';

let _desktopPort = null;
let _desktopConnected = false;
let _desktopLastError = null;

function desktopBridgeStatus() {
  return {
    host: MIMIC_DESKTOP_HOST,
    connected: _desktopConnected,
    lastError: _desktopLastError,
  };
}

function disconnectDesktopPort() {
  if (!_desktopPort) return;
  try {
    _desktopPort.disconnect();
  } catch {
    // Ignore disconnect races.
  }
  _desktopPort = null;
  _desktopConnected = false;
}

function getDesktopPort() {
  if (_desktopPort) return _desktopPort;

  try {
    _desktopPort = chrome.runtime.connectNative(MIMIC_DESKTOP_HOST);
    _desktopConnected = true;
    _desktopLastError = null;

    _desktopPort.onDisconnect.addListener(() => {
      _desktopConnected = false;
      _desktopLastError = chrome.runtime.lastError?.message || null;
      _desktopPort = null;
    });

    _desktopPort.onMessage.addListener((message) => {
      if (typeof log === 'function') {
        log('info', 'desktop', 'native host response:', message);
      }
    });
  } catch (error) {
    _desktopConnected = false;
    _desktopLastError = error?.message || 'connect_native_failed';
    _desktopPort = null;
  }

  return _desktopPort;
}

async function postDesktopMessage(message) {
  const port = getDesktopPort();
  if (!port) return { ok: false, error: _desktopLastError || 'desktop_host_unavailable' };

  try {
    port.postMessage(message);
    return { ok: true };
  } catch (error) {
    _desktopLastError = error?.message || 'desktop_post_failed';
    disconnectDesktopPort();
    return { ok: false, error: _desktopLastError };
  }
}

async function notifyDesktopCaptureStarted({ sessionId, targetTabId, source }) {
  if (!sessionId) return { ok: false, error: 'missing_session_id' };
  return postDesktopMessage({
    type: 'START_CAPTURE_SESSION',
    capture_session_id: sessionId,
    target_tab_id: targetTabId || null,
    extension_id: chrome.runtime.id,
    source: source || 'recorder',
    started_at: new Date().toISOString(),
  });
}

async function notifyDesktopCaptureStopped({ sessionId, reason }) {
  return postDesktopMessage({
    type: 'STOP_CAPTURE_SESSION',
    capture_session_id: sessionId || null,
    reason: reason || 'recording_stopped',
    stopped_at: new Date().toISOString(),
  });
}

async function pingDesktopCompanion() {
  return postDesktopMessage({
    type: 'PING',
    extension_id: chrome.runtime.id,
    sent_at: new Date().toISOString(),
  });
}

