-- A repeat visitor buying another Three Day Pass was made to sign the
-- pre-exercise questionnaire again, because the only proof the checkout would
-- accept was a response id left in that browser by a signing done moments
-- earlier. Ticking "I have already completed the pre-exercise questionnaire"
-- proved nothing, so the button kept sending them back to the form.
--
-- This is the same email-only lookup the three month membership already uses
-- for its "already signed" tick: the visitor declares it, the server checks
-- the records itself, and the owner alert says plainly what was found. A
-- questionnaire signed for a casual visit and one signed as a member both
-- count — they are the same screening, asked on two doors.

create or replace function public.xert_visitor_questionnaire_signed(p_email text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    public.xert_paperwork_normalized_email(p_email)
      ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and exists (
      select 1
      from public.xert_form_responses r
      where r.form_id in (
          'e90f30f7-b0d2-56e7-8e1d-8b290721e234'::uuid,  -- casual pre-exercise questionnaire
          '000cc2da-1c51-59bf-a33e-c76bee4d7188'::uuid   -- member pre-exercise questionnaire
        )
        and r.archived_at is null
        and r.completed_at <= now()
        and public.xert_paperwork_normalized_email(coalesce(
          nullif(btrim(r.respondent_email), ''),
          r.answers ->> 'e4c4e161-43e3-5462-a865-f27c411ac809'
        )) = public.xert_paperwork_normalized_email(p_email)
        and public.xert_paperwork_normalized_email(coalesce(
          nullif(btrim(r.respondent_email), ''),
          r.answers ->> 'e4c4e161-43e3-5462-a865-f27c411ac809'
        )) <> ''
        -- The saved record has to carry a real signature, not just exist.
        and public.xert_paperwork_snapshot_has_question(
          r.form_snapshot,
          '576cbb02-2819-488f-a7d8-1719d8d53840',
          'signature'
        )
        and public.xert_valid_form_signature(
          r.answers ->> '576cbb02-2819-488f-a7d8-1719d8d53840'
        )
    );
$$;

revoke all on function public.xert_visitor_questionnaire_signed(text) from public, anon, authenticated;
grant execute on function public.xert_visitor_questionnaire_signed(text) to service_role;

-- A Three Day Pass bought on a declared "already signed" now says whether the
-- questionnaire was actually found, the same way the membership alert does.
create or replace function public.email_on_casual_visit_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text := case new.pass_kind
    when 'three_day_pass' then 'Three Day Pass'
    when 'three_month_membership' then 'Three month membership'
    else 'Casual visit' end;
  v_purchase text := case new.pass_kind
    when 'three_day_pass' then 'a Three Day Pass'
    when 'three_month_membership' then 'a three month membership'
    else 'a casual visit' end;
  v_note text := case
    when new.pass_kind = 'three_day_pass' and new.paperwork_verified is false
      then '<p>Three Day Pass. <strong>They said they had already completed the pre-exercise questionnaire, but no signed questionnaire was found under this email.</strong> Check with them before their first session. This payment does not create member credits.</p>'
    when new.pass_kind = 'three_day_pass' and new.paperwork_verified is true
      then '<p>Three Day Pass. Their signed pre-exercise questionnaire is on file. Confirm the receipt and arrange their visits; this payment does not create member credits.</p>'
    when new.pass_kind = 'three_day_pass'
      then '<p>Three Day Pass. Confirm the receipt and arrange their visits; this payment does not create member credits.</p>'
    when new.pass_kind = 'three_month_membership' and new.paperwork_verified is false
      then '<p><strong>They said they had already signed, but no matching questionnaire and agreement were found under this email.</strong> Check with them before their first session.</p>'
    when new.pass_kind = 'three_month_membership' and new.paperwork_verified is true
      then '<p>Their signed questionnaire and agreement are both on file. Set the membership up in FitBox.</p>'
    when new.pass_kind = 'three_month_membership'
      then '<p>They signed the questionnaire and agreement as part of this purchase. Set the membership up in FitBox.</p>'
    else '<p>They completed the payment on their own phone. Check them in as usual.</p>' end;
begin
  begin
    perform public.email_owner_alert(
      'owner_alerts', v_label || ' paid: ' || new.full_name,
      '<p>' || public.email_escape(new.full_name) || ' (' || public.email_escape(new.email)
        || coalesce(', ' || public.email_escape(nullif(new.phone, '')), '')
        || ') paid ' || to_char(new.amount_cents / 100.0, 'FM$999990.00') || ' for ' || v_purchase || '.</p>'
        || v_note,
      'casual_visit_payments', new.id::text
    );
  exception when others then
    raise notice 'visitor payment owner alert skipped: %', sqlerrm;
  end;
  return new;
end;
$$;

-- Fail this migration itself if the lookup would ever wave somebody through on
-- empty input, or if it is reachable by anyone but the checkout server.
do $$
declare
  v_signature constant text := 'public.xert_visitor_questionnaire_signed(text)';
begin
  if public.xert_visitor_questionnaire_signed(null) is distinct from false
    or public.xert_visitor_questionnaire_signed('') is distinct from false
    or public.xert_visitor_questionnaire_signed('not-an-email') is distinct from false then
    raise exception 'Visitor questionnaire lookup must return false for empty input.';
  end if;

  if not pg_catalog.has_function_privilege('service_role', v_signature, 'execute')
    or pg_catalog.has_function_privilege('anon', v_signature, 'execute')
    or pg_catalog.has_function_privilege('authenticated', v_signature, 'execute') then
    raise exception 'Visitor questionnaire lookup role grants do not match the service-only contract.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where p.oid = v_signature::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'Visitor questionnaire lookup must not be executable by PUBLIC.';
  end if;
end;
$$;
