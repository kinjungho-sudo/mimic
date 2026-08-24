import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');

let checks = 0;
const check = assertion => {
  assertion();
  checks += 1;
};

check(() => assert.match(source, /SUPABASE_REQUEST_TIMEOUT_MS\s*=\s*4_000/));
check(() => assert.match(source, /global:\s*\{\s*fetch:\s*fetchWithTimeout\s*\}/));
check(() => assert.match(source, /hasSupabaseAuthCookie\(request\)/));
check(() => assert.match(
  source,
  /if \(!hasSupabaseAuthCookie\(request\)\)[\s\S]*?if \(isProtected \|\| isAdmin\)[\s\S]*?redirectToLogin\(request, pathname\)[\s\S]*?NextResponse\.next\(\{ request \}\)/,
));
check(() => assert.match(
  source,
  /catch \(error\)[\s\S]*?if \(!isProtected && !isAdmin\)[\s\S]*?return supabaseResponse/,
));
check(() => assert.match(source, /if \(isProtected && !userId\)[\s\S]*?redirectToLogin/));
check(() => assert.match(source, /if \(isAdmin\)[\s\S]*?if \(!userId\)[\s\S]*?redirectToLogin/));

const publicShortCircuit = source.indexOf('if (!hasSupabaseAuthCookie(request))');
const clientCreation = source.indexOf('createServerClient(');
check(() => assert.ok(publicShortCircuit > -1 && publicShortCircuit < clientCreation));

console.log(JSON.stringify({
  ok: true,
  checks,
  scope: 'middleware-resilience',
}));
