// Bündelt das Spiel (src/main.js + Three.js) in web/game.js
import { build } from 'esbuild';
const watch = process.argv.includes('--watch');
const opts = {
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', outfile: 'web/game.js',
  minify: !process.argv.includes('--dev'), sourcemap: process.argv.includes('--dev') ? 'inline' : false,
  target: ['chrome120'], legalComments: 'none', logLevel: 'info',
};
if (watch) { const { context } = await import('esbuild'); const ctx = await context(opts); await ctx.watch(); }
else await build(opts);
