import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
async function open(page: Page, path = '') {
  await page.goto(`./${path}`);
  await expect(page.getByText('Replay engine ready', { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    const motions = document
      .getAnimations()
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(motions.map((a) => a.finished.catch(() => undefined)));
  });
}
async function configure(page: Page, policy = 'healthy', name = 'Ledger Relay') {
  await open(
    page,
    `destinations?edit=${name === 'Ledger Relay' ? 'dest_ledger' : 'dest_match'}`,
  );
  await page.getByLabel('Response policy').selectOption(policy);
  await page
    .getByLabel('Reason for change')
    .fill('Reviewed simulator recovery for integration test');
  await page.getByRole('button', { name: 'Save configuration', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function replay(
  page: Page,
  ids = ['evt_001796'],
  reason = 'Verified recovery after destination review',
) {
  await open(page, 'deliveries?status=failed&destination=dest_ledger');
  for (const id of ids) await page.getByLabel(`Select ${id}`, { exact: true }).check();
  await page.getByRole('button', { name: /Replay selected/ }).click();
  await page.getByLabel('Reason for replay').fill(reason);
  await page.getByRole('button', { name: /^Queue \d+ deliver/ }).click();
  await expect(page.getByRole('heading', { name: 'Replay runs', exact: true })).toBeVisible();
}
async function menu(page: Page, label: string) {
  if (await page.getByRole('button', { name: 'Open navigation', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Workspace navigation' })
    .getByRole('link', { name: label, exact: true })
    .click();
}
test('overview derives actual totals and remains within the viewport', async ({
  page,
}, info) => {
  await open(page);
  await expect(
    page.getByRole('heading', { name: 'Every event. Accounted for.' }),
  ).toBeVisible();
  await expect(page.getByText('93.8', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('1,689', { exact: false }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: info.outputPath('overview.png'), fullPage: true });
});
test('navigation, route focus and command search work with keyboard', async ({ page }) => {
  await open(page);
  await menu(page, 'Destinations');
  await expect(page.getByRole('heading', { name: 'Destinations', exact: true })).toBeFocused();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('textbox', { name: 'Search workspace pages' }).fill('contract');
  await page.getByRole('textbox', { name: 'Search workspace pages' }).press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Contract playground', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('filters are shareable and pagination can advance and go back', async ({ page }) => {
  await open(page, 'deliveries?status=failed&destination=dest_ledger');
  await page.getByRole('button', { name: 'Use paginated table', exact: true }).click();
  await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous page', exact: true }).click();
  await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Search deliveries', exact: true })
    .fill('evt_001796');
  await expect(
    page.getByRole('button', { name: 'Inspect evt_001796', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/q=evt_001796/);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Inspect evt_001796', exact: true }),
  ).toBeVisible();
});
test('virtual table bounds its DOM and inspector restores focus', async ({ page }) => {
  await open(page, 'deliveries');
  expect(await page.locator('tbody tr').count()).toBeLessThan(60);
  await page.getByRole('button', { name: 'Inspect evt_001800', exact: true }).click();
  await expect(page.getByText('Contract validation failed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Inspect evt_001800', exact: true }),
  ).toBeFocused();
});
test('review excludes invalid contracts and replays eligible events through the worker', async ({
  page,
}) => {
  await configure(page);
  await replay(page, ['evt_001800', 'evt_001796']);
  await expect(page.getByText('Run completed', { exact: true })).toBeVisible();
  await expect(page.getByText('1 delivered', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Run completed', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'evt_001796', exact: true }).click();
  await page.getByRole('button', { name: 'Attempts 2', exact: true }).click();
  await expect(page.getByText('HTTP 202', { exact: true })).toBeVisible();
  await expect(page.getByText('HTTP 503', { exact: true })).toBeVisible();
});
test('pause survives reload, resume works and cancellation is explicit', async ({ page }) => {
  await configure(page);
  await open(page, 'deliveries?status=failed&destination=dest_ledger');
  await page.getByLabel('Select 25 filtered deliveries', { exact: true }).check();
  await page.getByRole('button', { name: /Replay selected/ }).click();
  await page
    .getByLabel('Reason for replay')
    .fill('Controlled batch recovery with operator review');
  await page.getByLabel('Maximum dispatch rate').selectOption('1');
  await page.getByRole('button', { name: /^Queue \d+ deliver/ }).click();
  await page.getByRole('button', { name: 'Pause run', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume run', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume run', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume run', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause run', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel remaining', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancel remaining', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Pause run', exact: true })).toHaveCount(0);
  await expect(page.locator('.run-detail .badge').first()).toHaveText('cancelled');
});
test('intermittent policies retry and persist the actual attempts', async ({ page }) => {
  await configure(page, 'intermittent');
  await replay(page);
  await expect(page.getByText('Run completed', { exact: true })).toBeVisible();
  await expect(page.getByText('2 tries', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'evt_001796', exact: true }).click();
  await page.getByRole('button', { name: 'Attempts 3', exact: true }).click();
  await expect(page.getByText('HTTP 502', { exact: true })).toBeVisible();
  await expect(page.getByText('HTTP 202', { exact: true })).toBeVisible();
});
test('configuration conflicts across tabs do not overwrite the first save', async ({
  page,
  context,
}) => {
  await open(page, 'destinations?edit=dest_ledger');
  const other = await context.newPage();
  await open(other, 'destinations?edit=dest_ledger');
  await page.getByLabel('Response policy').selectOption('healthy');
  await page.getByLabel('Reason for change').fill('First tab recovery review');
  await page.getByRole('button', { name: 'Save configuration', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await other.getByLabel('Response policy').selectOption('rate_limited');
  await other.getByLabel('Reason for change').fill('Stale configuration review');
  await other.getByRole('button', { name: 'Save configuration', exact: true }).click();
  await expect(other.getByRole('alert')).toContainText('changed in another tab');
  await other.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await other.getByRole('button', { name: 'Configure Ledger Relay', exact: true }).click();
  await expect(other.getByLabel('Response policy')).toHaveValue('healthy');
});
test('playground rejects malformed JSON and queues only reviewed valid events', async ({
  page,
}) => {
  await open(page, 'playground');
  await page
    .getByRole('textbox', { name: 'Event JSON payload', exact: true })
    .fill('{ invalid');
  await page.getByRole('button', { name: 'Validate contract', exact: true }).click();
  await expect(page.getByText('Contract needs attention', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Queue test event', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Fresh example', exact: true }).click();
  await page.getByRole('button', { name: 'Validate contract', exact: true }).click();
  await expect(page.getByText('Contract is valid', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Queue test event', exact: true }).click();
  await expect(page.getByText('Test event queued', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Follow delivery run', exact: true }).click();
  await expect(page.getByText('Run completed', { exact: true })).toBeVisible();
});
test('export downloads a real parseable evidence bundle', async ({ page }) => {
  await configure(page);
  await replay(page);
  await expect(page.getByText('Run completed', { exact: true })).toBeVisible();
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export evidence', exact: true }).click();
  const file = await waiting;
  const path = await file.path();
  expect(path).not.toBeNull();
  const json = JSON.parse(await readFile(path!, 'utf8')) as {
    mode: string;
    runs: { reason: string; status: string }[];
    deliveries: { eventId: string; status: string; attempts: { code: number }[] }[];
  };
  expect(json.mode).toBe('local-simulator');
  expect(json.runs[0]).toMatchObject({
    status: 'completed',
    reason: 'Verified recovery after destination review',
  });
  expect(json.deliveries).toHaveLength(1);
  expect(json.deliveries[0]).toMatchObject({ eventId: 'evt_001796', status: 'delivered' });
  expect(json.deliveries[0]!.attempts.at(-1)?.code).toBe(202);
});
test('motion preference persists and reduced-motion removes decorative animation', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Pause interface motion', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Enable interface motion', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Enable interface motion', exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page.locator('.page-heading').evaluate((e) => getComputedStyle(e).animationName),
  ).toBe('none');
});
test('storage failures never produce a saved configuration toast', async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (
        value &&
        typeof value === 'object' &&
        'revision' in value &&
        typeof value.revision === 'number' &&
        value.revision > 0
      )
        throw new DOMException('Storage quota reached', 'QuotaExceededError');
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    };
  });
  await open(page, 'destinations?edit=dest_ledger');
  await page.getByLabel('Response policy').selectOption('healthy');
  await page.getByLabel('Reason for change').fill('Configuration should fail safely');
  await page.getByRole('button', { name: 'Save configuration', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('quota');
  await expect(page.getByText('Destination settings saved.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
});
test('unreadable storage is preserved until an explicit reset', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('rafrelay-corruption-seeded')) return;
    sessionStorage.setItem('rafrelay-corruption-seeded', 'yes');
    const request = indexedDB.open('rafrelay-workspace-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction('workspace', 'readwrite');
      tx.objectStore('workspace').put(
        { schemaVersion: 999, evidence: 'preserve this' },
        'primary',
      );
      tx.oncomplete = () => db.close();
    };
  });
  await page.goto('./');
  await expect(
    page.getByRole('heading', { name: 'The workspace needs attention', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Export recovery data', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset local workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Keep existing data', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'The workspace needs attention', exact: true }),
  ).toBeVisible();
});
test('main routes and the event dialog have no serious accessibility violations', async ({
  page,
}) => {
  for (const path of ['', 'deliveries', 'destinations', 'runs', 'playground']) {
    await open(page, path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations, `${path || 'overview'} accessibility`).toEqual([]);
  }
  await open(page, 'deliveries?inspect=dlv_001796');
  await expect(page.getByRole('dialog')).toBeVisible();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(result.violations).toEqual([]);
});
