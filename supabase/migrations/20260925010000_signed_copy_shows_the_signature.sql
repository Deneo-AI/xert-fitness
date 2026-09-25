-- The copy email attached the signature as a PNG and said so in a sentence.
-- Someone keeping a record of what they put their name to had to open a file
-- to see it, and the email itself still read as a list of answers rather than
-- the document they signed.
--
-- The signature now shows in the body. It rides as an attachment with a
-- content id, which the HTML references as <img src="cid:...">. That is the
-- only inline form Gmail and Outlook honour -- a data: URI is dropped by both,
-- which is why it was an attachment to begin with. It stays attached as well,
-- so the file is still there to save.
--
-- The block sits at the end, under a ruled line, the way the paper document
-- signs off.

-- Every signature on one response, with the pieces needed to both attach it
-- and show it: the label it was signed under, a content id to reference, the
-- filename, and the base64 payload. Snapshot order, so two signatures appear
-- in the order they were signed rather than whatever order the rows come back.
create or replace function public.form_response_signature_parts(p_response_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'question', question,
    'cid', 'signature-' || position::text,
    'filename', slug || '.png',
    'content', payload
  ) order by position), '[]'::jsonb)
  from (
    select
      coalesce(nullif(btrim(q ->> 'question'), ''), 'Signature') as question,
      regexp_replace(
        lower(coalesce(nullif(btrim(q ->> 'question'), ''), 'signature')),
        '[^a-z0-9]+', '-', 'g') as slug,
      regexp_replace(r.answers ->> (q ->> 'id'), '^data:image/png;base64,', '') as payload,
      position
    from public.xert_form_responses r
    cross join lateral jsonb_array_elements(
      coalesce(r.form_snapshot -> 'questions', (select f.questions from public.xert_forms f where f.id = r.form_id))
    ) with ordinality as snapshot(q, position)
    where r.id = p_response_id
      and (q ->> 'type') = 'signature'
      and (r.answers ->> (q ->> 'id')) like 'data:image/png;base64,%'
  ) signatures;
$$;

revoke all on function public.form_response_signature_parts(uuid) from public, anon, authenticated;

-- Attachments, from the same parts. Carrying a content id is what lets the
-- same bytes serve as both the inline image and the saveable file.
create or replace function public.form_response_signatures(p_response_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'filename', part ->> 'filename',
    'content', part ->> 'content',
    'content_type', 'image/png',
    'content_id', part ->> 'cid'
  )), '[]'::jsonb)
  from jsonb_array_elements(public.form_response_signature_parts(p_response_id)) as part;
$$;

revoke all on function public.form_response_signatures(uuid) from public, anon, authenticated;

-- The signature block as the document signs off: a label, a ruled line, and
-- the signature sitting on it. Height is fixed and width is left alone so a
-- wide signature is not squashed out of shape.
create or replace function public.form_response_signature_html(p_response_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(string_agg(
    '<div style="margin:20px 0 0">'
    || '<div style="color:#5a6b7a;font-size:13px;margin:0 0 2px">'
    || public.email_escape(part ->> 'question')
    || '</div>'
    || '<img src="cid:' || (part ->> 'cid') || '" alt="Signature"'
    || ' style="display:block;height:64px;width:auto;max-width:280px;border:0;'
    || 'border-bottom:1px solid #101820;padding:0 0 2px">'
    || '</div>', '' order by ordinality), '')
  from jsonb_array_elements(public.form_response_signature_parts(p_response_id))
       with ordinality as parts(part, ordinality);
$$;

revoke all on function public.form_response_signature_html(uuid) from public, anon, authenticated;

-- Same email, but the signature is in it rather than described by it.
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
  v_signatures text;
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
  v_signatures := public.form_response_signature_html(r.id);
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
    || case when v_signatures = '' then ''
       else '<div style="border-top:1px solid #dbe3ea;margin:20px 0 0;padding:4px 0 0">'
            || '<div style="color:#5a6b7a;font-size:13px">Signed</div>'
            || v_signatures
            || '<p style="color:#5a6b7a;font-size:12px;margin:12px 0 0">Your signature is also attached to this'
            || ' email as an image, in case it does not display above.</p>'
            || '</div>' end
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
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.form_response_signature_parts(uuid)',
    'public.form_response_signature_html(uuid)',
    'public.form_response_signatures(uuid)'
  ]
  loop
    -- A signature is the most personal thing these forms hold. None of these
    -- may be reachable without the service role.
    if pg_catalog.has_function_privilege('anon', v_fn, 'execute')
       or pg_catalog.has_function_privilege('authenticated', v_fn, 'execute') then
      raise exception 'Signatures must not be readable by anon or authenticated: %', v_fn;
    end if;
  end loop;
end;
$$;
