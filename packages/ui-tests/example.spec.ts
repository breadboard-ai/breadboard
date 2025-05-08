import { test, expect } from '@playwright/test';

test('smoke test', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Breadboard - Flows/);

  const headings = await page.getByRole("heading").allInnerTexts();
  expect(headings.filter(h => !!h)).toEqual([ "Breadboards are mini AI apps anyone can build", "Your Flows", "Gallery"]);

  await (await page.getByText(/Create New/)).click();
  
  // Checking for important interface buttons to be present.
  const buttons = await page.getByRole('button').allInnerTexts();
  for (const expectedButton of ['App view', 'Activity', 'User Input', 'Generate', 'Display', 'Edit Theme', 'Zoom to fit', 'Zoom in', 'Zoom out']) {
    expect(buttons, expectedButton).toContain(expectedButton);
  }

  // Ensuring weird "asset" button is present.
  expect(await page.locator('css=button span.title').allInnerTexts()).toContain('Asset');
  // Start button.
  expect(await page.getByTestId('run').innerText()).toEqual("Start");
  
  // Icons - history and share.
  expect(await page.getByLabel('Edit History').innerText()).toEqual('history');
  expect(await page.getByText('URL').count()).toEqual(1);  // Share button.

  
});

test.skip('get started link', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Click the get started link.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});
