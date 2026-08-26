import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const recorderRoot = path.resolve(process.cwd(), '..', 'mimic_recorder');
const targetingScript = path.join(recorderRoot, 'targeting.js');
const contentScript = path.join(recorderRoot, 'content.js');
const guideScript = path.join(recorderRoot, 'guide-engine.js');

async function loadGuide(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __parroStorage: Record<string, unknown> }).__parroStorage = {};
    (window as unknown as { __runtimeMessages: unknown[] }).__runtimeMessages = [];
    (window as unknown as { chrome: unknown }).chrome = {
      runtime: {
        getURL: (path: string) => path,
        sendMessage: (message: Record<string, unknown>, callback?: (value: unknown) => void) => {
          (window as unknown as { __runtimeMessages: unknown[] }).__runtimeMessages.push(message);
          callback?.(message.type === 'GUIDE_TTS_REQUEST'
            ? { ok: true, audio_url: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' }
            : { ok: true });
        },
        lastError: null,
      },
      i18n: { getMessage: () => '' },
      storage: {
        local: {
          get: (key: string | string[], callback: (value: Record<string, unknown>) => void) => {
            const storage = (window as unknown as { __parroStorage: Record<string, unknown> }).__parroStorage;
            const keys = Array.isArray(key) ? key : [key];
            callback(Object.fromEntries(keys.map(item => [item, storage[item]])));
          },
          set: (value: Record<string, unknown>) => {
            Object.assign((window as unknown as { __parroStorage: Record<string, unknown> }).__parroStorage, value);
          },
        },
      },
    };
  });
  await page.addScriptTag({ path: targetingScript });
  await page.addScriptTag({ path: guideScript });
}

async function clickClosedShadowAction(page: Page, action: string) {
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const find = (node: any): any => {
    const attributes = Array.isArray(node.attributes) ? node.attributes : [];
    for (let index = 0; index < attributes.length; index += 2) {
      if (attributes[index] === 'data-act' && attributes[index + 1] === action) return node;
    }
    for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) {
      const match = find(child);
      if (match) return match;
    }
    return null;
  };
  const button = find(root);
  expect(button, `missing closed-shadow button: ${action}`).toBeTruthy();
  const { model } = await cdp.send('DOM.getBoxModel', { nodeId: button.nodeId });
  const quad = model.border;
  const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4;
  const y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4;
  await page.mouse.click(x, y);
  await cdp.detach();
}

async function closedShadowAttribute(
  page: Page,
  matchAttribute: string,
  matchValue: string,
  resultAttribute: string,
) {
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const find = (node: any): any => {
    const attributes = Array.isArray(node.attributes) ? node.attributes : [];
    const values = new Map<string, string>();
    for (let index = 0; index < attributes.length; index += 2) {
      values.set(attributes[index], attributes[index + 1]);
    }
    if (values.get(matchAttribute) === matchValue) return values.get(resultAttribute) ?? null;
    for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) {
      const match = find(child);
      if (match != null) return match;
    }
    return null;
  };
  const result = find(root);
  await cdp.detach();
  return result;
}

async function closedShadowBox(page: Page, matchAttribute: string, matchValue: string) {
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const find = (node: any): any => {
    const attributes = Array.isArray(node.attributes) ? node.attributes : [];
    for (let index = 0; index < attributes.length; index += 2) {
      if (attributes[index] === matchAttribute && attributes[index + 1] === matchValue) return node;
    }
    for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) {
      const match = find(child);
      if (match) return match;
    }
    return null;
  };
  const node = find(root);
  expect(node, `missing closed-shadow node: ${matchAttribute}=${matchValue}`).toBeTruthy();
  const { model } = await cdp.send('DOM.getBoxModel', { nodeId: node.nodeId });
  const quad = model.border;
  await cdp.detach();
  return {
    left: Math.min(quad[0], quad[2], quad[4], quad[6]),
    top: Math.min(quad[1], quad[3], quad[5], quad[7]),
    right: Math.max(quad[0], quad[2], quad[4], quad[6]),
    bottom: Math.max(quad[1], quad[3], quad[5], quad[7]),
  };
}

