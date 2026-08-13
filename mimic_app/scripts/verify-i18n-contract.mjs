import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const layout = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const provider = fs.readFileSync(new URL('../components/i18n/LocaleProvider.tsx', import.meta.url), 'utf8');
const landing = fs.readFileSync(new URL('../app/landingpage/page.tsx', import.meta.url), 'utf8');
const workspace = fs.readFileSync(new URL('../app/workspace/[id]/page.tsx', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../lib/i18n/ui-translations.ts', import.meta.url), 'utf8');
const voice = fs.readFileSync(new URL('../lib/voice/voice.ts', import.meta.url), 'utf8');

assert.match(layout, /<LocaleProvider>/, 'Root layout must provide the locale context');
assert.match(provider, /LOCALE_STORAGE_KEY/, 'Locale preference must persist');
assert.match(provider, /document\.documentElement\.lang = locale/, 'The document language must follow the selected locale');
assert.match(provider, /translateTree\(document\.head, locale\)/, 'Document titles must follow the selected locale');
assert.match(provider, /characterData: true/, 'Dynamically updated text must be translated');
assert.match(provider, /data-i18n-ignore/, 'The language switcher must not translate itself');
assert.match(provider, /export function LanguageSwitcher/, 'The language switcher must be reusable inside page headers');
assert.doesNotMatch(provider, /\{children\}[\s\S]*className="parro-language-switcher"/, 'The language switcher must not float globally');
assert.match(landing, /<LanguageSwitcher tone="dark" \/>/, 'The landing header must expose language selection');
assert.match(workspace, /<LanguageSwitcher \/>/, 'The workspace header must expose language selection');
assert.match(translations, /'한국어': '한국어'/, 'The Korean locale option must remain readable in English mode');
assert.match(translations, /'영어': 'English'/, 'The English locale option must be translated');
assert.match(translations, /HELP_ENGLISH_TRANSLATIONS/, 'Help translations must be included');
assert.match(translations, /LEGAL_ENGLISH_TRANSLATIONS/, 'Legal translations must be included');
assert.match(translations, /EXTENDED_ENGLISH_TRANSLATIONS/, 'Extended UI translations must be included');
assert.match(translations, /EXTENDED_DYNAMIC_TRANSLATIONS/, 'Dynamic UI translations must be included');
assert.match(translations, /실제 녹화 화면/, 'Dynamic demo image alt text must be translated');
assert.doesNotMatch(voice, /language:\s*['"]ko['"]/, 'Voice transcription must not force Korean');
execFileSync(process.execPath, [
  fileURLToPath(new URL('./audit-i18n-coverage.mjs', import.meta.url)),
  '--ui-strict',
], { stdio: 'inherit' });
execFileSync(process.execPath, [
  fileURLToPath(new URL('./verify-extended-i18n.mjs', import.meta.url)),
], { stdio: 'inherit' });

console.log('i18n contract verified');
