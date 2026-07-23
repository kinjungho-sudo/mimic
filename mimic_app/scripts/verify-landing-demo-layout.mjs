import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const component = await readFile(new URL('../components/landing/ProductDemo.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../components/landing/ProductDemo.module.css', import.meta.url), 'utf8');
const landingPage = await readFile(new URL('../app/landingpage/page.tsx', import.meta.url), 'utf8');
const homePage = await readFile(new URL('../app/home/page.tsx', import.meta.url), 'utf8');
const workspacePage = await readFile(new URL('../app/workspace/[id]/page.tsx', import.meta.url), 'utf8');
const authHook = await readFile(new URL('../hooks/useAuth.ts', import.meta.url), 'utf8');
const plans = await readFile(new URL('../lib/product-plans.ts', import.meta.url), 'utf8');

assert.match(component, /className=\{styles\.slideImageFrame\}[\s\S]*?<img[\s\S]*?className=\{styles\.slideAnnotation\}/);
assert.match(component, /slideRect:\s*\{\s*x:\s*69\.1,\s*y:\s*73\.3,\s*width:\s*27\.5,\s*height:\s*9\.4\s*\}/);
assert.match(component, /slideRect\s*\?\?\s*DEMO_STEPS\[slideIndex\]\.rect/);
assert.match(css, /\.slideImageFrame\s*\{[^}]*position:\s*relative[^}]*max-width:\s*100%/s);
assert.match(css, /\.slideImageFrame\s*\{[^}]*animation:\s*slideAdvance/s);
assert.match(css, /\.slideImageFrame\s*>\s*img\s*\{[^}]*max-width:\s*100%[^}]*max-height:\s*300px/s);
assert.doesNotMatch(css, /\.slideImageFrame\s*>\s*img\s*\{[^}]*animation:/s);
assert.doesNotMatch(css, /\.slideCanvas\s*>\s*img/);
assert.match(css, /\.editorTimeline button strong\s*\{[^}]*font-size:\s*16px/s);
assert.match(css, /\.editorTimeline button small\s*\{[^}]*font-size:\s*13px/s);
assert.match(css, /\.viewerToggle span,[^\n]*font-size:\s*10px/);
assert.match(css, /\.previewLabel strong,[^\n]*\.previewLabel small[^\n]*font-size:\s*10px/);
assert.match(css, /\.slideChapter strong\s*\{[^}]*font-size:\s*11px/s);
assert.match(css, /\.documentStepCard p\s*\{[^}]*font-size:\s*10px/s);
assert.match(css, /\.motionNote\s*\{[^}]*font-size:\s*14px/s);
assert.match(component, /className=\{`\$\{styles\.guideCoach\}[\s\S]*?styles\.coachRight[\s\S]*?styles\.coachLeft/);
assert.match(css, /\.guideCoach\s*\{[^}]*position:\s*absolute[^}]*max-width|\.guideCoach\s*\{[^}]*width:\s*min\(/s);

assert.match(landingPage, /className="landing-page"[\s\S]*?overflowX:\s*'clip'/);
assert.match(landingPage, /title:\s*'업무 화면에서 녹화 시작'/);
assert.match(landingPage, /className="final-cta-form"/);
assert.match(landingPage, /className="final-cta-actions"/);
assert.match(landingPage, /placeholder="name@company\.com"/);
assert.doesNotMatch(landingPage, /placeholder="jungho@company\.com"/);

assert.match(homePage, /tutorialCacheRef\s*=\s*useRef\(new Map<string, Tutorial\[\]>\(\)\)/);
assert.match(homePage, /pagesCacheRef\s*=\s*useRef\(new Map<string, typeof pages>\(\)\)/);
assert.match(homePage, /fetchPriority="low"/);
assert.match(homePage, /loading="lazy"\s+decoding="async"/);
assert.match(workspacePage, /width=\{34\}\s+height=\{34\}\s+loading="lazy"\s+decoding="async"/);

assert.match(authHook, /void supabase\.auth\.getSession\(\)/);
assert.match(authHook, /if \(appliedUserId === nextUserId\) return/);
assert.match(authHook, /appliedUserId\s*=\s*null;[\s\S]*?setUser\(null\)/);
assert.doesNotMatch(authHook, /setTimeout\(/);

assert.match(plans, /features:\s*\['매일 매뉴얼 3개', '클릭 동작 자동 캡처'/);

console.log('Landing integration contract: demo, mobile, loading, and auth checks passed.');
