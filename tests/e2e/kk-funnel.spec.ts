import { test, expect } from '@playwright/test';

test('KK funnel: Apply → KK profiling → redirect → resume SKEAP', async ({ page, baseURL }) => {
  // Use a deterministic program slug used in dev; adjust if your app uses a different slug
  const programSlug = '/programs/skeap';

  // 1. Open program page and click Apply
  await page.goto(programSlug);
  await expect(page).toHaveURL(new RegExp(`${programSlug}`));

  const applyButton = page.getByRole('button', { name: /Apply for SKEAP/i });
  await expect(applyButton).toBeVisible();
  await applyButton.click();

  // 2. Eligibility modal appears; click 'Go to KK Profiling'
  const goToKkButton = page.getByRole('button', { name: /Go to KK Profiling/i });
  await expect(goToKkButton).toBeVisible();
  await goToKkButton.click();

  // 3. Should navigate to KK profiling page with redirect param
  await page.waitForURL(/\/programs\/kk-profiling\?redirect=/);
  await expect(page.url()).toContain('/programs/kk-profiling');

  // 4. Fill required KK fields (minimal required set for test)
  await page.fill('input[placeholder*="Sitio Central"]', 'Sitio Test, Barangay Pico, La Trinidad, Benguet');
  await page.fill('input[name="lastName"]', 'TestLast');
  await page.fill('input[name="firstName"]', 'TestFirst');
  await page.fill('input[name="middleInitial"]', 'T');
  await page.selectOption('select[name="sex"]', { label: 'Male' });
  await page.fill('input[name="age"]', '20');
  await page.fill('input[name="birthDate"]', '2006-01-01');
  const testEmail = `e2e+kk+${Date.now()}@example.com`;
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[name="contactNumber"]', '09171234567');
  // consent
  await page.check('input[type="checkbox"]');

  // submit
  await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/programs/kk-profiling/register') && resp.status() === 200),
    page.click('button[type="submit"]'),
  ]);

  // 5. Success modal appears with expected header and CTA
  await expect(page.getByRole('heading', { name: /Profiling submitted/i })).toBeVisible();
  const proceedBtn = page.getByRole('button', { name: /View KK Profiling Status/i });
  await expect(proceedBtn).toBeVisible();

  // 6. Click proceed and assert we are taken to the KK Profiling status page
  await proceedBtn.click();
  await page.waitForURL(/\/programs\/kk-profiling\/status/);
  await expect(page.getByText(/KK Profiling Status/i)).toBeVisible();
});
