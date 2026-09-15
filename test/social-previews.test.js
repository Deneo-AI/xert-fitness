import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PUBLIC_METADATA, SITE_ORIGIN } from '../src/lib/pageMetadata.js';
import { pageHTML } from '../scripts/prerender-social-previews.mjs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const template = read('../index.html');

const meta = (html, attribute, name) => {
  const match = html.match(
    new RegExp(`<meta[^>]*\\s${attribute}="${name}"[^>]*\\scontent="([^"]*)"`, 'i'));
  return match?.[1] ?? null;
};

test('every public route prerenders its own title, description and URL', () => {
  for (const [path, page] of Object.entries(PUBLIC_METADATA)) {
    const html = pageHTML(template, { path, ...page, origin: SITE_ORIGIN });
    const url = `${SITE_ORIGIN}${path}`;

    assert.equal(html.match(/<title>([\s\S]*?)<\/title>/)[1], page.title, `${path} title`);
    assert.equal(meta(html, 'name', 'description'), page.description, `${path} description`);
    assert.equal(meta(html, 'property', 'og:title'), page.title, `${path} og:title`);
    assert.equal(meta(html, 'property', 'og:description'), page.description, `${path} og:description`);
    // og:url is where the preview sends whoever taps it, and the canonical is
    // what search engines record: both must name this page, not the home page.
    assert.equal(meta(html, 'property', 'og:url'), url, `${path} og:url`);
    assert.equal(html.match(/<link rel="canonical" href="([^"]*)"/)[1], url, `${path} canonical`);
  }
});

test('prerendering leaves the rest of the document alone', () => {
  const html = pageHTML(template, {
    path: '/about', ...PUBLIC_METADATA['/about'], origin: SITE_ORIGIN,
  });
  // The app still has to boot: only what a scraper reads should change.
  assert.ok(html.includes('<div id="root">'), 'app mount point survived');
  assert.equal(meta(html, 'property', 'og:image'), meta(template, 'property', 'og:image'));
  assert.equal(meta(html, 'name', 'twitter:card'), 'summary_large_image');
  assert.equal(html.match(/<script type="application\/ld\+json">/g)?.length, 1);
});

test('titles and descriptions are escaped, not injected raw', () => {
  const html = pageHTML(template, {
    path: '/about', title: 'Ampersand & "quotes"', description: '<script>bad</script>',
    origin: SITE_ORIGIN,
  });
  assert.ok(html.includes('<title>Ampersand &amp; &quot;quotes&quot;</title>'));
  assert.equal(meta(html, 'name', 'description'), '&lt;script&gt;bad&lt;/script&gt;');
});

test('the build prerenders previews before the precache manifest is written', () => {
  const build = JSON.parse(read('../package.json')).scripts.build;
  assert.ok(build.includes('scripts/prerender-social-previews.mjs'),
    'build must prerender the per-route previews');
  // The precache manifest is stamped from the built output, so it has to be
  // written after the pages it lists have been rewritten.
  assert.ok(build.indexOf('prerender-social-previews')
    < build.indexOf('inject-pwa-precache'), 'prerender must run before precache injection');
});

test('no public tag points at the deployment host or at a redirect', () => {
  for (const file of ['../index.html', '../public/sitemap.xml', '../public/robots.txt']) {
    const source = read(file);
    assert.ok(!source.includes('xert-fitness.vercel.app'),
      `${file} still advertises the Vercel host, so shared links preview and open there`);
    assert.ok(source.includes(SITE_ORIGIN), `${file} should name the club's domain`);
    // The bare domain 308-redirects to the www host, so a tag naming it costs
    // every scraper and crawler an extra hop to reach the real page.
    assert.ok(!/https:\/\/xertfitness\.com\.au/.test(source),
      `${file} names the bare domain, which only redirects`);
  }
  assert.equal(SITE_ORIGIN, 'https://www.xertfitness.com.au');
});
