import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
];

const sectionIds = ['experience', 'cases', 'skills', 'projects', 'background'];
const roleText = 'ERP·CRM 백엔드 중심 풀스택 개발자';

function isLocalUrl(value) {
  try {
    return ['localhost', '127.0.0.1'].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

for (const viewport of viewports) {
  test(`${viewport.width}x${viewport.height} keeps the public resume usable`, async ({ page }, testInfo) => {
    const consoleErrors = [];
    const pageErrors = [];
    const failedLocalRequests = [];

    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const sourceUrl = message.location().url;
      if (!sourceUrl || isLocalUrl(sourceUrl)) {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) => {
      if (isLocalUrl(request.url())) {
        failedLocalRequests.push(`${request.url()}: ${request.failure()?.errorText ?? 'request failed'}`);
      }
    });
    page.on('response', (response) => {
      if (isLocalUrl(response.url()) && response.status() >= 400) {
        failedLocalRequests.push(`${response.url()}: HTTP ${response.status()}`);
      }
    });

    await page.setViewportSize(viewport);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 5_000)),
      ]);
      await Promise.all([...document.images].map((image) => {
        if (image.complete) return undefined;
        return new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      }));
    });

    await expect.soft(page.getByText(roleText, { exact: true })).toBeVisible({ timeout: 500 });
    for (const id of sectionIds) {
      await expect.soft(page.locator(`#${id}`), `#${id} should be visible`).toBeVisible({ timeout: 500 });
    }

    const layout = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      shells: [...document.querySelectorAll('.resume-shell')].map((element) => {
        const rectangle = element.getBoundingClientRect();
        return { left: rectangle.left, right: rectangle.right, width: rectangle.width };
      }),
    }));
    expect.soft(layout.documentWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect.soft(layout.bodyWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect.soft(layout.shells.length, 'Expected at least one .resume-shell').toBeGreaterThan(0);
    for (const rectangle of layout.shells) {
      expect.soft(rectangle.left).toBeGreaterThanOrEqual(-0.5);
      expect.soft(rectangle.right).toBeLessThanOrEqual(layout.clientWidth + 0.5);
      expect.soft(rectangle.width).toBeLessThanOrEqual(layout.clientWidth + 1);
    }

    const unsafeBlankLinks = await page.locator('a[target="_blank"]').evaluateAll((links) => {
      return links
        .filter((link) => !(link.rel ?? '').split(/\s+/).includes('noopener'))
        .map((link) => link.getAttribute('href'));
    });
    expect.soft(unsafeBlankLinks).toEqual([]);

    const screenshotDirectory = path.resolve('artifacts/screenshots');
    await mkdir(screenshotDirectory, { recursive: true });
    await page.screenshot({
      fullPage: true,
      path: path.join(
        screenshotDirectory,
        `${testInfo.project.name}-${viewport.width}x${viewport.height}.png`,
      ),
    });

    expect.soft(consoleErrors, 'Console errors').toEqual([]);
    expect.soft(pageErrors, 'Page errors').toEqual([]);
    expect.soft(failedLocalRequests, 'Failed local requests').toEqual([]);
  });
}
