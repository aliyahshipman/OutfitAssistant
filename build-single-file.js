/*
 * Bundles the app into one self-contained index.html.
 *
 * Produces dist/outfit-planner.html with the stylesheet and every script
 * inlined, so the whole app is a single file you can double-click, email to
 * yourself, or drop onto a host. No build tools, no dependencies.
 *
 *   node build-single-file.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, 'dist');
const OUT = path.join(OUT_DIR, 'outfit-planner.html');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let html = read('index.html');

// Inline the stylesheet.
html = html.replace(
  /<link rel="stylesheet" href="css\/styles\.css">/,
  '<style>\n' + read('css/styles.css') + '\n</style>'
);

// Inline every script, in the order index.html declares them.
const scripts = [];
html = html.replace(/<script src="(js\/[^"]+)"><\/script>\s*/g, (match, src) => {
  scripts.push(src);
  return '';
});

const bundle = scripts
  .map((src) => '/* ===== ' + src + ' ===== */\n' + read(src))
  .join('\n\n');

html = html.replace('</body>', '<script>\n' + bundle + '\n</script>\n</body>');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);

const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log('Bundled ' + scripts.length + ' scripts into ' + path.relative(ROOT, OUT) + ' (' + kb + ' KB)');
