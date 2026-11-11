import { test, expect } from '@playwright/test';

test('a missing account API is diagnosed and reconnect recovers after routing is restored', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/bootstrap', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const notice = page.locator('.account-service-notice');
  await expect(notice).toContainText('HTTP 404');
  await expect(notice).toContainText('The account API is not connected');
  await notice.getByText('Connection help', { exact: true }).click();
  await expect(notice).toContainText('npm run doctor');
  await page.unroute('**/api/bootstrap');
  await notice.getByRole('button', { name: 'Reconnect', exact: true }).click();
  await expect(notice).toHaveCount(0);
  const health = await page.request.get('/api/health').then((response) => response.json());
  expect(health.service).toBe('apex-account-api'); expect(health.ready).toBe(true);
  expect(errors).toEqual([]);
});

test('frontend-only HTML and unrelated JSON responses never masquerade as a connected account API', async ({ page }) => {
  await page.route('**/api/bootstrap', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Static frontend fallback</body></html>' }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.account-service-notice')).toContainText('webpage instead of account data');
  await page.unroute('**/api/bootstrap');
  await page.route('**/api/bootstrap', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ publicProject: true }) }));
  await page.locator('.account-service-notice').getByRole('button', { name: 'Reconnect', exact: true }).click();
  await expect(page.locator('.account-service-notice')).toContainText('not serving the current APEX account API');
  await page.unroute('**/api/bootstrap');
  await page.locator('.account-service-notice').getByRole('button', { name: 'Reconnect', exact: true }).click();
  await expect(page.locator('.account-service-notice')).toHaveCount(0);
});