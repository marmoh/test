// Transforme web/dist/index.html (vite + singlefile) en page d'artefact (sans doctype/html/head/body).
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('web/dist/index.html', 'utf8');
const grab = (re) => [...src.matchAll(re)].map((m) => m[0]).join('\n');
const title = '<title>Ombrelune</title>';
const links = grab(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/g);
const styles = grab(/<style[\s\S]*?<\/style>/g);
const scripts = grab(/<script[\s\S]*?<\/script>/g);
const out = `${title}
<meta name="theme-color" content="#2b1317">
${links}
<style>:root{color-scheme:dark;--page-bg:#2b1317}html,body{height:100%;background:var(--page-bg)}</style>
${styles}
<div id="app"></div>
${scripts}
`;
writeFileSync('web/dist/ombrelune.html', out);
console.log('web/dist/ombrelune.html', (out.length / 1024).toFixed(0), 'KiB');
