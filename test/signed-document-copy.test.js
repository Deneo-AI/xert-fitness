import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const migration = () => read('../supabase/migrations/20260914010000_email_signed_document_copy.sql');

test('somebody who signs is sent their own copy, from the wording they signed', async () => {
  const sql = await migration();

  assert.match(sql, /add column if not exists email_copy_to_respondent boolean not null default false/);
  assert.match(sql, /create trigger email_on_form_response\s+after insert on public\.xert_form_responses/);
  assert.match(sql, /if not found or not v_form\.email_copy_to_respondent then return new; end if/,
    'a form that is not a document to keep sends nothing');

  // The copy is built from the snapshot taken when they signed, so a later
  // revision of the agreement never rewrites what somebody was sent.
  assert.match(sql, /coalesce\(r\.form_snapshot -> 'questions'/);
  assert.match(sql, /coalesce\(nullif\(btrim\(new\.form_snapshot ->> 'title'\), ''\)/);

  // Turned on for the three documents people actually sign.
  assert.match(sql, /where slug in \('terms-and-conditions', 'peq', 'peq-casual'\)/);
});

test('a signature is reported, never printed, and prose is left out', async () => {
  const sql = await migration();

  // A signature is a data URL tens of thousands of characters long. Printing
  // it would wreck the email and tell the reader nothing.
  assert.match(sql, /p_question ->> 'type' = 'signature' then[\s\S]*?then 'Signed' else '' end/);

  // The agreement runs to about fifty thousand characters of prose. Inlining
  // it would be clipped by every mail client, so the email carries the answers
  // and links to the document.
  assert.match(sql, /\(q ->> 'type'\) not in \('section_break', 'statement'\)/);
  assert.match(sql, /v_cta := 'Read the full terms';\s*v_link := 'https:\/\/xertfitness\.com\.au\/terms'/);
  // A questionnaire has no readable page — linking to its own form would open
  // a blank one to fill in again rather than show what was signed.
  assert.match(sql, /else\s*v_cta := null;\s*v_link := null;\s*end if;/);

  // A hidden question is not part of what they were asked.
  assert.match(sql, /coalesce\(\(q ->> 'hidden'\)::boolean, false\) = false/);
});

test('a failure to email can never undo somebody signing', async () => {
  const sql = await migration();
  const body = sql.slice(sql.indexOf('function public.email_form_response_copy'));

  assert.match(body, /begin\s+perform public\.queue_email\([\s\S]*?exception when others then[\s\S]*?raise notice/,
    'the send is wrapped so a mail failure does not roll back the signature');
  // Nothing is sent anywhere without a real address to send it to.
  assert.match(body, /v_email !~ '\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$' then return new/);
});

test('staff choose which forms do this, and a new form does not by default', async () => {
  const forms = await read('../src/lib/xertForms.js');
  // A new form is not a document somebody signs until somebody says it is.
  assert.match(forms, /notify_admin: true, email_copy_to_respondent: false,/);
  assert.match(forms, /'one_response_per_email', 'notify_admin', 'email_copy_to_respondent'/,
    'the flag is saved with the form');

  const screen = await read('../src/components/admin/FormsSurveysManager.jsx');
  assert.match(screen, /checked=\{draft\.email_copy_to_respondent\}/);
  assert.match(screen, /label="Email the person a copy"/);
  assert.match(screen, /somebody signs and should keep/);
});

test('the copy reaches somebody who typed their email into the form, not just the column', async () => {
  const sql = await read('../supabase/migrations/20260918010000_signed_copy_reads_questionnaire_contact.sql');

  // The questionnaires ask for an email as a question, so it lands in `answers`
  // and respondent_email stays null. Reading only the column meant the terms
  // and conditions sent a copy and both pre-exercise questionnaires silently
  // did not — three of the first four people who signed got nothing.
  assert.match(sql, /nullif\(btrim\(new\.respondent_email\), ''\),\s*\n\s*new\.answers ->> 'e4c4e161-43e3-5462-a865-f27c411ac809'/);
  // The name has the same split, so the greeting is not "Hello," for everyone.
  assert.match(sql, /new\.answers #>> '\{84703ad7-a28d-4904-9868-6c832ce38055,first\}'/);
  assert.match(sql, /new\.answers #>> '\{84703ad7-a28d-4904-9868-6c832ce38055,last\}'/);

  // An address that is still unreadable must stop the send, not send nowhere.
  assert.match(sql, /if v_email !~ '\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$' then return new; end if;/);
  // The trigger is rebuilt, or the fixed function never runs.
  assert.match(sql, /create trigger email_on_form_response/);
  // Only the agreement has a page to link; a questionnaire link opens a blank
  // form, which is not what somebody asking for their copy wants.
  assert.match(sql, /www\.xertfitness\.com\.au\/terms/);
});

test('the letter is written once, and a backfill sends the same one', async () => {
  const sql = await read('../supabase/migrations/20260918020000_resend_signed_copy.sql');

  // Three people signed while questionnaires were being skipped. Sending their
  // copy late meant running the trigger's own code, not a hand-copied version
  // that could word things differently or link somewhere else — so the body
  // moved into a function both the trigger and the backfill call.
  assert.match(sql, /create or replace function public\.send_signed_document_copy\(p_response_id uuid\)/);
  assert.match(sql, /create or replace function public\.email_form_response_copy\(\)[\s\S]*perform public\.send_signed_document_copy\(new\.id\)/);
  assert.match(sql, /create trigger email_on_form_response/);

  // Running it twice must not send twice: that is what makes a backfill safe
  // to repeat, and what stopped the one person who already had his copy from
  // getting a second.
  assert.match(sql, /if exists \(\s*select 1 from public\.email_log\s*where email_type = 'signed_documents' and related_id = r\.id::text\s*\) then return false; end if;/);

  // Same contact fallback as the trigger fix, and still no send without a
  // readable address.
  assert.match(sql, /r\.answers ->> 'e4c4e161-43e3-5462-a865-f27c411ac809'/);
  assert.match(sql, /if v_email !~ '\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$' then return false; end if;/);
  // An archived response is not a document anybody should be sent.
  assert.match(sql, /if not found or r\.archived_at is not null then return false; end if;/);
  assert.match(sql, /revoke all on function public\.send_signed_document_copy\(uuid\) from public, anon, authenticated/);
});
