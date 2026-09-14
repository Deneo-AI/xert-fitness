// Social scrapers do not run JavaScript. Facebook, WhatsApp and iMessage read
// the HTML exactly as the server sends it, so a single-page app hands every
// shared link the same preview — the home page — no matter which page was
// shared. Worse, whatever `og:url` says is where the preview points, so a tag
// naming the deployment host sends people to the wrong address entirely.
//
// Vercel serves a real file in preference to the SPA catch-all rewrite, so
// this writes a copy of the built index.html per public route with that route's
// own title, description and URL. The app still boots and routes normally; only
// what a scraper reads changes. No serverless function, and nothing to keep in
// sync by hand — the routes come from the same table the browser uses.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');

const escapeHTML = value => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Replace one meta tag's content, matching however the attributes are ordered. */
function setMeta(html, attribute, name, value) {
  const pattern = new RegExp(
    `(<meta[^>]*\\s${attribute}="${name}"[^>]*\\scontent=")[^"]*(")`,
    'i',
  );
  if (pattern.test(html)) return html.replace(pattern, `$1${escapeHTML(value)}$2`);
  const reversed = new RegExp(
    `(<meta[^>]*\\scontent=")[^"]*("[^>]*\\s${attribute}="${name}")`,
    'i',
  );
  return html.replace(reversed, `$1${escapeHTML(value)}$2`);
}

export function pageHTML(template, { path, title, description, origin }) {
  const url = `${origin}${path === '/' ? '/' : path}`;
  let html = template
    .replace(/(<title>)[\s\S]*?(<\/title>)/i, `$1${escapeHTML(title)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/i, `$1${escapeHTML(url)}$2`);
  html = setMeta(html, 'name', 'description', description);
  html = setMeta(html, 'property', 'og:title', title);
  html = setMeta(html, 'property', 'og:description', description);
  html = setMeta(html, 'property', 'og:url', url);
  return html;
}

async function main() {
  const [template, metadataSource] = await Promise.all([
    readFile(join(dist, 'index.html'), 'utf8'),
    readFile(join(root, 'src/lib/pageMetadata.js'), 'utf8'),
  ]);

  // Read the route table from source rather than importing it: the module
  // pulls in browser-only code, and this runs in plain Node during the build.
  const { PUBLIC_METADATA, SITE_ORIGIN } = await import(
    `data:text/javascript,${encodeURIComponent(
      metadataSource
        .split('\n')
        .filter(line => !line.startsWith('import '))
        .join('\n'),
    )}`
  );

  const routes = Object.entries(PUBLIC_METADATA).filter(([path]) => path !== '/');
  for (const [path, meta] of routes) {
    const html = pageHTML(template, { path, ...meta, origin: SITE_ORIGIN });
    const directory = join(dist, path.replace(/^\//, ''));
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.html'), html);
  }

  // The home page keeps its own copy at the root, with the canonical origin.
  const home = PUBLIC_METADATA['/'];
  await writeFile(
    join(dist, 'index.html'),
    pageHTML(template, { path: '/', ...home, origin: SITE_ORIGIN }),
  );

  console.log(`Social previews prerendered: ${routes.length + 1} pages at ${SITE_ORIGIN}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
