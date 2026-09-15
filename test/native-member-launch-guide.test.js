import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const native = relative => readFile(
  new URL(`../ios/XertFitnessApp/XertFitnessApp/${relative}`, import.meta.url),
  'utf8',
);

test('native home presents one state-derived member launch step immediately after its hero', async () => {
  const [home, resolver] = await Promise.all([
    native('Views/HomeView.swift'),
    native('MemberLaunchGuide.swift'),
  ]);

  assert.match(home, /NativeHomeHero\([\s\S]*MemberLaunchGuideCard\([\s\S]*NativeValueStrip\(\)/);
  assert.match(resolver, /enum MemberLaunchGuideResolver/);
  for (const state of [
    'signIn',
    'completeReadiness',
    'bookFirstClass',
    'enableReminder',
    'activated',
  ]) {
    assert.match(resolver, new RegExp(`case ${state}`));
  }
  assert.match(resolver, /if let nextActiveBookingID[\s\S]*return \.activated/);
  // The guide used to gate the last step on having credits, which nothing can
  // grant any more — so every ready member parked on "choose your session
  // access" for good. A ready member with nothing booked now goes to booking.
  assert.ok(!/chooseAccess/.test(resolver));
  assert.ok(!/creditTotal/.test(resolver));
  assert.match(resolver, /guard bookingsLoaded else \{ return \.checking \}[\s\S]*return \.bookFirstClass/);
});

test('launch guide keeps actions typed, accessible and explicit', async () => {
  const [root, home] = await Promise.all([
    native('Views/RootView.swift'),
    native('Views/HomeView.swift'),
  ]);

  assert.match(root, /onOpenRoute: \{ openMemberRoute\(\$0, source: \.content\) \}/);
  assert.match(home, /onOpenRoute\(\.upcomingBookings\(bookingID\)\)/);
  assert.match(home, /store\.setClassRemindersEnabled\(true\)/);
  assert.match(home, /ViewThatFits\(in: \.horizontal\)/);
  assert.match(home, /\.frame\(minHeight: 44\)/);
  assert.match(home, /\.accessibilityHint\(actionHint\)/);
});
