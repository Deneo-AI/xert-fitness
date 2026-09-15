import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('native brand typography scales with Dynamic Type', async () => {
  const source = await readFile(
    new URL('../ios/XertFitnessApp/XertFitnessApp/Theme.swift', import.meta.url),
    'utf8',
  );

  assert.match(source, /\.custom\("BebasNeue-Regular", size: size, relativeTo: textStyle\)/);
  assert.match(source, /UIFontMetrics\(forTextStyle: textStyle\)\.scaledFont/);
  assert.match(source, /size >= 36[\s\S]*\.largeTitle/);
  assert.doesNotMatch(source, /return \.custom\("BebasNeue-Regular", size: size\)/);

  const home = await readFile(
    new URL('../ios/XertFitnessApp/XertFitnessApp/Views/HomeView.swift', import.meta.url),
    'utf8',
  );
  // Every display font on this screen has to scale; which sizes happen to be
  // present changes as sections come and go.
  assert.doesNotMatch(home, /displayFont\(size: \d+\)/);
  assert.ok((home.match(/displayFont\(size: \d+, relativeTo: \./g) || []).length >= 2);
  assert.match(home, /@Environment\(\\\.dynamicTypeSize\) private var dynamicTypeSize/);
  assert.ok((home.match(/dynamicTypeSize\.isAccessibilitySize/g) || []).length >= 3);
  assert.match(home, /if dynamicTypeSize\.isAccessibilitySize \{[\s\S]*VStack\(spacing: 12\)/);
  assert.match(home, /if dynamicTypeSize\.isAccessibilitySize \{[\s\S]*VStack\(spacing: 14\)/);

  const booking = await readFile(
    new URL('../ios/XertFitnessApp/XertFitnessApp/Views/BookingView.swift', import.meta.url),
    'utf8',
  );
  assert.match(booking, /@Environment\(\\\.dynamicTypeSize\) private var dynamicTypeSize/);
  assert.ok((booking.match(/dynamicTypeSize\.isAccessibilitySize/g) || []).length >= 1);
  assert.match(booking, /private func sessionHeader/);
  assert.match(booking, /private func sessionMetadata/);

  const events = await readFile(
    new URL('../ios/XertFitnessApp/XertFitnessApp/Views/EventsView.swift', import.meta.url),
    'utf8',
  );
  assert.match(events, /@Environment\(\\\.dynamicTypeSize\) private var dynamicTypeSize/);
  assert.equal((events.match(/dynamicTypeSize\.isAccessibilitySize/g) || []).length, 2);
  assert.match(events, /if dynamicTypeSize\.isAccessibilitySize \{\s*eventDetails\(event\)/);
  assert.match(events, /private func eventDateLabel/);

  const account = await readFile(
    new URL('../ios/XertFitnessApp/XertFitnessApp/Views/AccountView.swift', import.meta.url),
    'utf8',
  );
  assert.match(account, /@Environment\(\\\.dynamicTypeSize\) private var dynamicTypeSize/);
  assert.equal((account.match(/dynamicTypeSize\.isAccessibilitySize/g) || []).length, 2);
  assert.match(account, /private var signedInSummary/);
  assert.match(account, /private func purchaseName/);
  assert.doesNotMatch(account, /\.lineLimit\(2\)/);
});
