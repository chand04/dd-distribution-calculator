import { test, expect, type Page } from '@playwright/test';

const RESULT_EMPTY = 'Choose your options and select Calculate.';

async function setup(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Distribution Calculator',
  );
}

const result = (page: Page) => page.locator('#result');
// Text boxes, addressed by role so that radio labels containing the words
// "value" and "probability" cannot match them.
const valueBox = (page: Page) =>
  page.getByRole('textbox', { name: /^(Value|Cutoff c)$/ });
const probBox = (page: Page) => page.getByRole('textbox', { name: 'Probability' });
const dfBox = (page: Page) =>
  page.getByRole('textbox', { name: 'Degrees of freedom' });
const calculate = (page: Page) => page.getByRole('button', { name: 'Calculate' });

test.describe('defaults', () => {
  test('shows the documented defaults and no answer until Calculate', async ({ page }) => {
    await setup(page);
    await expect(page.getByRole('radio', { name: /Standard normal/ })).toBeChecked();
    await expect(
      page.getByRole('radio', { name: 'A probability, from a value' }),
    ).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Left tail' })).toBeChecked();
    await expect(valueBox(page)).toHaveValue('1.96');
    await expect(result(page)).toHaveText(RESULT_EMPTY);
    // Degrees of freedom is irrelevant to the normal distribution.
    await expect(page.locator('#df')).toBeHidden();
  });

  test('calculates the default left tail', async ({ page }) => {
    await setup(page);
    await calculate(page).click();
    await expect(result(page)).toHaveText('P(Z ≤ 1.96) = 0.975002');
  });
});

test.describe('regions, normal', () => {
  const cases: Array<[string, string, string]> = [
    ['Right tail', '1.96', 'P(Z ≥ 1.96) = 0.0249979'],
    ['Central area, −c to c', '1.96', 'P(-1.96 ≤ Z ≤ 1.96) = 0.950004'],
    ['Two tails, outside −c and c', '1.96', 'P(Z ≤ -1.96 or Z ≥ 1.96) = 0.0499958'],
    ['Left tail', '0', 'P(Z ≤ 0) = 0.5'],
    ['Left tail', '-2.5', 'P(Z ≤ -2.5) = 0.00620967'],
  ];
  for (const [region, value, expected] of cases) {
    test(`${region} at ${value}`, async ({ page }) => {
      await setup(page);
      await page.getByRole('radio', { name: region }).check();
      await valueBox(page).fill(value);
      await calculate(page).click();
      await expect(result(page)).toHaveText(expected);
    });
  }
});

test.describe('Student’s t', () => {
  test('reveals degrees of freedom and reports it in the answer', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: /Student/ }).check();
    await expect(dfBox(page)).toBeVisible();
    await dfBox(page).fill('10');
    await valueBox(page).fill('2.228138852');
    await page.getByRole('radio', { name: 'Right tail' }).check();
    await calculate(page).click();
    await expect(result(page)).toHaveText(
      'P(T ≥ 2.22814) = 0.025 with df = 10',
    );
  });

  test('two-tail inverse at df = 10, p = 0.05', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: /Student/ }).check();
    await page.getByRole('radio', { name: 'A value, from a probability' }).check();
    await page.getByRole('radio', { name: 'Two tails, outside −c and c' }).check();
    await dfBox(page).fill('10');
    await probBox(page).fill('0.05');
    await calculate(page).click();
    const text = await result(page).innerText();
    expect(text).toContain('c = 2.22814');
    expect(text).toContain('in total');
    expect(text).toContain('Interval endpoints: -2.22814 and 2.22814');
    expect(text).toContain('Each tail has probability 0.025');
  });

  test('accepts fractional degrees of freedom', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: /Student/ }).check();
    await dfBox(page).fill('7.5');
    await valueBox(page).fill('2');
    await page.getByRole('radio', { name: 'Right tail' }).check();
    await calculate(page).click();
    await expect(result(page)).toContainText('with df = 7.5');
  });
});

