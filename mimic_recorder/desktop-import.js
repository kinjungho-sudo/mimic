(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ParroDesktopImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function targetRect(x, y) {
    const width = 0.04;
    const height = 0.07;
    return {
      x: Math.max(0, Math.min(1 - width, x - width / 2)),
      y: Math.max(0, Math.min(1 - height, y - height / 2)),
      width,
      height,
    };
  }

  function automationRect(target, screen, width, height) {
    const rawLeft = Number(target?.left);
    const rawTop = Number(target?.top);
    const rawWidth = Number(target?.width);
    const rawHeight = Number(target?.height);
    if (![rawLeft, rawTop, rawWidth, rawHeight].every(Number.isFinite) || rawWidth < 2 || rawHeight < 2) {
      return null;
    }
    const left = Math.max(0, rawLeft - (Number(screen.left) || 0));
    const top = Math.max(0, rawTop - (Number(screen.top) || 0));
    const right = Math.min(width, rawLeft + rawWidth - (Number(screen.left) || 0));
    const bottom = Math.min(height, rawTop + rawHeight - (Number(screen.top) || 0));
    if (right <= left || bottom <= top) return null;
    return {
      normalized: {
        x: clamp01(left / width),
        y: clamp01(top / height),
        width: Math.min(1, (right - left) / width),
        height: Math.min(1, (bottom - top) / height),
      },
      local: { x: left, y: top, width: right - left, height: bottom - top },
    };
  }

  function buildStepData(event, index) {
    const screen = event?.screen || {};
    const width = Math.max(1, Number(screen.width) || 1920);
    const height = Math.max(1, Number(screen.height) || 1080);
    const normalizedX = clamp01(event?.normalized_x);
    const normalizedY = clamp01(event?.normalized_y);
    const clickX = Number.isFinite(Number(event?.click_x))
      ? Number(event.click_x) - (Number(screen.left) || 0)
      : normalizedX * width;
    const clickY = Number.isFinite(Number(event?.click_y))
      ? Number(event.click_y) - (Number(screen.top) || 0)
      : normalizedY * height;
    const windowTitle = String(event?.window_title || '').trim().slice(0, 200);
    const processName = String(event?.process_name || '').trim().slice(0, 100);
    const uiElement = event?.ui_element || {};
    const targetName = String(uiElement?.name || '').trim().slice(0, 160);
    const automationId = String(uiElement?.automation_id || '').trim().slice(0, 160);
    const controlType = String(uiElement?.control_type || '').trim().slice(0, 80);
    const manual = event?.event_type === 'manual';
    const contextLabel = windowTitle || processName || 'Windows 데스크톱';
    const measuredRect = manual ? null : automationRect(uiElement, screen, width, height);
    return {
      url: `https://desktop.parro.local/${encodeURIComponent(processName || 'windows')}`,
      timestamp: Date.parse(event?.captured_at) || Date.now(),
      clickX,
      clickY,
      windowWidth: width,
      windowHeight: height,
      viewportW: width,
      viewportH: height,
      stepNumber: index + 1,
      elementRect: manual ? null : (measuredRect?.normalized || targetRect(normalizedX, normalizedY)),
      elementSelector: automationId ? `uia:${automationId}` : null,
      elementXPath: null,
      actionInfo: {
        type: manual ? 'navigate' : 'click',
        label: manual ? `${contextLabel} 화면 확인` : (targetName || contextLabel),
        tag: 'desktop',
        role: controlType ? controlType.toLowerCase() : 'application',
        targetContext: {
          schemaVersion: 1,
          coordinateSpace: 'top-viewport-css-px',
          captureSurface: 'desktop',
          captureApp: processName || null,
          geometryConfidence: 'high',
          selectorConfidence: 'low',
          accessibleName: targetName || null,
          contextLabel: windowTitle || processName || null,
          pageTitle: windowTitle || null,
          framePath: [],
          frameAccess: 'top',
          shadowPath: [],
          localRect: measuredRect?.local || null,
          devicePixelRatio: 1,
          visualViewport: null,
        },
      },
      manual,
    };
  }

  return { buildStepData, clamp01, targetRect, automationRect };
});
