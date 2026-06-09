import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173');
await page.waitForTimeout(2500);

// Click TEST SIGNAL button by text
const btns = await page.locator('button').all();
for (const btn of btns) {
  const text = await btn.textContent();
  if (text && text.includes('TEST SIGNAL')) {
    await btn.click();
    break;
  }
}
await page.waitForTimeout(2500);

// Click START BROADCAST
const btns2 = await page.locator('button').all();
for (const btn of btns2) {
  const text = await btn.textContent();
  if (text && text.includes('START')) {
    await btn.click();
    break;
  }
}
await page.waitForTimeout(3000);

await page.screenshot({ path: 'test-results/stage-game.png' });
console.log('Screenshot saved');
await browser.close();
