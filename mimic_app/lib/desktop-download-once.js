const activeDownloads = new WeakMap();

/**
 * @param {HTMLButtonElement} button
 * @param {{ href: string; filename: string; lockMs?: number; onLockChange?: (locked: boolean) => void }} options
 * @returns {boolean}
 */
export function startDesktopDownloadOnce(button, options) {
  if (activeDownloads.has(button) || button.disabled) return false;

  const lockMs = Number.isFinite(options.lockMs) ? Math.max(500, options.lockMs) : 4_000;
  button.disabled = true;
  button.dataset.downloadLocked = 'true';
  options.onLockChange?.(true);

  const anchor = document.createElement('a');
  anchor.href = options.href;
  anchor.download = options.filename;
  anchor.hidden = true;
  anchor.dataset.parroDownloadTrigger = 'true';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  const timerId = window.setTimeout(() => {
    activeDownloads.delete(button);
    button.disabled = false;
    button.dataset.downloadLocked = 'false';
    options.onLockChange?.(false);
  }, lockMs);
  activeDownloads.set(button, timerId);
  return true;
}

/** @param {HTMLButtonElement | null | undefined} button */
export function releaseDesktopDownloadLock(button) {
  if (!button) return;
  const timerId = activeDownloads.get(button);
  if (timerId != null) window.clearTimeout(timerId);
  activeDownloads.delete(button);
  button.disabled = false;
  button.dataset.downloadLocked = 'false';
}
