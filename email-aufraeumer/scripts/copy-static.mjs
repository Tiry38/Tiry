import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('build/renderer', { recursive: true });
for (const f of ['index.html', 'style.css']) cpSync(`src/renderer/${f}`, `build/renderer/${f}`);
cpSync('src/renderer/fonts', 'build/renderer/fonts', { recursive: true });
