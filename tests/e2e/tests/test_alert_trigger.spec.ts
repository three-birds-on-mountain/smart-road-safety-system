import { test, expect } from '@playwright/test';

test.describe('[E2E] Alert trigger flow', () => {
  test('shows GPS status badge', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/等待定位/)).toBeVisible();
  });
});
