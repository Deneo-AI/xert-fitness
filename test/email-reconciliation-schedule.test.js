import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL(
  '../supabase/migrations/20260918030000_reconcile_email_log_on_a_schedule.sql', import.meta.url), 'utf8');

test('the email log reconciles on a schedule, not when somebody opens a page', () => {
  // Every email since 4 September read "queued", including ones the provider
  // accepted with a 200. The sending was fine: the status only moved when an
  // admin opened the email screen, and pg_net discards the provider's answer
  // after a few hours, so the evidence was usually gone before anyone looked.
  assert.match(sql, /create extension if not exists pg_cron/);
  assert.match(sql, /cron\.schedule\('reconcile-email-log', '\*\/5 \* \* \* \*'/);
  // Five minutes has to stay well inside pg_net's retention, or this fixes
  // nothing; the job exists precisely because that window is short.
  assert.match(sql, /interval '6 hours'/);
});

test('the scheduled runner has no session to check, and no way in from outside', () => {
  // The admin-only entry point could never run here: a scheduler has no
  // logged-in admin. So the work moved to a function without that check —
  // which makes locking it down the whole safety argument.
  assert.match(sql, /create or replace function public\.reconcile_email_log\(\)[\s\S]*security definer/);
  assert.ok(!/create or replace function public\.reconcile_email_log\(\)[\s\S]{0,400}auth\.uid\(\)/.test(sql),
    'the scheduled runner must not depend on a session');
  assert.match(sql, /revoke all on function public\.reconcile_email_log\(\) from public, anon, authenticated/);
  assert.match(sql, /raise exception 'The unauthenticated reconciler must not be reachable by anon or authenticated\.'/);
});

test('the admin button still works, and still checks who is pressing it', () => {
  assert.match(sql, /create or replace function public\.admin_reconcile_email_log\(\)[\s\S]*if auth\.uid\(\) is null or not public\.is_admin\(\) then[\s\S]*raise exception 'ADMIN_REQUIRED'/);
  // Same work, written once.
  assert.match(sql, /return public\.reconcile_email_log\(\);/);
  assert.match(sql, /grant execute on function public\.admin_reconcile_email_log\(\) to authenticated/);
});

test('an answer that can no longer be checked says so', () => {
  // "Queued" goes on implying something is about to happen. Once the provider
  // response has expired, nobody can know, and the log should admit it.
  assert.match(sql, /status = 'unknown', error = 'PROVIDER_RESPONSE_EXPIRED'/);
  assert.match(sql, /status_code between 200 and 299 and not coalesce\(responses\.timed_out, false\) then 'sent' else 'failed'/);
});
