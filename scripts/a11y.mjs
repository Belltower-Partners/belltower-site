// Accessibility check: runs axe (WCAG 2.1 A and AA rules) against the site served by `npm run preview`,
// at desktop and phone widths: the coming-soon screen and password box (while the gate is on),
// then each memo tab as an unlocked visitor sees it. Exits non-zero if axe finds a violation.
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

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

async function check(page, label) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  if (violations.length === 0) { console.log(`ok   ${label}`); return; }
  failures += violations.length;
  console.log(`FAIL ${label}`);
  for (const v of violations) {
    console.log(`  - ${v.id} (${v.impact}): ${v.help}`);
    for (const n of v.nodes.slice(0, 5)) console.log(`      ${n.target.join(' ')}`);
  }
}

for (const width of [1440, 390]) {
  // The "Coming soon" screen and its password box, when the gate is on.
  const gateContext = await browser.newContext({ viewport: { width, height: 900 } });
  const gatePage = await gateContext.newPage();
  await gatePage.goto(url, { waitUntil: 'load' });
  if (await gatePage.locator('[data-gate]').count()) {
    await check(gatePage, `${width}px, coming-soon screen`);
    await gatePage.keyboard.type('ring');
    await gatePage.locator('.gate-dialog[open]').waitFor();
    await check(gatePage, `${width}px, password box`);
  }
  await gateContext.close();

  // The site itself, as a browser that has already entered the password sees it.
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(() => { try { localStorage.setItem('belltower-unlocked', '1'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load' });
  const tabs = await page.locator('[role="tab"]').count();
  for (let i = 0; i < tabs; i++) {
    await page.locator('[role="tab"]').nth(i).click();
    const label = (await page.locator('[role="tab"]').nth(i).innerText()).replace(/\s+/g, ' ');
    await check(page, `${width}px, tab "${label}"`);
  }
  await context.close();
}

await browser.close();
if (failures) { console.error(`${failures} accessibility problem(s) found.`); process.exit(1); }
