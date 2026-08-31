import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const home = read('app', 'home', 'page.tsx');
const settings = read('app', 'settings', 'page.tsx');
const setup = read('app', 'desktop-setup', 'page.tsx');
const client = read('lib', 'desktop-companion-client.ts');
const middleware = read('middleware.ts');
const protectedList = middleware.match(/const PROTECTED = \[([\s\S]*?)\];/)?.[1] || '';
const paidDesktopList = middleware.match(/const PAID_DESKTOP_PATHS = \[([\s\S]*?)\];/)?.[1] || '';

const checks = {
  home_has_no_desktop_install_cta: !home.includes('Desktop 설치') && !home.includes('/download/desktop'),
  recording_checks_status_first: home.includes('resolveDesktopCaptureEntry()') && home.includes('desktopCaptureEntryDestination(entry, source)'),
  missing_redirects_to_installer: client.includes('case \'install_required\':') && client.includes('reason=install'),
  outdated_redirects_to_installer: client.includes('case \'update_required\':') && client.includes('reason=update'),
  extension_failure_does_not_download: client.includes("return { kind: 'check_failed', error: response?.error }") && client.includes('return `/desktop-setup?source=${safeSource}`'),
  sign_in_returns_to_status_check: client.includes('/desktop-setup?source=${source}&autostart=1'),
  setup_does_not_treat_missing_extension_as_missing_desktop: !setup.includes("if (autoStart) {\n        moveToDownload('install');\n        return;\n      }\n      setStatus('extension_missing')"),
  reinstall_is_settings_only: settings.includes('/download/desktop?source=settings&reason=reinstall') && settings.includes('다운로드/재설치'),
  installer_binary_never_redirects_to_html: !protectedList.includes("'/downloads'") && !paidDesktopList.includes('ParroDesktopSetup.exe'),
};

for (const [name, ok] of Object.entries(checks)) {
  if (!ok) throw new Error(`Desktop entry routing contract failed: ${name}`);
}

console.log(JSON.stringify({ ok: true, checks: Object.keys(checks).length }));
