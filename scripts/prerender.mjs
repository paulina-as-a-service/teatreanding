/**
 * Runs after `vite build` and `vite build --ssr`. Injects the rendered page and the JSON-LD into dist/index.html.
 * Fails the build if the result has no text, so an empty shell never ships silently.
 */
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'dist', 'index.html');
const ssrEntry = path.join(root, 'dist-ssr', 'entry-server.js');

const { render } = await import(pathToFileURL(ssrEntry).href);
const { html, jsonLd } = render();

if (!html.includes('Producción Creativa')) {
  throw new Error('Prerender produced no course text; refusing to ship an empty page.');
}

const ld = `<script type="application/ld+json">${jsonLd.replace(/</g, '\\u003c')}</script>`;
let page = await readFile(htmlPath, 'utf8');

if (!page.includes('<div id="root"></div>')) throw new Error('#root placeholder not found in dist/index.html');
page = page.replace('<div id="root"></div>', `<div id="root">${html}</div>`);
page = page.replace('</head>', `    ${ld}\n  </head>`);

await writeFile(htmlPath, page);
await rm(path.join(root, 'dist-ssr'), { recursive: true, force: true });
console.log(`Prerendered dist/index.html (${Math.round(page.length / 1024)} KB)`);
