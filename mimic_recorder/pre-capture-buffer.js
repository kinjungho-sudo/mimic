(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ParroPreCapture = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createBuffer({ maxAgeMs = 1500, maxEntries = 12 } = {}) {
    const frames = new Map();

    function prune(now = Date.now()) {
      for (const [captureId, frame] of frames) {
        if (!frame || now - frame.time > maxAgeMs) frames.delete(captureId);
      }
      while (frames.size > maxEntries) frames.delete(frames.keys().next().value);
    }

    function put(captureId, frame) {
      if (!captureId || !frame || frame.tabId == null || !frame.dataUrl) return false;
      const now = Number.isFinite(frame.time) ? frame.time : Date.now();
      prune(now);
      frames.set(String(captureId), { ...frame, time: now });
      prune(now);
      return true;
    }

    function get(captureId, tabId, { consume = false, now = Date.now() } = {}) {
      if (!captureId || tabId == null) return null;
      prune(now);
      const key = String(captureId);
      const frame = frames.get(key);
      if (!frame || frame.tabId !== tabId || now - frame.time > maxAgeMs) return null;
      if (consume) frames.delete(key);
      return frame;
    }

    return {
      put,
      get,
      prune,
      clear: () => frames.clear(),
      size: () => frames.size,
    };
  }

  return { createBuffer };
});
