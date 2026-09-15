import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const homeURL = new URL(
  '../ios/XertFitnessApp/XertFitnessApp/Views/HomeView.swift',
  import.meta.url,
);

test('signed-in members reach their operational dashboard before promotional content', async () => {
  const home = await readFile(homeURL, 'utf8');

  assert.match(
    home,
    /DataAvailabilityNotice\(sources: Set\(XertDataSource\.allCases\)\)[\s\S]*memberDashboardSection[\s\S]*announcementsSection[\s\S]*NativeTrainingIdentity/,
  );
  assert.match(
    home,
    /private var memberDashboardSection: some View \{[\s\S]*if store\.isSignedIn \{[\s\S]*XertSection\(title: "Member dashboard"\)/,
  );
  assert.match(home, /if !store\.isSignedIn \{ nextUpSection \}/);
  // The dashboard led with a credit balance; it now leads with what is live.
  assert.ok(!/Text\("Session credits"\)/.test(home));
  assert.match(home, /if !store\.announcements\.isEmpty \{[\s\S]*Button\(action: openNoticeCenter\)/);
});

test('member dashboard chooses the true next active booking including today', async () => {
  const home = await readFile(homeURL, 'utf8');
  const nextBooking = home.match(
    /private var dashboardNextBooking: BookingItem\? \{([\s\S]*?)\n    \}/,
  )?.[1];

  assert.ok(nextBooking, 'dashboardNextBooking should remain a focused computed property');
  assert.match(nextBooking, /let now = Date\(\)/);
  assert.match(nextBooking, /\.filter \{ \$0\.isActiveClassPlace && \$0\.start_time > now \}/);
  assert.match(nextBooking, /\.min \{ \$0\.start_time < \$1\.start_time \}/);
  assert.doesNotMatch(nextBooking, /occursOnBrisbaneDay/);

  assert.match(home, /TimeZone\(identifier: "Australia\/Brisbane"\)/);
  assert.match(home, /dateFormat = "EEE d MMM · h:mm a"/);
  assert.match(
    home,
    /private func dashboardManageBookingButton\(_ booking: BookingItem\) -> some View \{[\s\S]*xertfitness:\/\/account\/bookings\/[\s\S]*booking\.id\.uuidString\.lowercased\(\)[\s\S]*Text\("Manage booking"\)/,
  );
  assert.match(
    home,
    /private var dashboardBookAnotherButton: some View \{[\s\S]*onNavigate\(\.booking\)[\s\S]*Text\("Book another"\)/,
  );
  assert.match(home, /if store\.isSignedIn && todayBookings\.count > 1/);
  assert.match(
    home,
    /\.filter \{ \$0\.isActiveClassPlace && \$0\.start_time > now && \$0\.occursOnBrisbaneDay\(\) \}/,
  );
});

test('member dashboard distinguishes loading, unavailable, stale and genuine empty states', async () => {
  const home = await readFile(homeURL, 'utf8');

  assert.match(home, /dashboardBookingsAreInitiallyLoading[\s\S]*Loading your next class/);
  assert.match(home, /store\.unavailableDataSources\.contains\(\.bookings\)[\s\S]*Next class unavailable/);
  assert.match(home, /Task \{ await store\.refresh\(\) \}/);
  assert.match(home, /No upcoming class booked[\s\S]*Book a class/);
  assert.match(home, /store\.isUsingStaleMemberData \|\| store\.unavailableDataSources\.contains\(\.bookings\)/);
  assert.match(home, /Booking details may be out of date/);
  assert.match(
    home,
    /private func dashboardBookingActions\(_ booking: BookingItem\) -> some View \{[\s\S]*dynamicTypeSize\.isAccessibilitySize[\s\S]*VStack\(spacing: 10\)[\s\S]*HStack\(spacing: 10\)/,
  );
});

test('glance summaries never turn missing data into a false zero', async () => {
  const home = await readFile(homeURL, 'utf8');

  // The credit tile and its "—" for an unknown balance are gone with the
  // credits themselves; the same honesty rule still governs what is left.
  assert.ok(!/dashboardCreditValue/.test(home));
  assert.ok(!/Text\("Session credits"\)/.test(home));
  assert.match(
    home,
    /private func dashboardPublicMetricValue[\s\S]*publicDataUpdatedAt == nil[\s\S]*return "—"/,
  );
  assert.match(home, /MetricView\(value: dashboardPublicMetricValue\(store\.sessions\.count, source: \.sessions\), label: "Classes"\)/);
});
