import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

/**
 * Automated checks only. They catch markup and contrast defects; they are not
 * evidence that the page works with VoiceOver or any other screen reader.
 * See README.md for the manual screen-reader checks that still have to be run
 * by a person.
 */
const valueBox = (page: Page) =>
  page.getByRole('textbox', { name: /^(Value|Cutoff c)$/ });

async function scan(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
}

test('no automated accessibility violations on load', async ({ page }) => {
  await page.goto('/');
  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

test('no automated accessibility violations with an answer on screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.locator('#result')).toContainText('0.975002');
  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

test('no automated accessibility violations with an error on screen', async ({ page }) => {
  await page.goto('/');
  await valueBox(page).fill('oops');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.locator('#result')).toContainText('Enter a value');
  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

test('no automated accessibility violations in the t layout', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: /Student/ }).check();
  await page.getByRole('radio', { name: 'A value, from a probability' }).check();
  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

test('narrow screen: usable with no horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.locator('#result')).toContainText('0.975002');
  expect((await scan(page)).violations).toEqual([]);
});

test('200% zoom: usable with no horizontal scrolling', async ({ page }) => {
  // 200% zoom at a 1280x720 window is equivalent to a 640x360 CSS viewport.
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.locator('#result')).toContainText('0.975002');
  expect((await scan(page)).violations).toEqual([]);
});

test('enlarged text: no horizontal scrolling at 200% text size', async ({ page }) => {
  // Text-only resize, which is a different failure mode from page zoom: the
  // viewport keeps its width while every length in rem or em grows.
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.locator('#result')).toContainText('0.975002');
});

test('the cutoff pair in a region label never breaks across lines', async ({ page }) => {
  for (const width of [320, 360, 640, 1000]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const pairs = page.locator('.nowrap');
    await expect(pairs).toHaveCount(2);
    const lines = await pairs.evaluateAll((els) =>
      els.map((el) => el.getClientRects().length));
    expect(lines, `at ${width}px`).toEqual([1, 1]);
  }
});

test('the result is a polite live region, announced once', async ({ page }) => {
  await page.goto('/');
  const output = page.locator('#result');
  await expect(output).toHaveAttribute('aria-live', 'polite');
  await expect(output).toHaveAttribute('role', 'status');
  // One statement, not a visible notation plus a hidden expansion of it.
  await page.getByRole('button', { name: 'Calculate' }).click();
  const spans = await output.locator('span').count();
  expect(spans).toBe(1);
  await expect(page.locator('#result [aria-hidden], #result [aria-label]')).toHaveCount(0);
});

test('every control has a visible label and a visible focus ring', async ({ page }) => {
  await page.goto('/');
  for (const id of ['value', 'probability', 'df']) {
    const label = page.locator(`label[for="${id}"]`);
    await expect(label).toHaveCount(1);
  }
  const field = valueBox(page);
  await field.focus();
  const outline = await field.evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(parseFloat(outline)).toBeGreaterThan(0);
});
