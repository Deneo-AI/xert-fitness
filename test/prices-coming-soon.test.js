import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeLaunchSettings, launchSettingsChanged } from '../src/lib/launchSettings.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

// `prices_coming_soon` existed to hide amounts on the public session-pack
// shop while the business finalised pack pricing. The shop retired with the
// packs, so the flag now gates nothing on the web and the toggle that set it
// was a control with no effect — worse than no control, because staff would
// reasonably expect flipping it to change what visitors see.

test('nothing on the web reads the retired pricing flag any more', () => {
  for (const file of [
    '../src/pages/Booking.jsx',
    '../src/components/public/HowToTrain.jsx',
    '../src/lib/launchSettings.js',
    '../src/components/admin/SoftLaunchSettings.jsx',
  ]) {
    const source = read(file);
    assert.ok(!source.includes('pricesComingSoon'), `${file} still reads the retired flag`);
    assert.ok(!source.includes('PRICES_COMING_SOON_LABEL'), `${file} still renders the coming-soon label`);
  }
  // And the toggle is gone, rather than sitting there doing nothing.
  assert.ok(!read('../src/components/admin/SoftLaunchSettings.jsx').includes('field="prices_coming_soon"'));
});

test('the settings row still round-trips the column it no longer uses', () => {
  // Dropping the field from the normalized shape would rewrite the saved
  // settings row for no gain, and the column is not null in the database.
  const date = '2026-08-01';
  assert.equal(
    normalizeLaunchSettings({ target_launch_date: date, prices_coming_soon: false }).prices_coming_soon, false);
  assert.equal(normalizeLaunchSettings({ target_launch_date: date }).prices_coming_soon, true);
  const base = { target_launch_date: date, prices_coming_soon: true };
  assert.equal(launchSettingsChanged(base, base), false);
  assert.equal(launchSettingsChanged({ ...base, prices_coming_soon: false }, base), true);
});

test('no public web surface sells a session pack', () => {
  for (const file of [
    '../src/pages/Booking.jsx',
    '../src/components/public/HowToTrain.jsx',
    '../src/pages/Home.jsx',
    '../src/pages/AppLanding.jsx',
    '../src/pages/CheckoutReturn.jsx',
    '../src/components/public/PublicFooter.jsx',
  ]) {
    const source = read(file);
    assert.ok(!/session pack/i.test(source), `${file} still mentions session packs`);
    assert.ok(!/class credit|session credit|Buy Packs/i.test(source), `${file} still mentions credits`);
    assert.ok(!/startCheckout|getProducts\(/.test(source), `${file} can still start a pack checkout`);
  }
});
