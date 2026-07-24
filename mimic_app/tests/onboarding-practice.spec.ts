import { expect, test } from '@playwright/test';

test('safe Parro practice flow is usable and never claims to publish', async ({ page }) => {
  await page.goto('/onboarding/practice');

  await expect(page.getByRole('heading', { name: '첫 매뉴얼 만들기를 연습해요' })).toBeVisible();
  await expect(page.getByText('안전한 연습 페이지', { exact: true })).toBeVisible();
  await expect(page.locator('[data-parro-guide="practice-primary-action"]')).toBeVisible();
  await expect(page.locator('[data-parro-guide="practice-input"]')).toBeVisible();
  await expect(page.locator('[data-parro-guide="practice-finish"]')).toBeVisible();

  await page.locator('[data-parro-guide="practice-primary-action"]').click();
  await expect(page.getByRole('button', { name: '시작됨 ✓' })).toBeVisible();

  await page.locator('[data-parro-guide="practice-input"]').fill('신규 입사자 안내');
  await expect(page.locator('[data-parro-guide="practice-input"]')).toHaveValue('신규 입사자 안내');

  await page.getByRole('button', { name: '완료 상태 확인' }).click();
  await expect(page.getByRole('button', { name: '확인 완료 ✓' })).toBeVisible();
  await expect(page.getByText(/자동 게시·공유되지 않습니다/)).toBeVisible();
});

