import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 20_000,
  fullyParallel: false,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
});
