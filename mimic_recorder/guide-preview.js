'use strict';

const t = globalThis.ParroI18n?.t || ((_, fallback) => fallback);
const titleEl = document.getElementById('previewTitle');
const canvasEl = document.getElementById('previewCanvas');
const imageEl = document.getElementById('previewImage');
const annotationsEl = document.getElementById('previewAnnotations');
const errorEl = document.getElementById('error');
const closeBtn = document.getElementById('closePreview');
let objectUrl = null;

document.title = t('previewWindowTitle', 'Parro 미리보기');
titleEl.textContent = document.title;
closeBtn.textContent = t('close', '닫기');
closeBtn.addEventListener('click', () => window.close());

function renderAnnotations(annotations) {
  annotationsEl.replaceChildren();
  if (!Array.isArray(annotations)) return;
  annotations.forEach((annotation) => {
    const x1 = Number(annotation?.x1), y1 = Number(annotation?.y1);
    const x2 = Number(annotation?.x2), y2 = Number(annotation?.y2);
    if (![x1, y1, x2, y2].every(Number.isFinite)) return;
    const colorValue = String(annotation.color || annotation.borderColor || '').trim();
    const color = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(colorValue)
      || /^rgba?\([\d\s.,%]+\)$/i.test(colorValue) ? colorValue : '#EF4444';
    const rawStroke = Number(annotation.strokeWidth);
    const stroke = Number.isFinite(rawStroke) ? Math.max(0, Math.min(8, rawStroke)) : 3;
    const left = Math.max(0, Math.min(x1, x2));
    const top = Math.max(0, Math.min(y1, y2));
    const width = Math.max(1, Math.abs(x2 - x1));
    const height = Math.max(1, Math.abs(y2 - y1));
    const element = document.createElement('span');
    Object.assign(element.style, { position: 'absolute', boxSizing: 'border-box', pointerEvents: 'none' });

    if (annotation.type === 'text') {
      Object.assign(element.style, {
        left: `${left}%`, top: `${top}%`, minWidth: '72px', maxWidth: '70%', padding: '6px 8px',
        border: '1px solid rgba(255,255,255,.24)', borderRadius: '8px', background: 'rgba(17,24,39,.88)',
        color: '#fff', fontSize: '12px', lineHeight: '1.35',
      });
      element.textContent = String(annotation.text || '');
    } else if (annotation.type === 'marker') {
      Object.assign(element.style, {
        left: `${x1}%`, top: `${y1}%`, width: '24px', height: '24px', transform: 'translate(-50%,-50%)',
        borderRadius: '50%', background: color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: '800',
      });
      element.textContent = String(annotation.markerNumber || '');
    } else if (annotation.type === 'arrow' || annotation.type === 'line') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' });
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', String(Math.max(1, stroke)));
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      line.setAttribute('stroke-linecap', 'round');
      if (annotation.type === 'arrow') {
        const markerId = `parro-preview-arrow-${Math.random().toString(36).slice(2, 10)}`;
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', markerId);
        marker.setAttribute('markerWidth', '8');
        marker.setAttribute('markerHeight', '8');
        marker.setAttribute('refX', '7');
        marker.setAttribute('refY', '4');
        marker.setAttribute('orient', 'auto');
        marker.setAttribute('markerUnits', 'strokeWidth');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M0,0 L8,4 L0,8 Z');
        path.setAttribute('fill', color);
        marker.appendChild(path);
        defs.appendChild(marker);
        svg.appendChild(defs);
        line.setAttribute('marker-end', `url(#${markerId})`);
      }
      svg.appendChild(line);
      annotationsEl.appendChild(svg);
      return;
    } else {
      Object.assign(element.style, {
        left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
        border: `${stroke}px solid ${color}`,
        borderRadius: annotation.type === 'ellipse' ? '999px' : annotation.type === 'roundedRect' ? '10px' : '6px',
        background: annotation.type === 'spotlight' ? 'transparent' : 'rgba(239,68,68,.08)',
        boxShadow: annotation.type === 'spotlight' ? '0 0 0 9999px rgba(0,0,0,.42),0 0 0 2px rgba(255,255,255,.75)' : 'none',
      });
    }
    annotationsEl.appendChild(element);
  });
}

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
    renderAnnotations(payload.annotations);
    imageEl.addEventListener('error', showError, { once: true });
  } catch {
    showError();
  }
}

window.addEventListener('unload', () => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});

function showError() {
  canvasEl.style.display = 'none';
  errorEl.style.display = 'block';
}

void loadPreview();
