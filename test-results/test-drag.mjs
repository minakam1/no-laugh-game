import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173');
await page.waitForTimeout(2500);

// Click TEST SIGNAL
for (const btn of await page.locator('button').all()) {
  const text = await btn.textContent();
  if (text && text.includes('TEST SIGNAL')) { await btn.click(); break; }
}
await page.waitForTimeout(2500);

// Click ENTER LIVE STAGE
for (const btn of await page.locator('button').all()) {
  const text = await btn.textContent();
  if (text && text.includes('ENTER LIVE STAGE')) { await btn.click(); break; }
}
await page.waitForTimeout(2500);

// Click STAGE 01
for (const btn of await page.locator('button').all()) {
  const text = await btn.textContent();
  if (text && text.includes('快乐小狗')) { await btn.click(); break; }
}
await page.waitForTimeout(3000);

// Drag a prop from panel to canvas
// The banana prop is at around x=60, y=200, canvas center is around x=700, y=500
await page.mouse.move(60, 220);
await page.mouse.down();
await page.mouse.move(700, 500, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(1000);

await page.screenshot({ path: 'test-results/stage-drag.png' });
console.log('Drag test screenshot saved');
await browser.close();
