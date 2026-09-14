-- People sign the membership agreement and the health questionnaire on their
-- own phone and then have nothing to show for it. This emails them a copy of
-- what they signed, the moment they sign it.
--
-- The copy is built from the response's own snapshot of the form, not from the
-- form as it stands today, so somebody who signed in September still gets back
-- the wording they actually agreed to rather than a later revision.

alter table public.xert_forms
  add column if not exists email_copy_to_respondent boolean not null default false;

comment on column public.xert_forms.email_copy_to_respondent is
  'Email the person a copy of their answers as soon as they submit. For documents somebody signs and should keep.';

-- One answer, as a line somebody can read. A signature is a long data URL that
-- would be meaningless and enormous in an email, so it is reported as signed
-- rather than printed; the image itself stays in the record.
create or replace function public.form_answer_line(p_question jsonb, p_answer jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_answer is null or p_answer = 'null'::jsonb then ''
    when p_question ->> 'type' = 'signature' then
      case when length(coalesce(p_answer #>> '{}', '')) > 0 then 'Signed' else '' end
    when jsonb_typeof(p_answer) = 'array' then
      (select string_agg(value #>> '{}', ', ') from jsonb_array_elements(p_answer) where value #>> '{}' <> '')
    when jsonb_typeof(p_answer) = 'object' then
      (select string_agg(value #>> '{}', ', ') from jsonb_each(p_answer) where value #>> '{}' <> '')
    else p_answer #>> '{}'
  end;
$$;

-- The answers somebody gave, as HTML table rows. Prose blocks are left out: an
-- email is a receipt, not a reprint of a forty page agreement, and the full
-- document stays one link away.
create or replace function public.form_response_answers_html(p_response_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(string_agg(row_html, ''), '')
  from (
    select
      '<tr><td style="padding:6px 12px 6px 0;color:#5a6b7a;font-size:13px;vertical-align:top;width:45%">'
      || public.email_escape(coalesce(nullif(btrim(q ->> 'question'), ''), 'Answer'))
      || '</td><td style="padding:6px 0;color:#101820;font-size:13px;vertical-align:top"><strong>'
      || public.email_escape(line)
      || '</strong></td></tr>' as row_html
    from (
      select q, public.form_answer_line(q, r.answers -> (q ->> 'id')) as line
      from public.xert_form_responses r
      cross join lateral jsonb_array_elements(
        coalesce(r.form_snapshot -> 'questions', (select f.questions from public.xert_forms f where f.id = r.form_id))
      ) as q
      where r.id = p_response_id
        and (q ->> 'type') not in ('section_break', 'statement')
        and coalesce((q ->> 'hidden')::boolean, false) = false
    ) answered
    where line is not null and line <> ''
  ) rows;
$$;

-- Sends the copy. Anything that goes wrong here must not undo somebody's
-- signature, so a failure is logged and the submission still stands.
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

  v_email := lower(btrim(coalesce(new.respondent_email, '')));
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then return new; end if;

  v_title := coalesce(nullif(btrim(new.form_snapshot ->> 'title'), ''), v_form.title, 'XERT form');
  v_name := nullif(btrim(coalesce(new.respondent_name, '')), '');
  v_when := to_char(coalesce(new.completed_at, now()) at time zone 'Australia/Brisbane', 'FMDay, FMDD FMMonth YYYY "at" FMHH12:MIam');
  v_answers := public.form_response_answers_html(new.id);

  -- Only the agreement has a page somebody can read. Pointing a questionnaire
  -- at its own link would open a blank one to fill in again rather than show
  -- what they signed, so there the answers above are the record.
  if v_form.slug = 'terms-and-conditions' then
    v_cta := 'Read the full terms';
    v_link := 'https://xertfitness.com.au/terms';
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

-- A new email type defaults to on, but name it so the Command Centre can list
-- and switch it like the others.
update public.email_settings
   set types = coalesce(types, '{}'::jsonb) || jsonb_build_object('signed_documents', true)
 where id = 1;

-- The documents people sign and should keep a copy of.
update public.xert_forms
   set email_copy_to_respondent = true
 where slug in ('terms-and-conditions', 'peq', 'peq-casual');

insert into public.xert_schema_capabilities (capability)
values ('signed_document_copies') on conflict (capability) do nothing;
