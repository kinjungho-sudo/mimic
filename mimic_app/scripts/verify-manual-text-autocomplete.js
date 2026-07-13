const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assertIncludes(path, pattern, message, failures) {
  const text = read(path);
  if (typeof pattern === 'string' ? !text.includes(pattern) : !pattern.test(text)) {
    failures.push({ path, message });
  }
}

function assertExcludes(path, pattern, message, failures) {
  const text = read(path);
  if (typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text)) {
    failures.push({ path, message });
  }
}

const failures = [];

assertIncludes(
  'app/api/tutorials/[id]/patch-steps/route.ts',
  /analyzeScreenshot\(\s*b64,\s*step\.page_url \?\? '',[\s\S]*mediaType\s*\)/,
  'patch-steps must pass pageUrl before mediaType when calling analyzeScreenshot',
  failures
);

assertIncludes(
  'app/api/steps/[id]/generate-description/route.ts',
  'validateGeneratedManualScript',
  'generate-description must quality-check AI output before saving',
  failures
);

assertExcludes(
  'app/api/steps/[id]/generate-description/route.ts',
  'update({ ai_description: description })',
  'generate-description must not save raw/empty AI output directly',
  failures
);

for (const path of ['app/api/ai/rewrite/route.ts', 'app/api/ai/rewrite-all/route.ts']) {
  assertIncludes(path, 'requireAuth', `${path} must use verified auth guard`, failures);
  assertIncludes(path, 'rateLimitAi', `${path} must rate-limit model calls`, failures);
  assertExcludes(path, 'getSession()', `${path} must not rely on getSession for server auth`, failures);
}

assertIncludes(
  'lib/ai/text-quality.ts',
  'validateGeneratedManualScript',
  'text-quality utility must expose generated script validation',
  failures
);

assertExcludes(
  'app/api/capture/finalize/route.ts',
  "status: 'published'",
  'capture finalize must not publish a manual before explicit user approval',
  failures
);

assertExcludes(
  'app/api/capture/finalize/route.ts',
  "visibility: 'public'",
  'capture finalize must keep new manuals private',
  failures
);

assertIncludes(
  'app/api/capture/finalize/route.ts',
  /if \(draft\?\.user_script\?\.trim\(\) \|\| step\.ai_description\?\.trim\(\)\) \{[\s\S]*patch\.user_script/,
  'capture finalize must persist a readable fallback script for every step',
  failures
);

assertIncludes(
  'app/api/capture/analyze/route.ts',
  /hasAnthropicApiKey\(\)[\s\S]*status: 503/,
  'capture analyze must report an unavailable AI provider instead of returning an empty success',
  failures
);

assertIncludes(
  '../mimic_recorder/content.js',
  /function handleClick\(e\) \{\s*if \(!e\.isTrusted\)/,
  'recorder must ignore synthetic click events',
  failures
);

assertIncludes(
  '../mimic_recorder/content.js',
  /document\.addEventListener\('input', \(e\) => \{\s*if \(!e\.isTrusted\)/,
  'recorder must ignore synthetic input events',
  failures
);

const homeSource = read('app/home/page.tsx');
const initialTutorialLoads = (homeSource.match(/\bloadTutorials\(\);/g) ?? []).length;
if (initialTutorialLoads !== 1) {
  failures.push({
    path: 'app/home/page.tsx',
    message: `home must have one unscoped initial tutorial load, found ${initialTutorialLoads}`,
  });
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: 17 }));
