import fs from 'node:fs';
import assert from 'node:assert/strict';

const layout = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const provider = fs.readFileSync(new URL('../components/i18n/LocaleProvider.tsx', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../lib/i18n/ui-translations.ts', import.meta.url), 'utf8');
const voice = fs.readFileSync(new URL('../lib/voice/voice.ts', import.meta.url), 'utf8');

assert.match(layout, /<LocaleProvider>/, 'Root layout must provide the locale context');
assert.match(provider, /LOCALE_STORAGE_KEY/, 'Locale preference must persist');
assert.match(provider, /document\.documentElement\.lang = locale/, 'The document language must follow the selected locale');
assert.match(provider, /translateTree\(document\.head, locale\)/, 'Document titles must follow the selected locale');
assert.match(provider, /characterData: true/, 'Dynamically updated text must be translated');
assert.match(provider, /data-i18n-ignore/, 'The language switcher must not translate itself');
assert.match(translations, /'한국어': '한국어'/, 'The Korean locale option must remain readable in English mode');
assert.match(translations, /'영어': 'English'/, 'The English locale option must be translated');
assert.match(translations, /HELP_ENGLISH_TRANSLATIONS/, 'Help translations must be included');
assert.match(translations, /LEGAL_ENGLISH_TRANSLATIONS/, 'Legal translations must be included');
assert.match(translations, /실제 녹화 화면/, 'Dynamic demo image alt text must be translated');
assert.doesNotMatch(voice, /language:\s*['"]ko['"]/, 'Voice transcription must not force Korean');

console.log('i18n contract verified');
