// Saca los PNG de los posts: node posts/capturar.mjs [escala]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
// Playwright viene instalado de forma global en la máquina (no se añade al proyecto).
const { chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright');
import path from 'node:path';
import fs from 'node:fs';

const escala = Number(process.argv[2] || 2);
const dir = path.resolve('out/posts');
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
for (const post of ['1', '2'])
  for (const formato of ['feed', 'historia']) {
    const alto = formato === 'historia' ? 1920 : 1350;
    const page = await browser.newPage({ viewport: { width: 1080, height: alto }, deviceScaleFactor: escala });
    await page.goto('file://' + path.resolve('posts/posts.html') + `?post=${post}&formato=${formato}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const f = `${dir}/post${post}-${formato}.png`;
    await page.locator('.lienzo').screenshot({ path: f });
    console.log(f);
    await page.close();
  }
await browser.close();
