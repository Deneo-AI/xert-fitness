-- The copy email said "Signed" where the signature was. Somebody keeping a
-- record of what they put their name to gets a row saying, in effect, that
-- they signed it — which they already knew.
--
-- The signature itself is a PNG held in the answer as a data URI. Putting that
-- straight into an <img> does not work: Gmail and Outlook drop data: image
-- sources, so most people would see a broken box. It travels as a real
-- attachment instead, which every mail client can open and keep.

-- An optional attachment list, passed through to the provider untouched.
-- Defaulted, so every existing caller keeps working unchanged.
create or replace function public.queue_email(
  p_type text,
  p_to text,
  p_subject text,
  p_html text,
  p_text text default null,
  p_related_table text default null,
  p_related_id text default null,
  p_attachments jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_settings public.email_settings%rowtype;
  v_key text;
  v_log_id uuid;
  v_request_id bigint;
  v_to text := lower(trim(coalesce(p_to, '')));
  v_subject text := left(trim(coalesce(p_subject, '')), 200);
  v_from text;
  v_body jsonb;
begin
  if v_to !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or v_subject = '' then
    return null;
  end if;
  select * into v_settings from public.email_settings where id = 1;
  insert into public.email_log (email_type, recipient, subject, related_table, related_id)
  values (p_type, v_to, v_subject, p_related_table, p_related_id)
  returning id into v_log_id;

  if v_settings.id is null or not v_settings.enabled then
    update public.email_log set status = 'skipped', error = 'EMAIL_DISABLED', updated_at = now() where id = v_log_id;
    return v_log_id;
  end if;
  if p_type <> 'test' and coalesce((v_settings.types ->> p_type)::boolean, true) = false then
    update public.email_log set status = 'skipped', error = 'EMAIL_TYPE_DISABLED', updated_at = now() where id = v_log_id;
    return v_log_id;
  end if;
  v_key := public.email_provider_key();
  if v_key is null or v_key = '' then
    update public.email_log set status = 'skipped', error = 'RESEND_API_KEY_MISSING', updated_at = now() where id = v_log_id;
    return v_log_id;
  end if;

  v_from := v_settings.from_name || ' <' || v_settings.from_address || '>';
  v_body := jsonb_build_object(
    'from', v_from,
    'to', jsonb_build_array(v_to),
    'subject', v_subject,
    'html', public.email_ascii_html(p_html),
    'text', public.email_ascii_text(coalesce(p_text, regexp_replace(p_html, '<[^>]+>', ' ', 'g')))
  );
  if v_settings.reply_to is not null then
    v_body := v_body || jsonb_build_object('reply_to', v_settings.reply_to);
  end if;
  if p_attachments is not null and jsonb_typeof(p_attachments) = 'array'
     and jsonb_array_length(p_attachments) > 0 then
    v_body := v_body || jsonb_build_object('attachments', p_attachments);
  end if;

  begin
    v_request_id := net.http_post(
      url := 'https://api.resend.com/emails',
      body := v_body,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
      timeout_milliseconds := 8000
    );
    update public.email_log set request_id = v_request_id, payload = v_body, updated_at = now() where id = v_log_id;
  exception when others then
    update public.email_log set status = 'failed', error = left('HANDOFF_FAILED: ' || sqlerrm, 500), updated_at = now() where id = v_log_id;
  end;
  return v_log_id;
end;
$$;

revoke all on function public.queue_email(text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
drop function if exists public.queue_email(text, text, text, text, text, text, text);

-- Every signature on one response, as provider attachments. A signature that
-- is not a PNG data URI is left out rather than sent as something unopenable.
create or replace function public.form_response_signatures(p_response_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'filename', file_name,
    'content', payload,
    'content_type', 'image/png'
  )), '[]'::jsonb)
  from (
    select
      regexp_replace(
        lower(coalesce(nullif(btrim(q ->> 'question'), ''), 'signature')),
        '[^a-z0-9]+', '-', 'g') || '.png' as file_name,
      regexp_replace(r.answers ->> (q ->> 'id'), '^data:image/png;base64,', '') as payload
    from public.xert_form_responses r
    cross join lateral jsonb_array_elements(
      coalesce(r.form_snapshot -> 'questions', (select f.questions from public.xert_forms f where f.id = r.form_id))
    ) as q
    where r.id = p_response_id
      and (q ->> 'type') = 'signature'
      and (r.answers ->> (q ->> 'id')) like 'data:image/png;base64,%'
  ) signatures;
$$;

revoke all on function public.form_response_signatures(uuid) from public, anon, authenticated;

-- "Signed" stays in the table as the readable summary; the image rides along.
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
  v_attachments jsonb;
begin
  select * into r from public.xert_form_responses where id = p_response_id;
  if not found or r.archived_at is not null then return false; end if;

  select * into v_form from public.xert_forms where id = r.form_id;
  if not found or not v_form.email_copy_to_respondent then return false; end if;

  if exists (
    select 1 from public.email_log
    where email_type = 'signed_documents' and related_id = r.id::text
  ) then return false; end if;

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
  v_attachments := public.form_response_signatures(r.id);

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
    || case when jsonb_array_length(v_attachments) = 0 then ''
       else '<p style="color:#5a6b7a;font-size:13px">Your signature is attached to this email as an image.</p>' end
    || '<p style="color:#5a6b7a;font-size:13px">If anything above is wrong, reply to this email and the XERT team will correct it.</p>';

  begin
    perform public.queue_email(
      'signed_documents', v_email,
      'Your copy: ' || v_title,
      public.email_layout('Your signed copy', v_body, v_cta, v_link),
      null, 'xert_form_responses', r.id::text,
      case when jsonb_array_length(v_attachments) = 0 then null else v_attachments end
    );
  exception when others then
    raise notice 'signed document copy skipped: %', sqlerrm;
    return false;
  end;
  return true;
end;
$$;

revoke all on function public.send_signed_document_copy(uuid) from public, anon, authenticated;

do $$
begin
  if pg_catalog.has_function_privilege('anon', 'public.form_response_signatures(uuid)', 'execute') then
    raise exception 'Signatures must not be readable by anon.';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'queue_email'
      and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'p_type text, p_to text, p_subject text, p_html text, p_text text, p_related_table text, p_related_id text'
  ) then
    raise exception 'The previous queue_email signature is still installed.';
  end if;
end;
$$;
