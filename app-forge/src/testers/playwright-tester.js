'use strict';
/**
 * Playwright-Tester – testet Apps in echtem Chromium im Handy-Format.
 * Wird im Cloud-Modus (GitHub Actions), in CI und im Selbsttest verwendet.
 * Gleiche Schnittstelle wie der Electron-Tester: run(dir, opts) / rasterize(svg, size).
 */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { monkeyScript } = require('../core/monkey');

function findChromium() {
  if (process.env.FORGE_CHROMIUM_PATH) return process.env.FORGE_CHROMIUM_PATH;
  return undefined;
}

async function createPlaywrightTester({ viewport = { width: 390, height: 844 } } = {}) {
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    throw new Error('Playwright ist nicht installiert (npm i -D playwright && npx playwright install chromium).');
  }
  const browser = await playwright.chromium.launch({ headless: true, executablePath: findChromium() });

  async function run(dir, { durationMs = 6000, seed = 1, screenshot = true } = {}) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE' });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    let crashed = false;
    let loadFailed = null;
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 500));
    });
    page.on('pageerror', (e) => pageErrors.push(String(e.message || e).slice(0, 500)));
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    page.on('crash', () => { crashed = true; });
    const t0 = Date.now();
    try {
      await page.goto(pathToFileURL(path.join(dir, 'index.html')).href, { waitUntil: 'load', timeout: 20000 });
    } catch (e) {
      loadFailed = String(e.message || e).split('\n')[0];
    }
    await page.waitForTimeout(800);
    let shot = null;
    if (screenshot && !loadFailed && !crashed) {
      try {
        shot = await page.screenshot({ type: 'png' });
      } catch {
        shot = null;
      }
    }
    let monkey = null;
    if (!loadFailed && !crashed) {
      try {
        monkey = await page.evaluate(monkeyScript({ durationMs, seed }));
      } catch (e) {
        pageErrors.push(`Interaktionstest abgebrochen: ${String(e.message || e).split('\n')[0]}`);
      }
    }
    await context.close().catch(() => {});
    return { consoleErrors, pageErrors, crashed, loadFailed, monkey, screenshot: shot, durationMs: Date.now() - t0 };
  }

  async function rasterize(svg, size) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const sized = svg.replace(/width="\d+"\s+height="\d+"/, `width="${size}" height="${size}"`);
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${sized}</body></html>`);
    const buf = await page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    return buf;
  }

  return {
    name: 'playwright',
    isAvailable: () => browser.isConnected(),
    run,
    rasterize,
    close: () => browser.close()
  };
}

module.exports = { createPlaywrightTester };
