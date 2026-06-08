const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('\n=== TEST 1: 로그인 페이지 렌더링 ===');
  await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle' });
  const title = await page.title();
  const googleBtn = await page.locator('button:has-text("Google로 로그인")').count();
  console.log('Title:', title);
  console.log('Google 버튼 존재:', googleBtn > 0 ? '✅' : '❌');
  await page.screenshot({ path: 'test-login.png' });

  console.log('\n=== TEST 2: 대시보드 미인증 접근 ===');
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
  const currentUrl = page.url();
  console.log('리다이렉트 URL:', currentUrl);
  console.log('로그인 페이지로 이동:', currentUrl.includes('/auth/login') ? '✅' : '❌');

  console.log('\n=== TEST 3: Google OAuth 버튼 클릭 ===');
  await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle' });
  const [response] = await Promise.all([
    page.waitForNavigation({ waitUntil: 'commit', timeout: 10000 }),
    page.locator('button:has-text("Google로 로그인")').click()
  ]);
  const oauthUrl = page.url();
  console.log('OAuth 리다이렉트 URL:', oauthUrl.substring(0, 80) + '...');
  const isGoogleOrSupabase = oauthUrl.includes('accounts.google.com') || oauthUrl.includes('supabase.co');
  console.log('Google/Supabase로 이동:', isGoogleOrSupabase ? '✅' : '❌');
  await page.screenshot({ path: 'test-oauth.png' });

  await browser.close();
  console.log('\n스크린샷 저장: test-login.png, test-oauth.png');
})();