test.describe('inverse mode, normal', () => {
  test('left tail p = 0.975', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: 'A value, from a probability' }).check();
    await probBox(page).fill('0.975');
    await calculate(page).click();
    await expect(result(page)).toHaveText(
      'Z = 1.95996 gives P(Z ≤ 1.95996) = 0.975',
    );
  });

  test('central area p = 0.95 names both endpoints', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: 'A value, from a probability' }).check();
    await page.getByRole('radio', { name: 'Central area, −c to c' }).check();
    await probBox(page).fill('0.95');
    await calculate(page).click();
    const text = await result(page).innerText();
    expect(text).toContain('c = 1.95996');
    expect(text).toContain('Interval endpoints: -1.95996 and 1.95996');
  });

  test('a two-tail probability is labelled as the total', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: 'A value, from a probability' }).check();
    await page.getByRole('radio', { name: 'Two tails, outside −c and c' }).check();
    await probBox(page).fill('0.05');
    await calculate(page).click();
    await expect(result(page)).toContainText('= 0.05 in total');
  });
});

test.describe('extreme values', () => {
  test('a near-certain probability is not shown as exactly 1', async ({ page }) => {
    await setup(page);
    await valueBox(page).fill('10');
    await calculate(page).click();
    await expect(result(page)).toHaveText('P(Z ≤ 10) = 1 - 7.61985e-24');
  });

  test('a tiny tail keeps its digits', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: 'Right tail' }).check();
    await valueBox(page).fill('20');
    await calculate(page).click();
    await expect(result(page)).toHaveText('P(Z ≥ 20) = 2.75362e-89');
  });

  test('an underflowing tail is reported as a bound, never as zero', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: 'Right tail' }).check();
    await valueBox(page).fill('45');
    await calculate(page).click();
    await expect(result(page)).toHaveText('P(Z ≥ 45) < 1e-308');
  });

  test('a probability indistinguishable from 1 is reported as a bound', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: 'Central area, \u2212c to c' }).check();
    await valueBox(page).fill('45');
    await calculate(page).click();
    await expect(result(page)).toHaveText(
      'P(-45 \u2264 Z \u2264 45) > 1 - 1e-308',
    );
  });

  test('inverse tail at p = 1e-24', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: 'A value, from a probability' }).check();
    await page.getByRole('radio', { name: 'Right tail' }).check();
    await probBox(page).fill('1e-24');
    await calculate(page).click();
    await expect(result(page)).toContainText('Z = 10.1992');
  });

  test('inverse tail at p = 1e-12', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: 'A value, from a probability' }).check();
    await page.getByRole('radio', { name: 'Right tail' }).check();
    await probBox(page).fill('1e-12');
    await calculate(page).click();
    await expect(result(page)).toContainText('Z = 7.03448');
  });

  test('a tiny central area keeps full relative precision', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: 'Central area, −c to c' }).check();
    await valueBox(page).fill('1e-10');
    await calculate(page).click();
    await expect(result(page)).toHaveText(
      'P(-1e-10 ≤ Z ≤ 1e-10) = 7.97885e-11',
    );
  });
});

