import { mkdir, copyFile, cp, readFile, writeFile } from 'node:fs/promises';
const root = new URL('./', import.meta.url);
await mkdir(new URL('dist/shared/', root), { recursive: true });
for (const file of ['style.css', 'app.js']) await copyFile(new URL(file, root), new URL(`dist/${file}`, root));
const domain = (await readFile(new URL('../CNAME', root), 'utf8')).trim();
const html = (await readFile(new URL('index.html', root), 'utf8'))
  .replaceAll('../shared/', './shared/')
  .replace('data-title="chatgourdspt"', `data-root="https://${domain}/" data-title="chatgourdspt"`);
await writeFile(new URL('dist/index.html', root), html);
for (const file of ['site.css', 'nav.js']) await copyFile(new URL(`../shared/${file}`, root), new URL(`dist/shared/${file}`, root));
await cp(new URL('vendor/', root), new URL('dist/vendor/', root), { recursive: true });
console.log('Static app ready in dist/');
