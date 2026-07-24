const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
let checks = 0;
const check = (assertion) => {
  assertion();
  checks += 1;
};

check(() => assert.match(background, /message\.action === 'OPEN_ONBOARDING_PRACTICE'/));
check(() => assert.match(background, /resolveGuideRequestOrigin\(sender\.origin, message\.webapp_origin\)/));
check(() => assert.match(background, /practiceUrl\.origin !== requestOrigin/));
check(() => assert.match(background, /practiceUrl\.pathname !== '\/onboarding\/practice'/));
check(() => assert.match(background, /chrome\.tabs\.create\(\{ url: practiceUrl\.toString\(\), active: false \}/));
check(() => assert.match(background, /onboardingToken: typeof message\.onboardingToken === 'string'/));
check(() => assert.match(background, /onboarding_token: onboardingToken/));
check(() => assert.match(background, /onboardingQuery = data\.onboarding_practice/));
check(() => assert.match(background, /onboardingToken: null/));

console.log(JSON.stringify({ ok: true, checks, scope: 'recorder-onboarding-contract' }));