test.describe('invalid input', () => {
  const cases: Array<[string, string, string]> = [
    ['empty', '', 'Enter a value as a number'],
    ['trailing garbage', '1.96abc', 'Enter a value as a number'],
    ['comma decimal', '1,96', 'Enter a value as a number'],
    ['bare text', 'NaN', 'Enter a value as a number'],
    ['infinity', 'Infinity', 'Enter a value as a number'],
    ['out of range', '1e9', 'magnitude at most'],
  ];
  for (const [label, value, message] of cases) {
    test(`rejects ${label}`, async ({ page }) => {
      await setup(page);
      await valueBox(page).fill(value);
      await calculate(page).click();
      await expect(result(page)).toContainText(message);
      await expect(valueBox(page)).toHaveAttribute('aria-invalid', 'true');
    });
  }

  test('accepts scientific notation', async ({ page }) => {
    await setup(page);
    await valueBox(page).fill('1.96e0');
    await calculate(page).click();
    await expect(result(page)).toHaveText('P(Z ≤ 1.96) = 0.975002');
  });

  test('rejects a negative symmetric cutoff', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: 'Central area, −c to c' }).check();
    await valueBox(page).fill('-1');
    await calculate(page).click();
    await expect(result(page)).toContainText('must be 0 or greater');
  });

  test('rejects a probability outside (0, 1)', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: 'A value, from a probability' }).check();
    for (const bad of ['0', '1', '-0.2', '1.5']) {
      await probBox(page).fill(bad);
      await calculate(page).click();
      await expect(result(page)).toContainText('greater than 0 and less than 1');
    }
  });

  test('rejects nonpositive and out-of-range degrees of freedom', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: /Student/ }).check();
    await dfBox(page).fill('0');
    await calculate(page).click();
    await expect(result(page)).toContainText('greater than 0');

    await dfBox(page).fill('-3');
    await calculate(page).click();
    await expect(result(page)).toContainText('greater than 0');

    await dfBox(page).fill('1e9');
    await calculate(page).click();
    await expect(result(page)).toContainText('outside the supported range');

    await dfBox(page).fill('abc');
    await calculate(page).click();
    await expect(result(page)).toContainText('Enter degrees of freedom');
  });
});

test.describe('stale answers', () => {
  test('changing a value clears the previous answer', async ({ page }) => {
    await setup(page);
    await calculate(page).click();
    await expect(result(page)).toContainText('0.975002');
    await valueBox(page).fill('1');
    await expect(result(page)).toHaveText(RESULT_EMPTY);
  });

  test('changing the region clears the previous answer', async ({ page }) => {
    await setup(page);
    await calculate(page).click();
    await expect(result(page)).toContainText('0.975002');
    await page.getByRole('radio', { name: 'Right tail' }).check();
    await expect(result(page)).toHaveText(RESULT_EMPTY);
  });

  test('changing the distribution clears the previous answer', async ({ page }) => {
    await setup(page);
    await calculate(page).click();
    await expect(result(page)).toContainText('0.975002');
    await page.getByRole('radio', { name: /Student/ }).check();
    await expect(result(page)).toHaveText(RESULT_EMPTY);
  });

  test('changing the mode clears the previous answer', async ({ page }) => {
    await setup(page);
    await calculate(page).click();
    await expect(result(page)).toContainText('0.975002');
    await page.getByRole('radio', { name: 'A value, from a probability' }).check();
    await expect(result(page)).toHaveText(RESULT_EMPTY);
  });
});

