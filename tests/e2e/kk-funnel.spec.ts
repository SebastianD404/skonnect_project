import { test, expect } from '@playwright/test';

test('KK profiling requires signup and rejects guest submissions', async ({ page }) => {
  await page.goto('/programs/kk-profiling');

  await expect(page).toHaveURL(/\/signup\?next=/);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByLabel('Confirm password')).toBeVisible();
  await expect(page.getByLabel(/First Name|Last Name|Birth Date/)).toHaveCount(0);

  const activeEndpoint = await page.request.post('/api/programs/kk-profiling/register-with-id');
  expect(activeEndpoint.status()).toBe(401);

  const legacyEndpoint = await page.request.post('/api/programs/kk-profiling/register');
  expect(legacyEndpoint.status()).toBe(410);
});
