import { test, expect } from '@playwright/test';
import { createBridge } from '../.github/extensions/kbx-canvas-foundation/src/http-server.mjs';
import { createFoundationState } from '../.github/extensions/kbx-canvas-foundation/src/contracts.mjs';

test('generic canvas shell renders and toggles theme', async ({ page }) => {
  const stateStore = new Map();
  const bridge = await createBridge({ stateStore, providerId: 'kbx-canvas-foundation' });
  stateStore.set('ui-demo', createFoundationState({
    artifactId: 'ui-demo',
    title: 'UI demo canvas',
    theme: 'dark',
    items: [{ id: 'item-1', title: 'Issue DAG placeholder', status: 'active', description: 'Hooks into the future DAG variant.' }],
    links: [{ id: 'li-1', label: 'Template 4 variant', href: 'https://example.com/template-4' }],
  }));

  await page.goto(`http://127.0.0.1:${bridge.port}/canvas/ui-demo?artifactId=ui-demo`);
  await expect(page.getByRole('heading', { name: 'UI demo canvas' })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: 'Add sample item' }).click();
  await expect(page.getByText('Follow-up action')).toBeVisible();

  await bridge.close();
});