async function closedShadowImageState(page: Page, matchAttribute: string, matchValue: string) {
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const find = (node: any): any => {
    const attributes = Array.isArray(node.attributes) ? node.attributes : [];
    for (let index = 0; index < attributes.length; index += 2) {
      if (attributes[index] === matchAttribute && attributes[index + 1] === matchValue) return node;
    }
    for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) {
      const match = find(child);
      if (match) return match;
    }
    return null;
  };
  const node = find(root);
  expect(node, `missing closed-shadow image: ${matchAttribute}=${matchValue}`).toBeTruthy();
  const { object } = await cdp.send('DOM.resolveNode', { nodeId: node.nodeId });
  const { result } = await cdp.send('Runtime.callFunctionOn', {
    objectId: object.objectId,
    functionDeclaration: 'function () { return { complete: this.complete, naturalWidth: this.naturalWidth, src: this.src }; }',
    returnByValue: true,
  });
  await cdp.detach();
  return result.value as { complete: boolean; naturalWidth: number; src: string };
}

async function loadContent(page: Page, options: { recording?: boolean } = {}) {
  await page.setContent('<main id="fixture"></main>');
  await page.evaluate(({ recording }) => {
    const noop = () => {};
    (window as unknown as { __parroMessages: unknown[] }).__parroMessages = [];
    (window as unknown as { chrome: unknown }).chrome = {
      runtime: {
        lastError: null,
        sendMessage: (message: { type?: string }, callback?: (response?: unknown) => void) => {
          (window as unknown as { __parroMessages: unknown[] }).__parroMessages.push(message);
          callback?.(message.type === 'GET_TAB_RECORDING_STATE'
            ? { isRecording: recording, isPaused: false, stepNumber: 0 }
            : {});
        },
        onMessage: { addListener: noop },
      },
      storage: {
        local: {
          get: (_keys: unknown, callback: (value: unknown) => void) => callback({}),
          set: (_value: unknown, callback?: () => void) => callback?.(),
        },
        onChanged: { addListener: noop },
      },
      i18n: { getMessage: () => '' },
    };
  }, { recording: !!options.recording });
  await page.addScriptTag({ path: targetingScript });
  await page.addScriptTag({ path: contentScript });
}

test('nested text and badges resolve to the semantic control', async ({ page }) => {
  await loadContent(page);
  const result = await page.evaluate(() => {
    const fixture = document.querySelector('#fixture')!;
    fixture.innerHTML = '<button id="save"><span class="badge">1</span><span id="label">저장</span></button>';
    const button = document.querySelector('#save')!;
    const label = document.querySelector('#label')!;
    const api = (window as unknown as { ParroRecorderInternals: any }).ParroRecorderInternals;
    const found = api.findInteractiveTarget(label);
    const refined = api.refineActionTarget(label, found);
    return { found: found?.id, refined: refined?.id, isButton: refined === button };
  });
  expect(result).toEqual({ found: 'save', refined: 'save', isButton: true });
});

test('Threads composer resolves to one editable target with a concise field label', async ({ page }) => {
  await loadContent(page, { recording: true });
  const result = await page.evaluate(() => {
    const fixture = document.querySelector('#fixture')!;
    fixture.innerHTML = `
      <div id="composer-shell" role="button" style="cursor:pointer;padding:16px">
        <div id="composer" role="textbox" aria-label="텍스트 필드가 비어 있습니다. 입력하여 새 게시물을 작성해보세요." style="display:block;width:320px;height:44px">
          <span id="composer-caret"></span>
        </div>
      </div>`;
    const caret = document.querySelector('#composer-caret')!;
    const api = (window as unknown as { ParroRecorderInternals: any }).ParroRecorderInternals;
    const target = api.findInteractiveTarget(caret);
    return {
      targetId: target?.id,
      actionType: api.getActionType(target),
      elementLabel: api.getElementLabel(target, caret),
      fieldLabel: api.getFieldLabel(target),
    };
  });

  expect(result).toEqual({
    targetId: 'composer',
    actionType: 'focus_input',
    elementLabel: '게시물 내용',
    fieldLabel: '게시물 내용',
  });

  await page.locator('#composer').click();
  await page.waitForTimeout(80);
  const captureTypes = await page.evaluate(() => (
    (window as unknown as { __parroMessages: Array<{ type?: string }> }).__parroMessages
      .map(message => message.type)
  ));
  expect(captureTypes).not.toContain('CAPTURE_SCREENSHOT');
});

