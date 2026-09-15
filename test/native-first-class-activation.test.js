import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const native = relative => readFile(
  new URL(`../ios/XertFitnessApp/XertFitnessApp/${relative}`, import.meta.url),
  'utf8',
);

test('native first-class activation retains exact intent through auth and checkout', async () => {
  const [navigation, root, booking, checkout] = await Promise.all([
    native('XertNavigation.swift'),
    native('Views/RootView.swift'),
    native('Views/BookingView.swift'),
    native('Services/PendingCheckoutStore.swift'),
  ]);

  assert.match(navigation, /struct XertFirstClassActivation[\s\S]*let sessionID: UUID[\s\S]*var stage:/);
  assert.match(root, /pendingProtectedNavigation = XertNavigationIntent\([\s\S]*\.classSession\(sessionID\)/);
  assert.match(root, /resumeFirstClassAfterCheckout[\s\S]*\.readyToBook[\s\S]*\.classSession\(sessionID\)/);
  assert.match(checkout, /let activationSessionID: UUID\?/);
  // The checkout leg of this journey is gone with the pack shop: keeping the
  // class in mind through sign-in is what still matters.
  assert.match(booking, /firstClassActivation\?\.matches\(session\.id\) == true/);
  assert.match(booking, /firstClassActivation\?\.stage == \.readyToBook/);
  assert.match(booking, /Ready — book your place below/);
  assert.ok(!/You need a session credit to book this class/.test(booking));
  assert.ok(!/Choose a session pack/.test(booking));
  assert.doesNotMatch(root, /resumeFirstClassAfterCheckout[\s\S]{0,800}store\.book\(/);
});

// Dormant rather than dead: the server only raises NO_CREDITS while class
// credits are switched on. If the club ever turns packs back on, a refusal
// must still land on the class it belongs to, not as a global error banner.
test('native no-credit booking is contextual instead of a global error', async () => {
  const [store, booking] = await Promise.all([
    native('Store/XertStore.swift'),
    native('Views/BookingView.swift'),
  ]);

  assert.match(store, /contains\("NO_CREDITS"\)[\s\S]*return \.needsCredits/);
  assert.match(booking, /outcome == \.needsCredits[\s\S]*onBookingNeedsCredits\(session\.id\)/);
});
