import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const accountURL = new URL(
  '../ios/XertFitnessApp/XertFitnessApp/Views/AccountView.swift',
  import.meta.url,
);

const walletOf = source => source.slice(
  source.indexOf('private var membershipSection'),
  source.indexOf('private var reminderSettingsSection'),
);

test('the phone app no longer sells session packs', async () => {
  const source = await readFile(accountURL, 'utf8');
  const wallet = walletOf(source);
  // The app never read the class-credits switch, so every member saw a wallet,
  // a balance of zero and a "Buy session packs" button for a product that has
  // not existed since packs were retired.
  assert.ok(!/Buy session packs/.test(wallet));
  assert.ok(!/booking\/packs/.test(wallet));
  assert.ok(!/Session credits & packs/.test(wallet));
});

test('a member who still holds credits can still see them', async () => {
  const source = await readFile(accountURL, 'utf8');
  const wallet = walletOf(source);
  // They paid for these. Hiding a balance somebody bought would read as taking
  // it off them, so the wallet is kept — for exactly the people who have one.
  assert.match(source, /private var hasLegacyCredits: Bool \{ store\.creditTotal > 0 \}/);
  assert.match(wallet, /if hasLegacyCredits \{[\s\S]*creditSummary[\s\S]*creditBatchWallet/);
  assert.match(wallet, /hasLegacyCredits \? "Membership & remaining credits" : "Membership"/);
});

test('the wallet it still shows stays honest and accessible', async () => {
  const source = await readFile(accountURL, 'utf8');
  const wallet = walletOf(source);
  assert.match(wallet, /Text\("Available balance"\)/);
  assert.match(wallet, /store\.creditTotal/);
  assert.match(wallet, /Text\("Next expiry"\)/);
  assert.match(wallet, /Active credit batches/);
  assert.match(wallet, /\\\(batch\.remaining\) of \\\(batch\.total\) remaining/);
  assert.match(wallet, /batch\.remaining > 0/);
  assert.match(wallet, /batch\.expires_at\.map \{ \$0 > now \} \?\? true/);

  // Unknown, loading and unavailable must never read as a genuine zero.
  assert.match(wallet, /Loading your credit wallet/);
  assert.match(wallet, /store\.isLoading && !store\.creditBalanceLoaded/);
  assert.match(wallet, /Credit wallet unavailable/);
  assert.match(wallet, /unavailableDataSources\.contains\(\.credits\) && !store\.creditBalanceLoaded/);
  assert.match(source, /private var creditsUnavailableOrLoading: Bool \{[\s\S]*!store\.creditBalanceLoaded/);

  assert.match(wallet, /ViewThatFits\(in: \.horizontal\)/);
  assert.match(wallet, /dynamicTypeSize\.isAccessibilitySize/);
});
