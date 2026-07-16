import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const recorderRoot = path.resolve(process.cwd(), '..', 'mimic_recorder');
const contentScript = path.join(recorderRoot, 'content.js');
const guideScript = path.join(recorderRoot, 'guide-engine.js');

async function loadContent(page: Page) {
  await page.setContent('<main id="fixture"></main>');
  await page.evaluate(() => {
    const noop = () => {};
    (window as unknown as { chrome: unknown }).chrome = {
      runtime: {
        lastError: null,
        sendMessage: (_message: unknown, callback?: (response?: unknown) => void) => callback?.({}),
        onMessage: { addListener: noop },
      },
      storage: {
        local: {
          get: (_keys: unknown, callback: (value: unknown) => void) => callback({}),
          set: (_value: unknown, callback?: () => void) => callback?.(),
        },
        onChanged: { addListener: noop },
      },
    };
  });
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
  await page.addScriptTag({ path: guideScript });
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

test('hidden or covered targets are rejected', async ({ page }) => {
  await page.setContent(`
    <button id="hidden" style="visibility:hidden;width:120px;height:40px">숨김</button>
    <button id="covered" style="position:absolute;left:20px;top:80px;width:120px;height:40px">대상</button>
    <div style="position:absolute;left:20px;top:80px;width:120px;height:40px;z-index:2">가림막</div>
  `);
  await page.addScriptTag({ path: guideScript });
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
  await page.addScriptTag({ path: guideScript });
  const sources = await page.evaluate(() => {
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    return [
      guide._resolveTarget({ hotspot_x: 11, hotspot_y: 12, element_context: { fingerprint: { tag: 'button', label: '저장' } } }).source,
      guide._resolveTarget({ hotspot_x: 27, hotspot_y: 12, element_context: { fingerprint: { tag: 'button', label: '저장' } } }).source,
    ];
  });
  expect(sources).toEqual(['none', 'none']);
});

test('a click at the same coordinates does not count when it came from another element', async ({ page }) => {
  await page.setContent('<button id="target">대상</button><button id="other">다른 버튼</button>');
  await page.addScriptTag({ path: guideScript });
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
  await page.addScriptTag({ path: guideScript });
  const source = await page.evaluate(() => {
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    return guide._resolveTarget({
      element_context: {
        frame: { is_top: false, same_origin: true, selectors: ['#frame'], url: 'about:srcdoc' },
        shadow_hosts: [],
        target_selector: '#inside',
        fingerprint: { tag: 'button', label: '프레임 실행' },
      },
    }).source;
  });
  expect(source).toBe('context');
});

test('an unresolved cross-origin iframe never falls back to the top document', async ({ page }) => {
  await page.setContent('<button id="same-selector">잘못된 top 대상</button>');
  await page.addScriptTag({ path: guideScript });
  const source = await page.evaluate(() => {
    const guide = (window as unknown as { ParroGuide: any }).ParroGuide;
    return guide._resolveTarget({
      element_selector: '#same-selector',
      element_context: {
        frame: { is_top: false, same_origin: false, selectors: [], url: 'https://frame.example/path' },
        shadow_hosts: [],
        target_selector: '#same-selector',
        fingerprint: { tag: 'button' },
      },
    }).source;
  });
  expect(source).toBe('none');
});
