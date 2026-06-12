// ── Offscreen Document — getDisplayMedia 스트림 관리 ──────────────
// Service Worker(background.js)는 getDisplayMedia를 직접 호출할 수 없다.
// 이 문서가 스트림을 보유하고, 캡처 요청마다 프레임을 추출해 dataUrl로 반환한다.

let stream = null;
let videoEl = null;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== 'offscreen') return false;

  if (msg.type === 'START_STREAM') {
    startStream(msg.tabId).then(ok => sendResponse({ ok })).catch(err => {
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }

  if (msg.type === 'CAPTURE_FRAME') {
    captureFrame().then(dataUrl => sendResponse({ dataUrl })).catch(() => {
      sendResponse({ dataUrl: null });
    });
    return true;
  }

  if (msg.type === 'STOP_STREAM') {
    stopStream();
    sendResponse({ ok: true });
    return false;
  }
});

async function startStream(tabId) {
  stopStream();

  // tabId가 있으면 특정 탭만 공유 요청 (사용자가 picker에서 선택)
  const constraints = {
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        ...(tabId ? { chromeMediaSourceId: await getTabStreamId(tabId) } : {}),
      },
    },
    audio: false,
  };

  // tabId 방식 실패 시 일반 getDisplayMedia로 fallback
  try {
    if (tabId) {
      const streamId = await getTabStreamId(tabId);
      stream = await navigator.mediaDevices.getUserMedia({
        video: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
        audio: false,
      });
    } else {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    }
  } catch {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  }

  videoEl = document.createElement('video');
  videoEl.srcObject = stream;
  videoEl.muted = true;
  await videoEl.play();

  // 스트림이 외부에서 끊기면(사용자가 공유 중단) background에 알림
  stream.getVideoTracks()[0].addEventListener('ended', () => {
    stopStream();
    chrome.runtime.sendMessage({ type: 'STREAM_ENDED' }).catch(() => {});
  });

  return true;
}

// chrome.tabCapture.getMediaStreamId — 특정 탭 스트림 ID 획득
function getTabStreamId(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(id);
    });
  });
}

async function captureFrame() {
  if (!videoEl || !stream || !stream.active) return null;

  // 프레임이 준비될 때까지 대기
  if (videoEl.readyState < 2) {
    await new Promise((resolve) => {
      videoEl.addEventListener('canplay', resolve, { once: true });
    });
  }

  const w = videoEl.videoWidth  || 1280;
  const h = videoEl.videoHeight || 800;

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, w, h);

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function stopStream() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
    videoEl = null;
  }
}
