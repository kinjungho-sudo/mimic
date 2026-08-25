'use strict';

const t = globalThis.ParroI18n?.t || ((_, fallback) => fallback);
const titleEl = document.getElementById('previewTitle');
const imageEl = document.getElementById('previewImage');
const errorEl = document.getElementById('error');
const closeBtn = document.getElementById('closePreview');
let objectUrl = null;

document.title = t('previewWindowTitle', 'Parro 미리보기');
titleEl.textContent = document.title;
closeBtn.textContent = t('close', '닫기');
closeBtn.addEventListener('click', () => window.close());

function getStoredScreenshot(stepNumber) {
  return new Promise((resolve) => {
    const req = indexedDB.open('mimic_screenshots', 1);
    req.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction('screenshots', 'readonly');
      const get = tx.objectStore('screenshots').get(stepNumber);
      get.onsuccess = () => { db.close(); resolve(get.result ?? null); };
      get.onerror = () => { db.close(); resolve(null); };
    };
    req.onerror = () => resolve(null);
  });
}

async function loadPreview() {
  const key = new URLSearchParams(window.location.search).get('key');
  if (!key || (!key.startsWith('parroGuidePreview:') && !key.startsWith('parroImagePreview:'))) {
    showError();
    return;
  }

  try {
    const stored = await chrome.storage.local.get(key);
    const payload = stored[key];
    await chrome.storage.local.remove(key);
    if (!payload?.screenshotUrl && !Number.isFinite(payload?.stepNumber)) {
      showError();
      return;
    }

    titleEl.textContent = payload.title || document.title;
    imageEl.alt = payload.title || document.title;
    const blob = Number.isFinite(payload.stepNumber)
      ? await getStoredScreenshot(payload.stepNumber)
      : null;
    if (blob instanceof Blob) {
      objectUrl = URL.createObjectURL(blob);
      imageEl.src = objectUrl;
    } else if (payload.screenshotUrl) {
      imageEl.src = payload.screenshotUrl;
    } else {
      showError();
      return;
    }
    imageEl.addEventListener('error', showError, { once: true });
  } catch {
    showError();
  }
}

window.addEventListener('unload', () => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});

function showError() {
  imageEl.style.display = 'none';
  errorEl.style.display = 'block';
}

void loadPreview();
