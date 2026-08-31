const fs = require('node:fs');
const path = require('node:path');

const controllerPath = path.resolve(process.cwd(), '../mimic_desktop/native-host/src/controller.ps1');
const controller = fs.readFileSync(controllerPath, 'utf8');

const requiredCopy = [
  'Text="Parro Desktop Capture"',
  'Text="준비 완료"',
  'Text="개인정보 안내: 비밀번호·결제 화면에서는 일시정지를 사용하세요."',
  'Content="폴더 열기"',
  'Content="중지"',
  'Content="캡처 시작"',
  '"캡처 엔진을 찾을 수 없습니다. 앱을 다시 설치해 주세요."',
];

for (const copy of requiredCopy) {
  if (!controller.includes(copy)) throw new Error(`Desktop controller copy contract is missing: ${copy}`);
}

const legacyEnglishCopy = [
  'Text="Desktop Capture"', 'Text="Ready"', 'Content="Open folder"',
  'Content="Stop"', 'Content="Start capture"',
  'Capture engine not found. Please reinstall the app.',
];

for (const copy of legacyEnglishCopy) {
  if (controller.includes(copy)) throw new Error(`Desktop controller still exposes legacy English copy: ${copy}`);
}

console.log(`Desktop copy contract passed (${requiredCopy.length + legacyEnglishCopy.length} checks).`);
