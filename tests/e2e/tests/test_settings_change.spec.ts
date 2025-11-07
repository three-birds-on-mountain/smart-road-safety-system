import { test, expect } from '@playwright/test';

test.describe('[E2E] Settings change', () => {
  test('updates summary pills when changing options', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '開啟設定' }).click();
    await page.getByRole('button', { name: /1 公里/ }).click();
    await expect(page.getByText('1000m')).toBeVisible();
    await page.getByLabelText('選擇 三個月內').click();
    await expect(page.getByText('三個月內')).toBeVisible();
  });
});
