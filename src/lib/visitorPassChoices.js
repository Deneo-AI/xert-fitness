// ─── Paying for the class you just booked ───────────────────────────────────
// Someone books a class on the website, and nothing tells them what happens
// next. Memberships are not linked to the site yet, so there is no account to
// charge — the visitor passes are sold on their own pages, reached by QR codes
// at the front desk that a person booking from home has never seen. They end
// up booked in and unable to pay.
//
// So the sign-up asks whether they are already a member, and anyone who is not
// is offered the three ways to pay, priced from the club's own settings.

import {
  CASUAL_VISIT_ACTION, THREE_DAY_PASS_ACTION, THREE_MONTH_MEMBERSHIP_ACTION,
  visitorPassPricing,
} from './casualVisit.js';

export const VISITOR_PASS_CHOICES = Object.freeze([
  Object.freeze({
    kind: CASUAL_VISIT_ACTION,
    path: '/casual',
    label: 'Casual visit',
    blurb: 'This class only.',
  }),
  Object.freeze({
    kind: THREE_DAY_PASS_ACTION,
    path: '/3daypass',
    label: 'Three Day Pass',
    blurb: 'Three days of training to try us properly.',
  }),
  Object.freeze({
    kind: THREE_MONTH_MEMBERSHIP_ACTION,
    path: '/3months',
    label: 'Three month membership',
    blurb: 'Three months, paid upfront.',
  }),
]);

/**
 * The three ways to pay, with today's prices. A pass whose discount is running
 * carries the full price too, so the page can show what was struck out.
 */
export function visitorPassChoices(settings = {}) {
  return VISITOR_PASS_CHOICES.map(choice => ({
    ...choice, ...visitorPassPricing(choice.kind, settings),
  }));
}

/**
 * The visitor details a pass page expects, from what the class sign-up asked.
 *
 * The sign-up takes one full name and the pass pages take two, so the last
 * word is the surname and everything before it is the given name — which keeps
 * double-barrelled and multi-part first names intact. A single word leaves the
 * surname blank rather than guessing: the pass page asks for it, and a name
 * typed in by the person it belongs to beats one this invented.
 */
export function visitorDetailsFromSignup(signup = {}) {
  const parts = String(signup.full_name || '').trim().split(/\s+/).filter(Boolean);
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || '';
  return {
    first_name: first,
    last_name: last,
    email: String(signup.email || '').trim(),
    phone: String(signup.phone || '').trim(),
  };
}

/**
 * Whether to offer the passes after a sign-up.
 *
 * Only to somebody who said they are not a member — a member already pays
 * through their membership, and being sold a casual visit on top of it is
 * worse than saying nothing — and only while the club is taking visitor
 * payments at all.
 *
 * And only when there is something to pay for. A waitlisted sign-up holds no
 * spot, and registered interest is not a booking: asking either of them for
 * money would be taking payment for a class they may never get into.
 */
export function shouldOfferVisitorPasses(signup, settings = {}) {
  if (signup?.has_membership !== false) return false;
  if (settings?.casual_payments_enabled === false) return false;
  if (signup.waitlisted) return false;
  if (signup.bookings_open === false || signup.booking_mode === 'interest_only') return false;
  return true;
}
