'use strict';
/** Tester für Cloud-Läufe (GitHub Actions) und CI – echtes Chromium via Playwright. */
const { createPlaywrightTester } = require('../testers/playwright-tester');

module.exports = {
  id: 'tester.playwright',
  name: 'Test-Labor (Cloud)',
  kind: 'quality',
  env: 'cloud',
  description: 'Testet Apps in der Cloud mit Chromium im Handy-Format.',
  provides: ['tester'],
  async start(ctx) {
    const t = await createPlaywrightTester();
    ctx.provide('tester', t, { priority: 5 });
    ctx.onStop(() => t.close());
  }
};
