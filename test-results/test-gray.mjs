import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173');
await page.waitForTimeout(2500);

// Navigate to game
for (const btn of await page.locator('button').all()) {
  const text = await btn.textContent();
  if (text && text.includes('TEST SIGNAL')) { await btn.click(); break; }
}
await page.waitForTimeout(2500);
for (const btn of await page.locator('button').all()) {
  const text = await btn.textContent();
  if (text && text.includes('ENTER LIVE STAGE')) { await btn.click(); break; }
}
await page.waitForTimeout(2500);
for (const btn of await page.locator('button').all()) {
  const text = await btn.textContent();
  if (text && text.includes('快乐小狗')) { await btn.click(); break; }
}
await page.waitForTimeout(3000);

// Spend most points by placing many cheap props
// Place 6 bananas (3 each) = 18, leaving 17
for (let i = 0; i < 6; i++) {
  await page.mouse.move(60, 220);
  await page.mouse.down();
  await page.mouse.move(400 + i * 80, 300 + (i % 2) * 100, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}
await page.waitForTimeout(1000);

await page.screenshot({ path: 'test-results/stage-low-balance.png' });
console.log('Low balance test saved');
await browser.close();
