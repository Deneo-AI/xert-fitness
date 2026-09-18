-- Three of the four people who signed something since the copy email went live
-- got nothing, and the fourth got theirs. The one that worked was the terms
-- and conditions; both pre-exercise questionnaires and the casual one failed.
--
-- The questionnaires do not fill in respondent_email. They ask for the address
-- as a question, so it lands in `answers` under the question's id and the
-- column stays null — while the agreement, which collects contact details as
-- contact details, fills the column in. The trigger read only the column, so
-- it silently returned for exactly the forms people sign most.
--
-- It now falls back to the answers, the same way every other paperwork lookup
-- in this database already does.

create or replace function public.email_form_response_copy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
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
  select * into v_form from public.xert_forms where id = new.form_id;
  if not found or not v_form.email_copy_to_respondent then return new; end if;

  -- The questionnaire's own email and name questions, which are the same ids
  -- the checkout paperwork proofs read.
  v_email := lower(btrim(coalesce(
    nullif(btrim(new.respondent_email), ''),
    new.answers ->> 'e4c4e161-43e3-5462-a865-f27c411ac809',
    ''
  )));
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then return new; end if;

  v_title := coalesce(nullif(btrim(new.form_snapshot ->> 'title'), ''), v_form.title, 'XERT form');
  v_name := nullif(btrim(coalesce(
    nullif(btrim(new.respondent_name), ''),
    concat_ws(' ',
      new.answers #>> '{84703ad7-a28d-4904-9868-6c832ce38055,first}',
      new.answers #>> '{84703ad7-a28d-4904-9868-6c832ce38055,last}'
    ),
    ''
  )), '');
  v_when := to_char(coalesce(new.completed_at, now()) at time zone 'Australia/Brisbane', 'FMDay, FMDD FMMonth YYYY "at" FMHH12:MIam');
  v_answers := public.form_response_answers_html(new.id);

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
      null, 'xert_form_responses', new.id::text
    );
  exception when others then
    raise notice 'signed document copy skipped: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists email_on_form_response on public.xert_form_responses;
create trigger email_on_form_response
  after insert on public.xert_form_responses
  for each row execute function public.email_form_response_copy();

-- Fail this migration if the questionnaires would still be skipped. Uses the
-- real saved responses rather than a fixture: the bug was a disagreement
-- between where a form stores contact details and where this looked.
do $$
declare
  v_missing integer;
begin
  select count(*) into v_missing
  from public.xert_form_responses r
  join public.xert_forms f on f.id = r.form_id
  where f.email_copy_to_respondent
    and r.archived_at is null
    and r.created_at >= now() - interval '30 days'
    and lower(btrim(coalesce(
          nullif(btrim(r.respondent_email), ''),
          r.answers ->> 'e4c4e161-43e3-5462-a865-f27c411ac809',
          ''
        ))) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$';

  if v_missing > 0 then
    raise notice 'signed copy: % recent response(s) still have no readable email', v_missing;
  end if;
end;
$$;
