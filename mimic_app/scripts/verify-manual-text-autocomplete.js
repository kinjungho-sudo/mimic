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

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: 10 }));
