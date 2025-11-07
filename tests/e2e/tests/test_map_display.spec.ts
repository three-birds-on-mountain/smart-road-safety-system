import { test, expect } from '@playwright/test';

test.describe('[E2E] Map display', () => {
  test('loads base map and settings button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('map-view')).toBeVisible();
    await expect(page.getByRole('button', { name: '開啟設定' })).toBeVisible();
  });
});
