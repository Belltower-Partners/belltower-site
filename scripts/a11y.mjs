// Accessibility check: runs axe (WCAG 2.1 A and AA rules) against the site served by `npm run preview`,
// at desktop and phone widths, on each memo tab. Exits non-zero if axe finds a violation.
//
//   npm run preview &        # serves ./dist on http://localhost:4321
//   npm run test:a11y
//
// Set CHROMIUM_PATH to use an already-installed Chromium instead of Playwright's own.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const url = process.env.SITE_URL || 'http://localhost:4321/';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failures = 0;

for (const width of [1440, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load' });
  const tabs = await page.locator('[role="tab"]').count();
  for (let i = 0; i < tabs; i++) {
    await page.locator('[role="tab"]').nth(i).click();
    const label = (await page.locator('[role="tab"]').nth(i).innerText()).replace(/\s+/g, ' ');
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    if (violations.length === 0) {
      console.log(`ok   ${width}px, tab "${label}"`);
      continue;
    }
    failures += violations.length;
    console.log(`FAIL ${width}px, tab "${label}"`);
    for (const v of violations) {
      console.log(`  - ${v.id} (${v.impact}): ${v.help}`);
      for (const n of v.nodes.slice(0, 5)) console.log(`      ${n.target.join(' ')}`);
    }
  }
  await context.close();
}

await browser.close();
if (failures) { console.error(`${failures} accessibility problem(s) found.`); process.exit(1); }
