-- Three people signed a questionnaire while the copy email was skipping
-- questionnaires, so they never got theirs. Sending it now means running the
-- same code the trigger runs — not a hand-copied version of it that could
-- word things differently or link somewhere else.
--
-- So the body moves into a function the trigger calls, and a backfill can call
-- the same function for a response that missed out. It refuses to send twice:
-- a response that already has a copy in the log is left alone, which is what
-- makes it safe to run again.

create or replace function public.send_signed_document_copy(p_response_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.xert_form_responses%rowtype;
  v_form public.xert_forms%rowtype;
  v_title text;
  v_email text;
  v_name text;
  v_when text;
  v_answers text;
  v_body text;
  v_link text;
  v_cta text;
begin
  select * into r from public.xert_form_responses where id = p_response_id;
  if not found or r.archived_at is not null then return false; end if;

  select * into v_form from public.xert_forms where id = r.form_id;
  if not found or not v_form.email_copy_to_respondent then return false; end if;

  -- Never a second copy of the same document to the same person.
  if exists (
    select 1 from public.email_log
    where email_type = 'signed_documents' and related_id = r.id::text
  ) then return false; end if;

  -- The questionnaires ask for an email as a question, so it lands in the
  -- answers and respondent_email stays null; the agreement fills the column.
  v_email := lower(btrim(coalesce(
    nullif(btrim(r.respondent_email), ''),
    r.answers ->> 'e4c4e161-43e3-5462-a865-f27c411ac809',
    ''
  )));
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then return false; end if;

  v_title := coalesce(nullif(btrim(r.form_snapshot ->> 'title'), ''), v_form.title, 'XERT form');
  v_name := nullif(btrim(coalesce(
    nullif(btrim(r.respondent_name), ''),
    concat_ws(' ',
      r.answers #>> '{84703ad7-a28d-4904-9868-6c832ce38055,first}',
      r.answers #>> '{84703ad7-a28d-4904-9868-6c832ce38055,last}'
    ),
    ''
  )), '');
  v_when := to_char(coalesce(r.completed_at, r.created_at, now()) at time zone 'Australia/Brisbane',
                    'FMDay, FMDD FMMonth YYYY "at" FMHH12:MIam');
  v_answers := public.form_response_answers_html(r.id);

  -- Only the agreement has a page somebody can read. Pointing a questionnaire
  -- at its own link would open a blank one to fill in again rather than show
  -- what they signed, so there the answers above are the record.
  if v_form.slug = 'terms-and-conditions' then
    v_cta := 'Read the full terms';
    v_link := 'https://www.xertfitness.com.au/terms';
  else
    v_cta := null;
    v_link := null;
  end if;

  v_body :=
    '<p>' || case when v_name is null then 'Hello,' else 'Hello ' || public.email_escape(v_name) || ',' end || '</p>'
    || '<p>Here is your copy of the <strong>' || public.email_escape(v_title)
    || '</strong> you completed on ' || public.email_escape(v_when) || '. Keep this email for your records.</p>'
    || case when v_answers = '' then ''
       else '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0">'
            || v_answers || '</table>' end
    || '<p style="color:#5a6b7a;font-size:13px">If anything above is wrong, reply to this email and the XERT team will correct it.</p>';

  begin
    perform public.queue_email(
      'signed_documents', v_email,
      'Your copy: ' || v_title,
      public.email_layout('Your signed copy', v_body, v_cta, v_link),
      null, 'xert_form_responses', r.id::text
    );
  exception when others then
    raise notice 'signed document copy skipped: %', sqlerrm;
    return false;
  end;
  return true;
end;
$$;

revoke all on function public.send_signed_document_copy(uuid) from public, anon, authenticated;

-- The trigger is now only "who just signed", and the letter is written once.
create or replace function public.email_form_response_copy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.send_signed_document_copy(new.id);
  return new;
end;
$$;

drop trigger if exists email_on_form_response on public.xert_form_responses;
create trigger email_on_form_response
  after insert on public.xert_form_responses
  for each row execute function public.email_form_response_copy();