test('analytics data attributes do not make a container clickable', async ({ page }) => {
  await loadContent(page);
  const target = await page.evaluate(() => {
    const fixture = document.querySelector('#fixture')!;
    fixture.innerHTML = '<div id="analytics" data-playing="true" data-scene="demo"><span>설명</span></div>';
    const span = document.querySelector('#analytics span')!;
    const api = (window as unknown as { ParroRecorderInternals: any }).ParroRecorderInternals;
    return api.findInteractiveTarget(span)?.id ?? null;
  });
  expect(target).toBeNull();
});

test('inherited pointer cursor resolves to the card boundary, not its inner grid cell', async ({ page }) => {
  await loadContent(page);
  const result = await page.evaluate(() => {
    const fixture = document.querySelector('#fixture')!;
    fixture.innerHTML = `
      <div id="card" style="cursor:pointer;width:360px;height:200px;padding:20px">
        <div id="layout"><span id="metadata">중소벤처기업부 · 청년정책과</span></div>
      </div>`;
    const metadata = document.querySelector('#metadata')!;
    const api = (window as unknown as { ParroRecorderInternals: any }).ParroRecorderInternals;
    return api.findInteractiveTarget(metadata)?.id ?? null;
  });
  expect(result).toBe('card');
});

test('a same-frame fast click keeps one capture id and the card rect', async ({ page }) => {
  await loadContent(page, { recording: true });
  await page.evaluate(() => {
    const fixture = document.querySelector('#fixture')!;
    fixture.innerHTML = `
      <div id="card" style="cursor:pointer;width:360px;height:200px;padding:20px">
        <div id="empty-cell" style="width:90px;height:40px">정책과</div>
      </div>`;
  });
  const rect = await page.locator('#empty-cell').boundingBox();
  expect(rect).not.toBeNull();
  await page.mouse.click(rect!.x + 10, rect!.y + 10);
  await page.waitForTimeout(80);
  const result = await page.evaluate(() => {
    const messages = (window as unknown as { __parroMessages: Array<any> }).__parroMessages;
    const pre = messages.find(message => message.type === 'PRECAPTURE_FRAME');
    const capture = messages.find(message => message.type === 'CAPTURE_SCREENSHOT');
    return {
      preIndex: messages.indexOf(pre),
      captureIndex: messages.indexOf(capture),
      preId: pre?.captureId,
      captureId: capture?.stepData?.captureId,
      selector: capture?.stepData?.elementSelector,
      rect: capture?.stepData?.elementRect,
    };
  });

  expect(result.preId).toBeTruthy();
  expect(result.preIndex).toBeLessThan(result.captureIndex);
  expect(result.captureId).toBe(result.preId);
  expect(result.selector).toBe('#card');
  expect(result.rect.width).toBeGreaterThan(0.25);
  expect(result.rect.height).toBeGreaterThan(0.20);
});

test('composedPath preserves a button inside an open shadow root', async ({ page }) => {
  await loadContent(page);
  const target = await page.evaluate(() => new Promise<string | null>(resolve => {
    const host = document.createElement('div');
    document.querySelector('#fixture')!.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button id="shadow-action"><span>실행</span></button>';
    const button = shadow.querySelector('button')!;
    document.addEventListener('click', event => {
      const api = (window as unknown as { ParroRecorderInternals: any }).ParroRecorderInternals;
      resolve(api.findInteractiveTarget(api.eventElement(event), event)?.id ?? null);
    }, { once: true });
    (button as HTMLElement).click();
  }));
  expect(target).toBe('shadow-action');
});

