// Baut die Handy-App (web/) nach dist-web/ – statische Dateien für GitHub Pages.
import { defineConfig } from 'vite';
export default defineConfig({
  root: 'web',
  base: './',
  publicDir: 'public',
  build: { outDir: '../dist-web', emptyOutDir: true, target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 600 },
  server: { host: true, port: 5180 },
});
