import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173');
await page.waitForTimeout(2000);

// Click TEST SIGNAL
const testBtn = await page.locator('button:has-text("TEST SIGNAL")');
if (await testBtn.count() > 0) {
  await testBtn.click();
  await page.waitForTimeout(2000);
}

// Find and click START BROADCAST
const startBtn = await page.locator('button:has-text("START")');
if (await startBtn.count() > 0) {
  await startBtn.first().click();
  await page.waitForTimeout(3000);
}

await page.screenshot({ path: 'test-results/stage-points.png', fullPage: false });
await browser.close();
