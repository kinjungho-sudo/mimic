'use strict';

const t = globalThis.ParroI18n?.t || ((_, fallback) => fallback);
const titleEl = document.getElementById('previewTitle');
const imageEl = document.getElementById('previewImage');
const errorEl = document.getElementById('error');
const closeBtn = document.getElementById('closePreview');

document.title = t('previewWindowTitle', 'Parro 미리보기');
titleEl.textContent = document.title;
closeBtn.textContent = t('close', '닫기');
closeBtn.addEventListener('click', () => window.close());

async function loadPreview() {
  const key = new URLSearchParams(window.location.search).get('key');
  if (!key?.startsWith('parroGuidePreview:')) {
    showError();
    return;
  }

  try {
    const stored = await chrome.storage.local.get(key);
    const payload = stored[key];
    await chrome.storage.local.remove(key);
    if (!payload?.screenshotUrl) {
      showError();
      return;
    }

    titleEl.textContent = payload.title || document.title;
    imageEl.alt = payload.title || document.title;
    imageEl.src = payload.screenshotUrl;
    imageEl.addEventListener('error', showError, { once: true });
  } catch {
    showError();
  }
}

function showError() {
  imageEl.style.display = 'none';
  errorEl.style.display = 'block';
}

void loadPreview();
