import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);
  
  // Click TEST SIGNAL button
  await page.click('button:has-text("TEST SIGNAL")');
  await page.waitForTimeout(1500);
  
  // Click the enabled start button
  await page.click('button:has-text("START")');
  await page.waitForTimeout(2000);
  
  // Screenshot the game stage
  await page.screenshot({ path: 'test-results/stage-with-points.png' });
  
  await browser.close();
})();
