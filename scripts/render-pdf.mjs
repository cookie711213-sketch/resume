import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { buildSite } from './build-site.mjs';
import { createSiteServer } from './serve-site.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outputPath = path.join(
  root,
  'artifacts/이승환_ERP_CRM_개발자_이력서_2026-07.pdf',
);

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

async function close(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

export async function renderPdf() {
  await buildSite();
  await mkdir(path.dirname(outputPath), { recursive: true });

  const server = createSiteServer({ siteRoot: path.join(root, 'site') });
  let browser;
  try {
    const port = await listen(server);
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => {
        if (image.complete) return undefined;
        return new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      }));
    });
    await page.pdf({
      format: 'A4',
      path: outputPath,
      preferCSSPageSize: true,
      printBackground: true,
    });
  } finally {
    try {
      await browser?.close();
    } finally {
      await close(server);
    }
  }

  return outputPath;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const renderedPath = await renderPdf();
    console.log(`Rendered PDF: ${renderedPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  }
}
