const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const background = fs.readFileSync(
  path.join(root, 'mimic_recorder', 'background.js'),
  'utf8',
);
const home = fs.readFileSync(
  path.join(root, 'mimic_app', 'app', 'home', 'page.tsx'),
  'utf8',
);
const recordingModal = fs.readFileSync(
  path.join(root, 'mimic_app', 'components', 'dashboard', 'RecordingModal.tsx'),
  'utf8',
);

const checks = [
  [
    'Recorder handles first installation only',
    background,
    /chrome\.runtime\.onInstalled\.addListener\(details\s*=>\s*\{[\s\S]*details\.reason !== 'install'/,
  ],
  [
    'Recorder returns to the public Parro home route',
    background,
    /https:\/\/parro-guide\.vercel\.app[\s\S]*\/home\?recorder_install=complete&open_recorder=1/,
  ],
  [
    'Recorder reuses an existing Parro tab when available',
    background,
    /const existingOrigin = new URL\(existingTab\.url\)\.origin;[\s\S]*chrome\.tabs\.update\(existingTab\.id,[\s\S]*url:\s*returnUrl,[\s\S]*active:\s*true/,
  ],
  [
    'Recorder creates a Parro tab when none is open',
    background,
    /chrome\.tabs\.create\(\{\s*url:\s*INSTALL_RETURN_URL,\s*active:\s*true\s*\}\)/,
  ],
  [
    'Home consumes the install return marker',
    home,
    /params\.get\('recorder_install'\) !== 'complete'[\s\S]*params\.get\('open_recorder'\) !== '1'/,
  ],
  [
    'Home removes the one-time return marker',
    home,
    /params\.delete\('recorder_install'\)[\s\S]*window\.history\.replaceState/,
  ],
  [
    'Home resumes the web recording flow',
    home,
    /setRecordingModalMode\('web'\);[\s\S]*setResumeRecorderAfterInstall\(true\);[\s\S]*setShowRecordingModal\(true\);/,
  ],
  [
    'Home passes the one-time auto-resume flag to the Recorder modal',
    home,
    /autoResumeAfterInstall=\{resumeRecorderAfterInstall\}/,
  ],
  [
    'Recorder auto-resume skips the ordinary install guide',
    recordingModal,
    /if \(autoResumeAfterInstall\) \{[\s\S]*setStep\('checking'\);[\s\S]*return cleanupExtensionIdListener;/,
  ],
  [
    'Recorder auto-resume links the account and loads tabs immediately',
    recordingModal,
    /if \(!autoResumeAfterInstall \|\| autoResumeStartedRef\.current\) return;[\s\S]*void enterTabSelect\(\);/,
  ],
];

let failed = 0;
for (const [name, source, pattern] of checks) {
  if (!pattern.test(source)) {
    failed += 1;
    console.error(`FAIL: ${name}`);
  } else {
    console.log(`PASS: ${name}`);
  }
}

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} install-return contract check(s) failed.`);
} else {
  console.log(`\nAll ${checks.length} install-return contract checks passed.`);
}
