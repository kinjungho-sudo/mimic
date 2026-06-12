// ── Offscreen Document — 화면 스트림 캡처 ──────────────────────────
// background.js가 chrome.desktopCapture.chooseDesktopMedia()로 picker를 띄워
// streamId를 획득한 뒤 이 문서로 전달한다. 여기서는 getUserMedia()로 스트림을
// 열고 캡처 요청마다 프레임을 추출한다. (offscreen은 chrome.* capture API 접근 불가)

let stream  = null;
let videoEl = null;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== 'offscreen') return false;

  if (msg.type === 'START_STREAM') {
    startStream(msg.streamId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === 'CAPTURE_FRAME') {
    captureFrame()
      .then((dataUrl) => sendResponse({ dataUrl }))
      .catch(() => sendResponse({ dataUrl: null }));
    return true;
  }

  if (msg.type === 'STOP_STREAM') {
    stopStream();
    sendResponse({ ok: true });
    return false;
  }
});

async function startStream(streamId) {
  stopStream();

  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      mandatory: {
        chromeMediaSource:   'desktop',
        chromeMediaSourceId: streamId,
      },
    },
    audio: false,
  });

  videoEl = document.createElement('video');
  videoEl.srcObject = stream;
  videoEl.muted     = true;
  await videoEl.play();

  // 사용자가 브라우저 상단 "공유 중단" 버튼을 누르면 background에 알림
  stream.getVideoTracks()[0].addEventListener('ended', () => {
    stopStream();
    chrome.runtime.sendMessage({ type: 'STREAM_ENDED' }).catch(() => {});
  });
}

async function captureFrame() {
  if (!videoEl || !stream?.active) return null;

  if (videoEl.readyState < 2) {
    await new Promise((resolve) => {
      videoEl.addEventListener('canplay', resolve, { once: true });
    });
  }

  const w = videoEl.videoWidth  || 1280;
  const h = videoEl.videoHeight || 800;

  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext('2d').drawImage(videoEl, 0, 0, w, h);

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function stopStream() {
  stream?.getTracks().forEach((t) => t.stop());
  stream  = null;
  if (videoEl) { videoEl.srcObject = null; videoEl = null; }
}
