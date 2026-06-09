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

// Drag expensive prop (rotating stage = 16) to test insufficient funds
await page.mouse.move(60, 620);
await page.mouse.down();
await page.mouse.move(700, 500, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(1000);

await page.screenshot({ path: 'test-results/stage-insufficient.png' });
console.log('Insufficient funds test saved');

// Now click UNDO to test refund
for (const btn of await page.locator('button').all()) {
  const text = await btn.textContent();
  if (text && text.includes('UNDO')) { await btn.click(); break; }
}
await page.waitForTimeout(1000);

await page.screenshot({ path: 'test-results/stage-undo.png' });
console.log('Undo test saved');
await browser.close();
