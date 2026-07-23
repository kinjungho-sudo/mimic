const MIMIC_DESKTOP_HOST = 'com.mimic.desktop_companion.dev';

let _desktopPort = null;
let _desktopConnected = false;
let _desktopLastError = null;
let _desktopVersion = null;
let _desktopRequestSeq = 0;
const _desktopPendingRequests = new Map();

function desktopBridgeStatus() {
  return {
    host: MIMIC_DESKTOP_HOST,
    connected: _desktopConnected,
    lastError: _desktopLastError,
    version: _desktopVersion,
  };
}

function disconnectDesktopPort() {
  const port = _desktopPort;
  _desktopPort = null;
  _desktopConnected = false;
  _desktopVersion = null;
  try {
    if (port) port.disconnect();
  } catch {
    // Ignore disconnect races.
  }
  for (const pending of _desktopPendingRequests.values()) {
    clearTimeout(pending.timer);
    pending.reject(new Error(_desktopLastError || 'desktop_host_disconnected'));
  }
  _desktopPendingRequests.clear();
}

function getDesktopPort() {
  if (_desktopPort) return _desktopPort;

  try {
    _desktopPort = chrome.runtime.connectNative(MIMIC_DESKTOP_HOST);
    _desktopConnected = true;
    _desktopLastError = null;

    _desktopPort.onDisconnect.addListener(() => {
      _desktopConnected = false;
      _desktopVersion = null;
      _desktopLastError = chrome.runtime.lastError?.message || null;
      const disconnectedPort = _desktopPort;
      _desktopPort = null;
      if (disconnectedPort) {
        for (const pending of _desktopPendingRequests.values()) {
          clearTimeout(pending.timer);
          pending.reject(new Error(_desktopLastError || 'desktop_host_disconnected'));
        }
        _desktopPendingRequests.clear();
      }
    });

    _desktopPort.onMessage.addListener((message) => {
      const requestId = message?.request_id;
      if (requestId && _desktopPendingRequests.has(requestId)) {
        const pending = _desktopPendingRequests.get(requestId);
        _desktopPendingRequests.delete(requestId);
        clearTimeout(pending.timer);
        pending.resolve(message);
        return;
      }
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

function requestDesktopMessage(message, timeoutMs = 15000) {
  const port = getDesktopPort();
  if (!port) return Promise.reject(new Error(_desktopLastError || 'desktop_host_unavailable'));
  const requestId = `desktop-${Date.now()}-${++_desktopRequestSeq}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      _desktopPendingRequests.delete(requestId);
      reject(new Error('desktop_host_timeout'));
    }, timeoutMs);
    _desktopPendingRequests.set(requestId, { resolve, reject, timer });
    try {
      port.postMessage({ ...message, request_id: requestId });
    } catch (error) {
      clearTimeout(timer);
      _desktopPendingRequests.delete(requestId);
      reject(error);
    }
  });
}

async function notifyDesktopCaptureStarted({ sessionId, targetTabId, source }) {
  if (!sessionId) return { ok: false, error: 'missing_session_id' };
  return requestDesktopMessage({
    type: 'START_CAPTURE_SESSION',
    capture_session_id: sessionId,
    target_tab_id: targetTabId || null,
    extension_id: chrome.runtime.id,
    source: source || 'recorder',
    started_at: new Date().toISOString(),
  });
}

async function notifyDesktopCaptureStopped({ sessionId, reason }) {
  return requestDesktopMessage({
    type: 'STOP_CAPTURE_SESSION',
    capture_session_id: sessionId || null,
    reason: reason || 'recording_stopped',
    stopped_at: new Date().toISOString(),
  });
}

async function setDesktopCapturePaused({ sessionId, paused }) {
  if (!sessionId) throw new Error('missing_session_id');
  return requestDesktopMessage({
    type: paused ? 'PAUSE_CAPTURE_SESSION' : 'RESUME_CAPTURE_SESSION',
    capture_session_id: sessionId,
  });
}

async function undoDesktopCaptureStep(sessionId) {
  if (!sessionId) throw new Error('missing_session_id');
  return requestDesktopMessage({
    type: 'UNDO_CAPTURE_STEP',
    capture_session_id: sessionId,
  });
}

async function requestDesktopManualCapture(sessionId) {
  if (!sessionId) throw new Error('missing_session_id');
  return requestDesktopMessage({
    type: 'REQUEST_MANUAL_CAPTURE',
    capture_session_id: sessionId,
  });
}

async function markNextDesktopCapturePrivate(sessionId) {
  if (!sessionId) throw new Error('missing_session_id');
  return requestDesktopMessage({
    type: 'MARK_NEXT_CAPTURE_PRIVATE',
    capture_session_id: sessionId,
  });
}

async function updateDesktopToolbarBounds(sessionId, bounds) {
  if (!sessionId) throw new Error('missing_session_id');
  return requestDesktopMessage({
    type: 'UPDATE_TOOLBAR_BOUNDS',
    capture_session_id: sessionId,
    bounds,
  });
}

async function getDesktopCaptureSession(sessionId) {
  if (!sessionId) throw new Error('missing_session_id');
  const response = await requestDesktopMessage({
    type: 'GET_CAPTURE_SESSION',
    capture_session_id: sessionId,
  });
  if (!response?.ok) throw new Error(response?.error || 'desktop_session_read_failed');
  return response;
}

async function readDesktopCaptureImage(sessionId, stepNumber, expectedSize = 0) {
  const parts = [];
  let offset = 0;
  let totalSize = Math.max(0, Number(expectedSize) || 0);
  do {
    const response = await requestDesktopMessage({
      type: 'READ_CAPTURE_IMAGE_CHUNK',
      capture_session_id: sessionId,
      step_number: stepNumber,
      offset,
    }, 30000);
    if (!response?.ok || typeof response.data !== 'string') {
      throw new Error(response?.error || 'desktop_image_read_failed');
    }
    const binary = atob(response.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    parts.push(bytes);
    totalSize = Number(response.total_size) || totalSize;
    offset = Number(response.next_offset) || (offset + bytes.length);
    if (response.done) break;
    if (!bytes.length || (totalSize && offset > totalSize)) throw new Error('invalid_desktop_image_chunk');
  } while (!totalSize || offset < totalSize);
  return new Blob(parts, { type: 'image/png' });
}

async function pingDesktopCompanion() {
  const response = await requestDesktopMessage({
    type: 'PING',
    extension_id: chrome.runtime.id,
    sent_at: new Date().toISOString(),
  });
  if (response?.ok) {
    _desktopVersion = typeof response.version === 'string' ? response.version : null;
  }
  return response;
}
