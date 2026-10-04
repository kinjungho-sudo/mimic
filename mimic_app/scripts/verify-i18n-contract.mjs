import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const layout = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const provider = fs.readFileSync(new URL('../components/i18n/LocaleProvider.tsx', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../lib/i18n/ui-translations.ts', import.meta.url), 'utf8');
const voice = fs.readFileSync(new URL('../lib/voice/voice.ts', import.meta.url), 'utf8');
const serverLocale = fs.readFileSync(new URL('../lib/i18n/server-locale.ts', import.meta.url), 'utf8');
const pdfExport = fs.readFileSync(new URL('../lib/export/manual-pdf.ts', import.meta.url), 'utf8');
const docxExport = fs.readFileSync(new URL('../app/api/export/docx/[id]/route.ts', import.meta.url), 'utf8');
const pptxExport = fs.readFileSync(new URL('../app/api/export/pptx/[id]/route.ts', import.meta.url), 'utf8');
const shareEmail = fs.readFileSync(new URL('../app/api/share/email/route.ts', import.meta.url), 'utf8');
const emailTemplates = fs.readFileSync(new URL('../lib/email/email-n8n.ts', import.meta.url), 'utf8');
const homePage = fs.readFileSync(new URL('../app/home/page.tsx', import.meta.url), 'utf8');
const workspacePage = fs.readFileSync(new URL('../app/workspace/[id]/page.tsx', import.meta.url), 'utf8');
const koreanLandingLayout = fs.readFileSync(new URL('../app/landingpage/layout.tsx', import.meta.url), 'utf8');
const englishLandingLayout = fs.readFileSync(new URL('../app/en/landingpage/layout.tsx', import.meta.url), 'utf8');

assert.match(layout, /<LocaleProvider>/, 'Root layout must provide the locale context');
assert.match(provider, /LOCALE_STORAGE_KEY/, 'Locale preference must persist');
assert.match(provider, /document\.documentElement\.lang = locale/, 'The document language must follow the selected locale');
assert.match(provider, /translateTree\(document\.head, locale\)/, 'Document titles must follow the selected locale');
assert.match(provider, /characterData: true/, 'Dynamically updated text must be translated');
assert.match(provider, /data-i18n-ignore/, 'The language switcher must not translate itself');
assert.match(provider, /document\.cookie =/, 'The selected locale must be available to server requests');
assert.match(provider, /window\.alert =/, 'Native alert messages must follow the selected locale');
assert.match(provider, /window\.confirm =/, 'Native confirmation messages must follow the selected locale');
assert.match(provider, /hasEmbeddedWorkspaceSwitcher/, 'Workspace screens must replace the global floating language switcher');
assert.match(homePage, /LanguageSwitcher className="parro-language-switcher--workspace-sidebar"/, 'Desktop workspace language switcher must live in the sticky sidebar');
assert.match(homePage, /LanguageSwitcher className="parro-language-switcher--workspace-mobile-header"/, 'Mobile workspace language switcher must live in the sticky header');
assert.match(workspacePage, /LanguageSwitcher className="parro-language-switcher--workspace-header"/, 'Workspace language switcher must live in the sticky header');
assert.match(translations, /'한국어': '한국어'/, 'The Korean locale option must remain readable in English mode');
assert.match(translations, /'영어': 'English'/, 'The English locale option must be translated');
assert.match(translations, /HELP_ENGLISH_TRANSLATIONS/, 'Help translations must be included');
assert.match(translations, /LEGAL_ENGLISH_TRANSLATIONS/, 'Legal translations must be included');
assert.match(translations, /EXTENDED_ENGLISH_TRANSLATIONS/, 'Extended UI translations must be included');
assert.match(translations, /EXTENDED_DYNAMIC_TRANSLATIONS/, 'Dynamic UI translations must be included');
assert.match(translations, /실제 녹화 화면/, 'Dynamic demo image alt text must be translated');
assert.doesNotMatch(voice, /language:\s*['"]ko['"]/, 'Voice transcription must not force Korean');
assert.match(serverLocale, /request\.cookies\.get\('parro\.locale'\)/, 'Server locale must read the persisted locale cookie');
assert.match(pdfExport, /tutorial\.locale === 'en'/, 'PDF copy must follow the requested locale');
assert.match(docxExport, /getRequestLocale\(request\)/, 'DOCX copy must follow the requested locale');
assert.match(pptxExport, /getRequestLocale\(request\)/, 'PPTX copy must follow the requested locale');
assert.match(shareEmail, /<html lang="\$\{locale\}">/, 'Shared-manual email language must follow the requested locale');
assert.match(emailTemplates, /welcomeEmailHtml\(name\?: string \| null, locale:/, 'Welcome email must accept a locale');
assert.match(provider, /\/en\/landingpage/, 'Landing language changes must use the English landing URL');
assert.match(koreanLandingLayout, /'en-US': `\$\{APP_URL\}\/en\/landingpage`/, 'Korean landing metadata must link to the English version');
assert.match(englishLandingLayout, /inLanguage: 'en-US'/, 'English landing structured data must declare English');
assert.match(englishLandingLayout, /LANDING_FAQS_EN/, 'English landing structured data must use English FAQs');
execFileSync(process.execPath, [
  fileURLToPath(new URL('./audit-i18n-coverage.mjs', import.meta.url)),
  '--ui-strict',
], { stdio: 'inherit' });
execFileSync(process.execPath, [
  fileURLToPath(new URL('./verify-extended-i18n.mjs', import.meta.url)),
], { stdio: 'inherit' });

console.log('i18n contract verified');