test.describe('controls', () => {
  test('Enter in an input calculates', async ({ page }) => {
    await setup(page);
    await valueBox(page).fill('1');
    await valueBox(page).press('Enter');
    await expect(result(page)).toHaveText('P(Z ≤ 1) = 0.841345');
  });

  test('Reset restores the defaults and clears the answer', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: /Student/ }).check();
    await page.getByRole('radio', { name: 'A value, from a probability' }).check();
    await page.getByRole('radio', { name: 'Right tail' }).check();
    await probBox(page).fill('0.1');
    await dfBox(page).fill('3');
    await calculate(page).click();
    await expect(result(page)).not.toHaveText(RESULT_EMPTY);

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByRole('radio', { name: /Standard normal/ })).toBeChecked();
    await expect(
      page.getByRole('radio', { name: 'A probability, from a value' }),
    ).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Left tail' })).toBeChecked();
    await expect(valueBox(page)).toHaveValue('1.96');
    await expect(page.locator('#df')).toBeHidden();
    await expect(result(page)).toHaveText(RESULT_EMPTY);
  });

  test('switching mode does not move focus', async ({ page }) => {
    await setup(page);
    // Focus somewhere that stays on screen across the switch, then change the
    // mode the way a programmatic change would, so that what is under test is
    // the page's own handler rather than the browser's click-focus convention
    // (which differs between Chromium and WebKit on macOS).
    await calculate(page).focus();
    await page.evaluate(() => {
      const radio = document.querySelector<HTMLInputElement>(
        'input[name="mode"][value="value"]',
      )!;
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(probBox(page)).toBeVisible();
    await expect(calculate(page)).toBeFocused();
  });

  // WebKit on macOS leaves radio buttons and buttons out of the Tab order
  // unless Full Keyboard Access is switched on, so the Tab-order walk is
  // checked in Chromium. Keyboard operation in Safari is covered by the manual
  // checks listed in README.md.
  test('every control is reachable and operable by keyboard alone', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit on macOS omits radios from the Tab order by default');
    await setup(page);
    await page.keyboard.press('Tab'); // normal
    await page.keyboard.press('ArrowDown'); // -> Student's t
    await expect(page.getByRole('radio', { name: /Student/ })).toBeChecked();
    await expect(dfBox(page)).toBeVisible();

    await page.keyboard.press('Tab'); // degrees of freedom
    await expect(dfBox(page)).toBeFocused();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('10');

    await page.keyboard.press('Tab'); // mode group
    await page.keyboard.press('Tab'); // region group
    await page.keyboard.press('ArrowDown'); // -> right tail
    await expect(page.getByRole('radio', { name: 'Right tail' })).toBeChecked();

    await page.keyboard.press('Tab'); // value
    await expect(valueBox(page)).toBeFocused();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('2.228138852');
    await page.keyboard.press('Enter');
    await expect(result(page)).toHaveText('P(T ≥ 2.22814) = 0.025 with df = 10');
  });
});

test.describe('branding', () => {
  test('the course logo and Haas wordmark load from the bundle', async ({ page }) => {
    await setup(page);
    for (const [cls, alt] of [['.dd-logo', 'Data & Decisions'], ['.haas-logo', 'Berkeley Haas']]) {
      const img = page.locator(cls);
      await expect(img).toHaveAttribute('alt', alt);
      // naturalWidth is 0 for an image that failed to load.
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);
      const src = await img.getAttribute('src');
      expect(src, 'assets must be served from this origin').not.toMatch(/^https?:/);
    }
  });

  test('a favicon is declared and served', async ({ page, request }) => {
    await setup(page);
    const icons = page.locator('link[rel="icon"]');
    await expect(icons).toHaveCount(2);
    for (const href of await icons.evaluateAll((els) =>
      els.map((el) => (el as HTMLLinkElement).getAttribute('href') ?? ''))) {
      expect(href).not.toMatch(/^https?:/);
      const response = await request.get(new URL(href, 'http://127.0.0.1:4173/').toString());
      expect(response.status(), href).toBe(200);
    }
  });
});

test.describe('deployment hygiene', () => {
  test('loads with no third-party requests and no console errors', async ({ page }) => {
    const external: string[] = [];
    const errors: string[] = [];
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
        external.push(r.url());
      }
    });
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));

    await setup(page);
    await calculate(page).click();
    await expect(result(page)).toContainText('0.975002');

    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('calculates with the network disconnected after load', async ({ page, context }) => {
    await setup(page);
    await context.setOffline(true);
    await valueBox(page).fill('2.5');
    await calculate(page).click();
    await expect(result(page)).toHaveText('P(Z ≤ 2.5) = 0.99379');
    await context.setOffline(false);
  });

  test('the page has no graphs, links away, or saved history', async ({ page }) => {
    await setup(page);
    await expect(page.locator('canvas, svg, iframe')).toHaveCount(0);
    await expect(page.locator('a[href]')).toHaveCount(0);
    const stored = await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookie: document.cookie,
    }));
    expect(stored).toEqual({ local: 0, session: 0, cookie: '' });
  });
});
