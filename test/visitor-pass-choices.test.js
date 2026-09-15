import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  VISITOR_PASS_CHOICES, shouldOfferVisitorPasses, visitorDetailsFromSignup, visitorPassChoices,
} from '../src/lib/visitorPassChoices.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('all three ways to pay are offered, priced from the club\'s own settings', () => {
  const choices = visitorPassChoices({
    casual_visit_price_cents: 2000,
    three_day_pass_price_cents: 3500,
    three_month_price_cents: 43000,
  });
  assert.deepEqual(choices.map(choice => choice.path), ['/casual', '/3daypass', '/3months']);
  assert.deepEqual(choices.map(choice => choice.charge), [2000, 3500, 43000]);
  // Each one has to say what it is, or the list is three prices and no choice.
  for (const choice of choices) assert.ok(choice.label && choice.blurb);
});

test('a running discount shows what is charged and what it was', () => {
  const [casual] = visitorPassChoices({
    casual_visit_price_cents: 2000,
    casual_visit_discount_cents: 1500,
    casual_visit_discount_enabled: true,
  });
  assert.equal(casual.charge, 1500);
  assert.equal(casual.full, 2000);
  assert.equal(casual.discounted, true);
});

test('prices fall back to the defaults rather than showing nothing', () => {
  for (const choice of visitorPassChoices({})) {
    assert.ok(Number.isInteger(choice.charge) && choice.charge > 0, choice.kind);
  }
});

test('the class sign-up name splits into the two the pass pages ask for', () => {
  assert.deepEqual(
    visitorDetailsFromSignup({ full_name: '  Kirra  Mc Phee ', email: ' A@B.test ', phone: '0400 000 000' }),
    { first_name: 'Kirra Mc', last_name: 'Phee', email: 'A@B.test', phone: '0400 000 000' },
  );
  // One word is a first name; inventing a surname would be worse than asking.
  assert.deepEqual(visitorDetailsFromSignup({ full_name: 'Casey' }).last_name, '');
  assert.equal(visitorDetailsFromSignup({ full_name: 'Casey' }).first_name, 'Casey');
  assert.deepEqual(visitorDetailsFromSignup({}), {
    first_name: '', last_name: '', email: '', phone: '',
  });
});

test('only a non-member is offered a pass, and only while payments are on', () => {
  assert.equal(shouldOfferVisitorPasses({ has_membership: false }, {}), true);
  // Selling a casual visit to somebody who already pays for a membership is
  // worse than saying nothing at all.
  assert.equal(shouldOfferVisitorPasses({ has_membership: true }, {}), false);
  // Unanswered is not the same as "no".
  assert.equal(shouldOfferVisitorPasses({}, {}), false);
  assert.equal(shouldOfferVisitorPasses(null, {}), false);
  assert.equal(
    shouldOfferVisitorPasses({ has_membership: false }, { casual_payments_enabled: false }), false);
});

test('nobody is asked to pay for a class they have not actually got into', () => {
  // A waitlisted sign-up holds no spot, and registered interest is not a
  // booking. Taking money for either would be selling a class that may never
  // happen for them.
  for (const outcome of [
    { waitlisted: true },
    { bookings_open: false },
    { booking_mode: 'interest_only' },
  ]) {
    assert.equal(shouldOfferVisitorPasses({ has_membership: false, ...outcome }, {}), false,
      JSON.stringify(outcome));
  }
  assert.equal(shouldOfferVisitorPasses({ has_membership: false, took_spot: true }, {}), true);
});

test('the sign-up asks whether they are a member and will not submit without an answer', () => {
  const form = read('../src/components/public/BookingRequestForm.jsx');
  assert.match(form, /Do you already have a XERT membership\?/);
  assert.match(form, /hasMembership === null.*setError/s);
  // The answer and their details have to reach the page, or the confirmation
  // cannot offer anything and would ask for the same details again.
  assert.match(form, /has_membership: hasMembership/);
  assert.match(form, /full_name: form\.full_name, email: form\.email, phone: form\.phone/);
});

test('the timetable offers the passes on the confirmation and standing on the page', () => {
  const page = read('../src/pages/SoftLaunchTimetable.jsx');
  assert.match(page, /shouldOfferVisitorPasses\(bookingSuccess, settings\)/);
  assert.match(page, /offerPasses && \(\s*<VisitorPassChoices/);
  // The QR codes at the front desk are no use to somebody booking from home,
  // so the ways to pay are on the page whether or not anyone has booked.
  assert.match(page, /Not a member\?/);
});

test('a pass list with nobody\'s details does not overwrite remembered ones', () => {
  const component = read('../src/components/public/VisitorPassChoices.jsx');
  assert.match(component, /const carry = Boolean\(visitor\.email\)/);
  assert.match(component, /if \(carry\) rememberCasualVisitor\(visitor\)/);
});

test('every offered pass has a real public route behind it', () => {
  const routes = read('../src/App.jsx');
  for (const choice of VISITOR_PASS_CHOICES) {
    assert.ok(routes.includes(`path="${choice.path}"`), `${choice.path} is not a route`);
  }
});
