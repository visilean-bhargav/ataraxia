// Renders the app icons with the pre-installed Chromium.  node tools/icons.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>
<radialGradient id="g" cx="50%" cy="46%" r="70%"><stop offset="0" stop-color="#1c5c60"/><stop offset=".6" stop-color="#123a42"/><stop offset="1" stop-color="#0e2328"/></radialGradient></defs>
<rect width="512" height="512" fill="url(#g)"/>
<g fill="none" stroke-linecap="round" transform="translate(256 256) scale(${pad})">
<circle r="34" fill="#dd92d3"/>
<circle r="86" stroke="#dd92d3" stroke-width="20" opacity=".9"/>
<circle r="140" stroke="#90a2ee" stroke-width="16" opacity=".65"/>
<circle r="190" stroke="#78bdcd" stroke-width="12" opacity=".4"/></g></svg>`;
const b = await chromium.launch();
for (const [name, size, pad] of [['apple-touch-icon', 180, 0.92], ['icon-192', 192, 0.92], ['icon-512', 512, 0.92], ['icon-maskable-512', 512, 0.68]]) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg(pad)}`);
  await p.screenshot({ path: new URL(`../icons/${name}.png`, import.meta.url).pathname });
  await p.close();
}
await b.close();
