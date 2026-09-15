import {readMembersSource} from './helpers/member-source.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createFollowUpCopy, createFollowUpLog } from '../src/lib/memberFollowUp.js';

const member = {
  id: '9f2e03af-b55f-4f3f-86d4-b9c97648c908',
  full_name: 'Dene Palmer',
  email: 'dene@example.com',
  reason: 'credits_expiring',
  credits_expiring: 2,
  next_credit_expiry: '2026-07-18T00:00:00+10:00',
};

test('follow-up copy is personalized, actionable and URL encoded', () => {
  const copy = createFollowUpCopy(member, 'https://xertfitness.com.au/admin');
  assert.equal(copy.subject, 'Ready for your next XERT class?');
  assert.match(copy.emailBody, /^Hi Dene,/);
  assert.match(copy.emailBody, /https:\/\/xertfitness\.com\.au\/booking/);
  assert.match(copy.mailto, /^mailto:dene%40example\.com\?subject=/);
  assert.doesNotMatch(copy.mailto, /\s/);
});

test('nobody is chased about a balance they can no longer spend', () => {
  // Class credits are retired: nothing redeems one, so an email counting
  // somebody's expiring credits sends them to a door that will not open.
  for (const reason of ['credits_expiring', 'idle_credits']) {
    const copy = createFollowUpCopy({ ...member, reason }, 'https://xertfitness.com.au');
    for (const text of [copy.subject, copy.emailBody]) {
      assert.doesNotMatch(text, /credit/i, `${reason}: ${text}`);
      assert.doesNotMatch(text, /session pack/i, `${reason}: ${text}`);
    }
  }
});

test('follow-up copy covers each operational queue reason', () => {
  const reasons = [
    'no_first_booking', 'credits_expiring', 'idle_credits', 'renewal_due',
    'no_training_access',
  ];
  for (const reason of reasons) {
    const copy = createFollowUpCopy({ ...member, reason }, 'https://xertfitness.com.au');
    assert.ok(copy.subject.length > 10);
    // Every message still hands them somewhere to go: the timetable to book,
    // or the memberships page to start paying.
    assert.match(copy.emailBody, /\/booking|\/memberships/, reason);
  }
});

test('follow-up logs normalize channel and optional context', () => {
  assert.equal(
    createFollowUpLog(member, 'sms', '  Asked to call back tomorrow.  '),
    'Contacted via SMS about booking their next class. Asked to call back tomorrow.'
  );
  assert.equal(
    createFollowUpLog({ reason: 'renewal_due' }, 'in_person'),
    'Contacted via in person about training renewal.'
  );
  assert.throws(() => createFollowUpLog(member, 'fax'), /Choose how/);
  assert.throws(() => createFollowUpLog(member, 'email', 'x'.repeat(501)), /500 characters/);
});

test('member queue exposes tailored drafts and explicit audited completion', () => {
  const source = readMembersSource();
  assert.match(source, /createFollowUpCopy\(member, window\.location\.origin\)/);
  assert.match(source, /href=\{contact\.mailto\}/);
  assert.match(source, /Log Follow-up/);
  assert.match(source, /adminAddMemberNote\(member\.id, 'follow_up', body\)/);
  assert.match(source, /removes the member from the follow-up queue for seven days/);
});
