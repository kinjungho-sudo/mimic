// ── Offscreen Document — 화면 스트림 캡처 ──────────────────────────
// background.js가 chrome.desktopCapture.chooseDesktopMedia()로 picker를 띄워
// streamId를 획득한 뒤 이 문서로 전달한다. 여기서는 getUserMedia()로 스트림을
// 열고 캡처 요청마다 프레임을 추출한다. (offscreen은 chrome.* capture API 접근 불가)

let stream  = null;
let videoEl = null;

// ── 음성 녹음 상태 ──────────────────────────────────────────────
let audioStream   = null;
let audioRecorder = null;
let audioChunks   = [];

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

  if (msg.type === 'START_AUDIO') {
    startAudio()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === 'PAUSE_AUDIO') {
    try { if (audioRecorder?.state === 'recording') audioRecorder.pause(); } catch { /**/ }
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'RESUME_AUDIO') {
    try { if (audioRecorder?.state === 'paused') audioRecorder.resume(); } catch { /**/ }
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'STOP_AUDIO') {
    stopAudio()
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch(() => sendResponse({ ok: false, dataUrl: null }));
    return true;
  }
});

// ── 음성 녹음 ────────────────────────────────────────────────────
async function startAudio() {
  await stopAudioTracks();
  audioChunks = [];
  audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // opus/webm — Whisper가 직접 처리 가능. 미지원 시 기본값 폴백.
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
  audioRecorder = mime ? new MediaRecorder(audioStream, { mimeType: mime }) : new MediaRecorder(audioStream);
  audioRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunks.push(e.data); };
  audioRecorder.start(1000);  // 1초 단위 청크 — 중간 종료 시에도 데이터 보존
}

async function stopAudio() {
  if (!audioRecorder) { await stopAudioTracks(); return null; }
  const rec = audioRecorder;
  const done = new Promise((resolve) => { rec.onstop = resolve; });
  try { if (rec.state !== 'inactive') rec.stop(); } catch { /**/ }
  await done;
  const mimeType = rec.mimeType || 'audio/webm';
  await stopAudioTracks();

  if (audioChunks.length === 0) return null;
  const blob = new Blob(audioChunks, { type: mimeType });
  audioChunks = [];
  return blobToDataUrl(blob);
}

async function stopAudioTracks() {
  try { audioStream?.getTracks().forEach((t) => t.stop()); } catch { /**/ }
  audioStream   = null;
  audioRecorder = null;
}

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