test('guide accepts a unique visible selector after responsive movement', async ({ page }) => {
  await page.setContent('<button id="moved" style="position:absolute;left:700px;top:500px;width:120px;height:40px">계속</button>');
  await loadGuide(page);
  const source = await page.evaluate(() => {
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    return guide._resolveTarget({
      element_selector: '#moved',
      element_rect: { x: 0.05, y: 0.05, width: 0.1, height: 0.05 },
      click_x: 0.1,
      click_y: 0.08,
      element_context: { fingerprint: { tag: 'button', label: '계속' } },
    }).source;
  });
  expect(source).toBe('selector');
});

test('type guide resolves the correct field among responsive dialog inputs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(`
    <section role="dialog" aria-labelledby="dialog-title" style="position:absolute;left:320px;top:70px;width:560px;padding:28px">
      <h2 id="dialog-title">예약된 작업</h2>
      <label>이름 <input id="task-name" placeholder="예: 뉴스 요약" style="display:block;width:500px;height:52px;margin-top:8px"></label>
      <label style="display:block;margin-top:44px">요청 사항 <input id="task-request" placeholder="예: 뉴스 요약 보내기" style="display:block;width:500px;height:52px;margin-top:8px"></label>
    </section>
  `);
  await loadGuide(page);
  const resolvedId = await page.evaluate(() => {
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    return guide._resolveTarget({
      type_text: '뉴스 요약',
      element_selector: 'input.obsolete-recorder-class',
      element_rect: { x: 0.31, y: 0.19, width: 0.39, height: 0.065 },
      target_context: {
        accessibleName: '뉴스 요약',
        contextLabel: '예약된 작업',
        pageTitle: document.title,
      },
    }).el?.id ?? null;
  });
  expect(resolvedId).toBe('task-name');
});

test('type guide still rejects indistinguishable editable fields', async ({ page }) => {
  await page.setContent(`
    <section role="dialog" aria-labelledby="dialog-title">
      <h2 id="dialog-title">예약된 작업</h2>
      <input class="same" placeholder="작업 이름">
      <input class="same" placeholder="작업 이름">
    </section>
  `);
  await loadGuide(page);
  const source = await page.evaluate(() => {
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    return guide._resolveTarget({
      type_text: '뉴스 요약',
      element_selector: 'input.same',
      target_context: { accessibleName: '작업 이름', contextLabel: '예약된 작업' },
    }).source;
  });
  expect(source).toBe('none');
});

test('long Live Guide copy is fully visible immediately', async ({ page }) => {
  await page.route('https://example.test/long-copy', route => route.fulfill({
    contentType: 'text/html',
    body: '<button id="long-copy-target" style="margin:180px;width:140px;height:44px">Continue</button>',
  }));
  await page.goto('https://example.test/long-copy');
  await loadGuide(page);
  await page.evaluate(() => {
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    guide.show({
      id: 'long-copy-step',
      page_url: window.location.href,
      element_selector: '#long-copy-target',
      title: 'Continue',
      instruction: 'This is a deliberately long Live Guide instruction. '.repeat(18),
    }, { index: 0, total: 2 });
  });

  expect(await closedShadowAttribute(page, 'data-role', 'guide-copy', 'data-expanded')).toBe('true');
  expect(await closedShadowAttribute(page, 'data-act', 'toggle-guide-copy', 'aria-expanded')).toBeNull();
});

test('Live Guide avatar stays visually separate beside its speech bubble', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.route('**/assets/parro-3d-neutral.png*', route => route.fulfill({
    contentType: 'image/png',
    path: path.join(recorderRoot, 'assets', 'parro-3d-neutral.png'),
  }));
  await page.route('https://example.test/separate-coach', route => route.fulfill({
    contentType: 'text/html',
    body: '<button id="separate-coach-target" style="position:absolute;left:430px;top:260px;width:140px;height:44px">Continue</button>',
  }));
  await page.goto('https://example.test/separate-coach');
  await loadGuide(page);
  await page.evaluate(() => {
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    guide.show({
      id: 'separate-coach-step',
      page_url: window.location.href,
      element_selector: '#separate-coach-target',
      title: 'Continue',
      instruction: 'The speech bubble appears beside the independent Parro avatar.',
    }, { index: 0, total: 2 });
  });

  await expect.poll(async () => {
    const avatar = await closedShadowBox(page, 'data-role', 'coach-avatar');
    const bubble = await closedShadowBox(page, 'data-role', 'guide-bubble');
    return Math.round(bubble.left - avatar.right);
  }).toBeGreaterThanOrEqual(12);

  await page.waitForTimeout(400);
  const avatar = await closedShadowBox(page, 'data-role', 'coach-avatar');
  const bubble = await closedShadowBox(page, 'data-role', 'guide-bubble');
  const voice = await closedShadowBox(page, 'data-act', 'play-guide-voice');
  expect(Math.min(avatar.bottom, bubble.bottom) - Math.max(avatar.top, bubble.top)).toBeGreaterThan(40);
  expect(Math.abs(avatar.top - bubble.top)).toBeLessThanOrEqual(2);
  expect(voice.right - voice.left).toBeGreaterThanOrEqual(44);
  expect(voice.bottom - voice.top).toBeGreaterThanOrEqual(44);
  expect(await closedShadowAttribute(page, 'data-role', 'coach-avatar', 'data-placement')).toBe('left');
  await expect.poll(async () => (await closedShadowImageState(page, 'data-role', 'coach-avatar-image')).naturalWidth).toBeGreaterThan(0);

  await clickClosedShadowAction(page, 'toggle-coach');
  await expect.poll(() => page.locator('#parro-overlay-root').getAttribute('data-coach-minimized')).toBe('true');
  const minimizedAvatar = await closedShadowBox(page, 'data-role', 'coach-avatar');
  expect(minimizedAvatar.right - minimizedAvatar.left).toBe(64);
  await clickClosedShadowAction(page, 'toggle-coach');
  await expect.poll(() => page.locator('#parro-overlay-root').getAttribute('data-coach-minimized')).toBe('false');
});

test('Live Guide occasionally uses the pointing Parro pose', async ({ page }) => {
  await page.route('**/assets/parro-3d-point.png*', route => route.fulfill({
    contentType: 'image/png',
    path: path.join(recorderRoot, 'assets', 'parro-3d-point.png'),
  }));
  await page.route('https://example.test/pointing-coach', route => route.fulfill({
    contentType: 'text/html',
    body: '<button id="pointing-target" style="margin:220px;width:140px;height:44px">Continue</button>',
  }));
  await page.goto('https://example.test/pointing-coach');
  await loadGuide(page);
  await page.evaluate(() => {
    (window as unknown as { ParroGuide: any }).ParroGuide.show({
      id: 'pointing-step', page_url: window.location.href, element_selector: '#pointing-target',
      title: 'Continue', instruction: 'Parro points toward the screen.',
    }, { index: 1, total: 3 });
  });

  expect(await closedShadowAttribute(page, 'data-role', 'coach-avatar', 'data-mascot-state')).toBe('point');
  await expect.poll(async () => (await closedShadowImageState(page, 'data-role', 'coach-avatar-image')).naturalWidth).toBeGreaterThan(0);
  expect((await closedShadowImageState(page, 'data-role', 'coach-avatar-image')).src).toContain('parro-3d-point.png');
});

test('Live Guide keeps typing-step speech bubbles in the bottom-right corner', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.route('https://example.test/type-corner', route => route.fulfill({
    contentType: 'text/html',
    body: '<input id="type-target" style="position:absolute;left:120px;top:120px;width:180px;height:40px">',
  }));
  await page.goto('https://example.test/type-corner');
  await loadGuide(page);
  await page.evaluate(() => {
    (window as unknown as { ParroGuide: any }).ParroGuide.show({
      id: 'type-corner-step', page_url: window.location.href, element_selector: '#type-target',
      kind: 'type', type_text: 'Parro', title: 'Type', instruction: 'Enter the text.', bubble_anchor: 'top-left',
    }, { index: 0, total: 1 });
  });

  await expect.poll(async () => {
    const bubble = await closedShadowBox(page, 'data-role', 'guide-bubble');
    return { right: Math.round(1000 - bubble.right), bottom: Math.round(700 - bubble.bottom) };
  }).toEqual({ right: 12, bottom: 12 });
});

test('Live Guide requests OpenAI TTS for automatic voice guidance', async ({ page }) => {
  await page.route('https://example.test/live-guide-tts', route => route.fulfill({
    contentType: 'text/html',
    body: '<button id="tts-target" style="margin:180px;width:140px;height:44px">Continue</button>',
  }));
  await page.goto('https://example.test/live-guide-tts');
  await loadGuide(page);
  await page.evaluate(() => {
    (window as unknown as { __parroStorage: Record<string, unknown> }).__parroStorage.guideVoiceMode = 'auto';
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    guide.show({
      id: 'tts-step',
      page_url: window.location.href,
      element_selector: '#tts-target',
      title: '계속',
      instruction: '이 문장을 라이브 가이드에서 읽어주세요.',
    }, { index: 0, total: 2 });
  });

  await expect.poll(() => page.evaluate(() => (window as unknown as { __runtimeMessages: Array<{ type?: string }> }).__runtimeMessages.map(item => item.type))).toContain('GUIDE_TTS_REQUEST');

  await page.evaluate(() => (window as unknown as { ParroGuide: any }).ParroGuide.hide());
});

test('Live Guide supports button-only OpenAI TTS', async ({ page }) => {
  await page.route('https://example.test/manual-tts', route => route.fulfill({
    contentType: 'text/html',
    body: '<button id="manual-tts-target" style="margin:160px;width:160px;height:44px">Continue</button>',
  }));
  await page.goto('https://example.test/manual-tts');
  await loadGuide(page);
  await page.evaluate(() => {
    (window as unknown as { __parroStorage: Record<string, unknown> }).__parroStorage.guideVoiceMode = 'manual';
    (window as unknown as { ParroGuide: any }).ParroGuide.show({
      id: 'manual-tts-step', page_url: window.location.href, element_selector: '#manual-tts-target',
      title: '계속', instruction: '버튼을 누를 때만 읽어주세요.',
    }, { index: 0, total: 1 });
  });

  expect(await page.evaluate(() => (window as unknown as { __runtimeMessages: unknown[] }).__runtimeMessages)).toEqual([]);
  await clickClosedShadowAction(page, 'play-guide-voice');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __runtimeMessages: Array<{ type?: string }> }).__runtimeMessages.map(item => item.type))).toContain('GUIDE_TTS_REQUEST');
});

test('Live Guide confirms practice completion before staying or exiting', async ({ page }) => {
  await page.route('https://example.test/complete-guide', route => route.fulfill({
    contentType: 'text/html',
    body: '<button id="complete-target" style="margin:160px;width:160px;height:44px">Complete</button>',
  }));
  await page.goto('https://example.test/complete-guide');
  await loadGuide(page);
  await page.evaluate(() => {
    (window as unknown as { __completionActions: string[] }).__completionActions = [];
    (window as unknown as { ParroGuide: any }).ParroGuide.show({
      id: 'complete-step', page_url: window.location.href, element_selector: '#complete-target',
      title: '완료', instruction: '마지막 작업을 완료하세요.',
    }, {
      index: 0,
      total: 1,
      onStay: () => (window as unknown as { __completionActions: string[] }).__completionActions.push('stay'),
      onComplete: () => (window as unknown as { __completionActions: string[] }).__completionActions.push('exit'),
    });
  });

  await page.click('#complete-target');
  expect(await closedShadowAttribute(page, 'data-act', 'completion-stay', 'data-act')).toBe('completion-stay');
  expect(await closedShadowAttribute(page, 'data-act', 'completion-exit', 'data-act')).toBe('completion-exit');
  await clickClosedShadowAction(page, 'completion-stay');
  expect(await page.evaluate(() => (window as unknown as { __completionActions: string[] }).__completionActions)).toEqual(['stay']);
});

test('guide shows a scroll prompt while a same-page target is below the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await page.route('https://example.test/live-guide', route => route.fulfill({
    contentType: 'text/html',
    body: '<main id="virtual-list" style="height:1800px"></main>',
  }));
  await page.goto('https://example.test/live-guide');
  await loadGuide(page);

  await page.evaluate(() => {
    (window as unknown as { __parroTargetStatuses: string[] }).__parroTargetStatuses = [];
    window.addEventListener('scroll', () => {
      if (window.scrollY <= 0 || document.querySelector('#below')) return;
      const button = document.createElement('button');
      button.id = 'below';
      button.textContent = 'Continue';
      button.style.cssText = `position:absolute;top:${window.scrollY + 180}px;left:80px;width:160px;height:48px`;
      document.querySelector('#virtual-list')!.appendChild(button);
    });
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    guide.show({
      id: 'below-step',
      page_url: window.location.href,
      element_selector: '#below',
      title: 'Continue',
      instruction: 'Select Continue',
    }, {
      index: 0,
      onTargetStatus: (status: string) => {
        (window as unknown as { __parroTargetStatuses: string[] }).__parroTargetStatuses.push(status);
      },
    });
  });

  const prompt = page.locator('#parro-overlay-root').locator('button');
  await expect(prompt).toContainText('화면을 아래로 스크롤해주세요');
  await prompt.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as { __parroTargetStatuses: string[] }).__parroTargetStatuses
  ))).toContain('ready');
  await expect(prompt).toHaveCount(0);
});

test('reference step can be closed and reopened without completing the step', async ({ page }) => {
  await page.route('https://example.test/reference-step', route => route.fulfill({
    contentType: 'text/html',
    body: '<main>Reference fixture</main>',
  }));
  await page.goto('https://example.test/reference-step');
  await loadGuide(page);
  await page.evaluate(() => {
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    guide.show({
      id: 'reference-step',
      page_url: window.location.href,
      guide_mode: 'explanation',
      kind: 'none',
      title: 'Reference',
      instruction: 'Review this information.',
      screenshot_url: 'https://example.test/preview.png',
      user_annotations: [
        { type: 'marker', x1: 50, y1: 50, x2: 50, y2: 50, markerNumber: '1' },
        { type: 'arrow', x1: 72, y1: 82, x2: 40, y2: 24, color: '#EF4444', strokeWidth: 2 },
      ],
    }, { index: 3, total: 8 });
  });

  const host = page.locator('#parro-overlay-root');
  await expect(host).toHaveAttribute('data-explanation-hidden', 'false');

  const popupPromise = page.waitForEvent('popup');
  await clickClosedShadowAction(page, 'open-guide-preview');
  const preview = await popupPromise;
  await expect(preview).toHaveTitle('Parro 미리보기');
  await expect(preview.locator('img')).toHaveAttribute('src', 'https://example.test/preview.png');
  await expect(preview.locator('body')).toContainText('1');
  await expect(preview.locator('svg line[marker-end]')).toHaveCount(1);
  await preview.close();

  await clickClosedShadowAction(page, 'hide-explanation');
  await expect(host).toHaveAttribute('data-explanation-hidden', 'true');
  await clickClosedShadowAction(page, 'restore-explanation');
  await expect(host).toHaveAttribute('data-explanation-hidden', 'false');
});

test('wrong-page guide explains the mismatch and sends the user back', async ({ page }) => {
  await page.route('https://example.test/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<main>Wrong page fixture</main>',
  }));
  await page.goto('https://example.test/start');
  await page.goto('https://example.test/unexpected');
  await loadGuide(page);
  await page.evaluate(() => {
    (window as unknown as { __guideBackCalled: boolean }).__guideBackCalled = false;
    Object.defineProperty(window.history, 'back', {
      configurable: true,
      value: () => {
        (window as unknown as { __guideBackCalled: boolean }).__guideBackCalled = true;
      },
    });
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    guide.showWrongPage({
      id: 'expected-step',
      page_url: 'https://example.test/expected',
      title: 'Expected step',
    }, { index: 1, total: 4 });
  });

  const host = page.locator('#parro-overlay-root');
  await expect(host).toHaveAttribute('data-guide-state', 'wrong-page');
  await clickClosedShadowAction(page, 'guide-back');
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as { __guideBackCalled: boolean }).__guideBackCalled
  ))).toBe(true);
});

test('hidden or covered targets are rejected', async ({ page }) => {
  await page.setContent(`
    <button id="hidden" style="visibility:hidden;width:120px;height:40px">숨김</button>
    <button id="covered" style="position:absolute;left:20px;top:80px;width:120px;height:40px">대상</button>
    <div style="position:absolute;left:20px;top:80px;width:120px;height:40px;z-index:2">가림막</div>
  `);
  await loadGuide(page);
  const sources = await page.evaluate(() => {
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    return [
      guide._resolveTarget({ element_selector: '#hidden' }).source,
      guide._resolveTarget({ element_selector: '#covered' }).source,
    ];
  });
  expect(sources).toEqual(['none', 'none']);
});

test('manual hotspot requires an actionable element with a matching fingerprint', async ({ page }) => {
  await page.setContent(`
    <div id="plain" style="position:absolute;left:90px;top:70px;width:100px;height:50px">일반 영역</div>
    <button id="wrong" style="position:absolute;left:300px;top:70px;width:100px;height:50px">삭제</button>
  `);
  await loadGuide(page);
  const sources = await page.evaluate(() => {
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    return [
      guide._resolveTarget({ hotspot_x: 11, hotspot_y: 12, target_context: { accessibleName: '저장' } }).source,
      guide._resolveTarget({ hotspot_x: 27, hotspot_y: 12, target_context: { accessibleName: '저장' } }).source,
    ];
  });
  expect(sources).toEqual(['none', 'none']);
});

test('a click at the same coordinates does not count when it came from another element', async ({ page }) => {
  await page.setContent('<button id="target">대상</button><button id="other">다른 버튼</button>');
  await loadGuide(page);
  const hit = await page.evaluate(() => {
    const target = document.querySelector('#target')!;
    const other = document.querySelector('#other')!;
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    return guide._isHit(10, 10, { el: target, rect: { left: 0, top: 0, width: 100, height: 100 } }, other, [other]);
  });
  expect(hit).toBe(false);
});

test('same-origin iframe context resolves the target inside the frame', async ({ page }) => {
  await page.setContent('<iframe id="frame" srcdoc="<button id=inside>프레임 실행</button>"></iframe>');
  await page.frameLocator('#frame').locator('#inside').waitFor();
  await loadGuide(page);
  const source = await page.evaluate(() => {
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    return guide._resolveTarget({
      element_selector: '#inside',
      target_context: {
        framePath: ['#frame'],
        shadowPath: [],
        accessibleName: '프레임 실행',
        selectorConfidence: 'high',
      },
    }).source;
  });
  expect(source).toBe('selector');
});

test('an unresolved cross-origin iframe never falls back to the top document', async ({ page }) => {
  await page.setContent('<button id="same-selector">잘못된 top 대상</button>');
  await loadGuide(page);
  const source = await page.evaluate(() => {
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    return guide._resolveTarget({
      element_selector: '#same-selector',
      target_context: {
        framePath: ['#missing-frame'],
        shadowPath: [],
        frameAccess: 'cross-origin',
      },
    }).source;
  });
  expect(source).toBe('none');
});
