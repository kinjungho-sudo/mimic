const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="50" fill="#3730a3"/>
  <text x="50" y="68" text-anchor="middle" font-family="Georgia, serif" font-size="62" font-weight="700" fill="white">M</text>
</svg>`;

const sizes = [16, 48, 128];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const size of sizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><style>* { margin: 0; padding: 0; } body { background: transparent; }</style></head>
      <body>${svgContent.replace('width="100" height="100"', `width="${size}" height="${size}"`)}</body>
      </html>
    `);

    const outPath = path.join(__dirname, '..', 'public', 'icons', `icon${size}.png`);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: size, height: size }, omitBackground: true });
    console.log(`Generated: icon${size}.png`);
  }

  await browser.close();
})();
