// Captura de la landing oculta a 390 y 1440 px: node posts/landing.mjs [url]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const { chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright');

const url = process.argv[2] || 'http://localhost:3107/medellin';
fs.mkdirSync('out/landing', { recursive: true });
const browser = await chromium.launch();
for (const [nombre, width, height] of [['movil', 390, 844], ['escritorio', 1440, 900]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  // Chromium de Playwright no reproduce H.264: se queda el póster, que basta para revisar.
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log(nombre, 'scrollWidth', ancho, 'viewport', width);
  await page.screenshot({ path: `out/landing/${nombre}.png`, fullPage: true });
  await page.close();
}
await browser.close();
