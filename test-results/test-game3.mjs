import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173');
await page.waitForTimeout(2500);

// Click TEST SIGNAL
const btns = await page.locator('button').all();
for (const btn of btns) {
  const text = await btn.textContent();
  if (text && text.includes('TEST SIGNAL')) {
    await btn.click();
    break;
  }
}
await page.waitForTimeout(2500);

// Click ENTER LIVE STAGE
const btns2 = await page.locator('button').all();
for (const btn of btns2) {
  const text = await btn.textContent();
  if (text && text.includes('ENTER LIVE STAGE')) {
    await btn.click();
    break;
  }
}
await page.waitForTimeout(2500);

// Click STAGE 01 快乐小狗
const btns3 = await page.locator('button').all();
for (const btn of btns3) {
  const text = await btn.textContent();
  if (text && text.includes('快乐小狗')) {
    await btn.click();
    break;
  }
}
await page.waitForTimeout(4000);

await page.screenshot({ path: 'test-results/stage-playing.png' });
console.log('Screenshot saved');
await browser.close();
