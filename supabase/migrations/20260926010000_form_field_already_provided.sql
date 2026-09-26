-- An "Already provided" tick for text-type fields, so a respondent does not
-- have to type an email or phone number the club already has, or that they
-- gave a few questions earlier.
--
-- Ticking it stores the plain answer 'Already provided'. That reads correctly
-- in the admin record, the CSV, the emailed copy and the PDF without any of
-- them knowing the feature exists. The only place it needs special handling
-- is the email format check, and the exemption is narrow: it applies only to
-- a field whose published definition has allow_already_provided = true, and
-- only to that exact answer. Every other field, and every other answer, is
-- validated exactly as before.

create or replace function public.xert_form_answer_is_already_provided(p_question jsonb, p_answer jsonb)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select coalesce(
    p_question -> 'allow_already_provided' = 'true'::jsonb
    and p_question ->> 'type' in ('short_text', 'long_text', 'email', 'phone', 'url', 'date', 'time', 'datetime')
    and p_answer = to_jsonb('Already provided'::text),
    false);
$$;

revoke all on function public.xert_form_answer_is_already_provided(jsonb, jsonb) from public, anon, authenticated;

-- The submit function below is the live definition with two changes: the
-- setting must be a boolean if present, and the email format check steps
-- aside for the tick on a field that offers it.

CREATE OR REPLACE FUNCTION public.submit_xert_form_response_v2(p_slug text, p_answers jsonb, p_form_updated_at timestamp with time zone, p_respondent_name text DEFAULT NULL::text, p_respondent_email text DEFAULT NULL::text, p_respondent_phone text DEFAULT NULL::text, p_time_taken_seconds integer DEFAULT 0, p_source_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_form public.xert_forms%rowtype;
  v_id uuid;
  v_email text := nullif(lower(btrim(coalesce(p_respondent_email, ''))), '');
  v_question jsonb;
  v_question_id text;
  v_question_type text;
  v_question_position integer;
  v_question_count integer;
  v_known_ids text[] := array[]::text[];
  v_skipped_ids text[] := array[]::text[];
  v_answer_key text;
  v_answer jsonb;
  v_answer_text text;
  v_answer_number numeric;
  v_skip_rule jsonb;
  v_skip_target_text text;
  v_skip_target_number numeric;
  v_skip_target integer;
  v_skip_step integer;
  v_options jsonb;
  v_allow_other boolean;
  v_scale_min_text text;
  v_scale_max_text text;
  v_scale_min integer;
  v_scale_max integer;
begin
  select * into v_form
  from public.xert_forms
  where slug = lower(btrim(p_slug)) and is_active = true and archived_at is null
  for update;

  if not found then
    raise exception 'This form is not available.' using errcode = 'P0002';
  end if;
  if p_form_updated_at is null or v_form.updated_at is distinct from p_form_updated_at then
    raise exception 'This form changed while you were completing it. Refresh and review the latest wording before submitting.'
      using errcode = '40001';
  end if;
  if jsonb_typeof(p_answers) is distinct from 'object'
    or jsonb_array_length(jsonb_path_query_array(p_answers, '$.*')) > 100
    or octet_length(p_answers::text) > 524288 then
    raise exception 'The submitted answers are invalid.' using errcode = '22023';
  end if;
  if v_form.collect_name_required and nullif(btrim(coalesce(p_respondent_name, '')), '') is null then
    raise exception 'Name is required.' using errcode = '22023';
  end if;
  if v_form.collect_email_required and v_email is null then
    raise exception 'Email is required.' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  if v_form.collect_phone_required and nullif(btrim(coalesce(p_respondent_phone, '')), '') is null then
    raise exception 'Phone is required.' using errcode = '22023';
  end if;

  v_question_count := jsonb_array_length(v_form.questions);

  -- Fail closed on a malformed published definition. Besides protecting the
  -- validator, unique stable IDs are essential to the immutable response
  -- snapshot: duplicate or missing IDs could relabel a historical answer.
  for v_question, v_question_position in
    select item.value, item.ordinality::integer
    from jsonb_array_elements(v_form.questions) with ordinality as item(value, ordinality)
  loop
    if jsonb_typeof(v_question) is distinct from 'object' then
      raise exception 'This form is not configured correctly.' using errcode = '22023';
    end if;

    v_question_id := btrim(coalesce(v_question ->> 'id', ''));
    v_question_type := coalesce(v_question ->> 'type', '');
    if char_length(v_question_id) not between 1 and 128
      or v_question_id = any(v_known_ids) then
      raise exception 'This form is not configured correctly.' using errcode = '22023';
    end if;
    v_known_ids := array_append(v_known_ids, v_question_id);

    if v_question_type not in (
      'short_text', 'long_text', 'number', 'email', 'phone', 'url',
      'single_choice', 'multiple_choice', 'dropdown', 'yes_no',
      'star_rating', 'linear_scale', 'nps', 'date', 'time', 'datetime',
      'file_upload', 'signature', 'address', 'name_fields',
      'section_break', 'statement'
    ) then
      raise exception 'This form is not configured correctly.' using errcode = '22023';
    end if;
    if (v_question ? 'hidden' and jsonb_typeof(v_question -> 'hidden') is distinct from 'boolean')
      or (v_question ? 'required' and jsonb_typeof(v_question -> 'required') is distinct from 'boolean')
      or (v_question ? 'allow_other' and jsonb_typeof(v_question -> 'allow_other') is distinct from 'boolean')
      or (v_question ? 'allow_already_provided' and jsonb_typeof(v_question -> 'allow_already_provided') is distinct from 'boolean') then
      raise exception 'This form is not configured correctly.' using errcode = '22023';
    end if;

    if v_question_type in ('single_choice', 'multiple_choice', 'dropdown') then
      v_options := v_question -> 'options';
      if jsonb_typeof(v_options) is distinct from 'array' then
        raise exception 'This form is not configured correctly.' using errcode = '22023';
      end if;
      if jsonb_array_length(v_options) > 100 or exists (
          select 1 from jsonb_array_elements(v_options) as configured(value)
          where jsonb_typeof(configured.value) is distinct from 'string'
            or btrim(configured.value #>> '{}') = ''
        )
        or exists (
          select 1
          from jsonb_array_elements(v_options) as configured(value)
          group by configured.value
          having count(*) > 1
        ) then
        raise exception 'This form is not configured correctly.' using errcode = '22023';
      end if;
    end if;

    if v_question_type in ('single_choice', 'multiple_choice', 'dropdown', 'yes_no')
      and v_question ? 'skip_rules' then
      if jsonb_typeof(v_question -> 'skip_rules') is distinct from 'array' then
        raise exception 'This form is not configured correctly.' using errcode = '22023';
      end if;
      if jsonb_array_length(v_question -> 'skip_rules') > 100 then
        raise exception 'This form is not configured correctly.' using errcode = '22023';
      end if;
    end if;

    if v_question_type = 'linear_scale' then
      v_scale_min_text := btrim(coalesce(v_question ->> 'scale_min', '1'));
      v_scale_max_text := btrim(coalesce(v_question ->> 'scale_max', '10'));
      if v_scale_min_text !~ '^-?[0-9]{1,9}$'
        or v_scale_max_text !~ '^-?[0-9]{1,9}$' then
        raise exception 'This form is not configured correctly.' using errcode = '22023';
      end if;
      v_scale_min := v_scale_min_text::integer;
      v_scale_max := v_scale_max_text::integer;
      if v_scale_min > v_scale_max or v_scale_max - v_scale_min > 100 then
        raise exception 'This form is not configured correctly.' using errcode = '22023';
      end if;
    end if;
  end loop;

  -- Match src/lib/formBranching.js: skip_to is a one-based destination, only
  -- forward jumps are honoured, the destination remains visible, and a jump
  -- past the final item is capped at the end of the complete builder sequence
  -- (including statements and section breaks).
  for v_question, v_question_position in
    select item.value, item.ordinality::integer
    from jsonb_array_elements(v_form.questions) with ordinality as item(value, ordinality)
  loop
    v_question_type := v_question ->> 'type';
    if (v_question ->> 'id') = any(v_skipped_ids) then
      continue;
    end if;
    if v_question_type not in ('single_choice', 'multiple_choice', 'dropdown', 'yes_no') then
      continue;
    end if;

    v_answer := p_answers -> (v_question ->> 'id');
    v_skip_rule := null;
    select rule.value into v_skip_rule
    from jsonb_array_elements(
      case when jsonb_typeof(v_question -> 'skip_rules') = 'array'
        then v_question -> 'skip_rules'
        else '[]'::jsonb
      end
    ) with ordinality as rule(value, ordinality)
    where jsonb_typeof(rule.value) = 'object'
      and jsonb_typeof(rule.value -> 'option') = 'string'
      and case
        when v_question_type = 'multiple_choice' then
          case when jsonb_typeof(v_answer) = 'array' then
            jsonb_array_length(v_answer) = 1
              and jsonb_typeof(v_answer -> 0) = 'string'
              and v_answer ->> 0 = rule.value ->> 'option'
          else false end
        else
          jsonb_typeof(v_answer) = 'string'
            and v_answer #>> '{}' = rule.value ->> 'option'
      end
    order by rule.ordinality
    limit 1;

    v_skip_target_text := btrim(coalesce(v_skip_rule ->> 'skip_to', ''));
    if v_skip_rule is not null and v_skip_target_text ~ '^[0-9]+$'
      and char_length(v_skip_target_text) <= 32 then
      v_skip_target_number := v_skip_target_text::numeric;
      if v_skip_target_number > v_question_position + 1 then
        v_skip_target := least(v_skip_target_number, v_question_count + 1)::integer;
        -- Re-check after capping at the end. For a rule on the final item,
        -- an oversized target caps back to its immediate successor and there
        -- is no intervening range to traverse.
        if v_skip_target >= v_question_position + 2 then
          for v_skip_step in (v_question_position + 1)..(v_skip_target - 1)
          loop
            v_question_id := v_form.questions -> (v_skip_step - 1) ->> 'id';
            if not (v_question_id = any(v_skipped_ids)) then
              v_skipped_ids := array_append(v_skipped_ids, v_question_id);
            end if;
          end loop;
        end if;
      end if;
    end if;
  end loop;

  -- Every supplied key must identify a visible input the respondent actually
  -- saw. Null is accepted as an omitted optional answer; any non-null value is
  -- then validated against the exact JSON representation produced by the app.
  for v_answer_key, v_answer in select key, value from jsonb_each(p_answers)
  loop
    v_question := null;
    select item.value into v_question
    from jsonb_array_elements(v_form.questions) as item(value)
    where item.value ->> 'id' = v_answer_key
    limit 1;

    if v_question is null then
      raise exception 'The submission contains an unknown answer.' using errcode = '22023';
    end if;
    v_question_type := v_question ->> 'type';
    if coalesce((v_question ->> 'hidden')::boolean, false)
      or v_question_type in ('section_break', 'statement')
      or v_answer_key = any(v_skipped_ids) then
      raise exception 'The submission contains an answer for a field that was not presented.' using errcode = '22023';
    end if;
    if jsonb_typeof(v_answer) = 'null' then continue; end if;

    if v_question_type in ('short_text', 'long_text', 'email', 'phone', 'url', 'date', 'time', 'datetime', 'signature') then
      if jsonb_typeof(v_answer) is distinct from 'string' then
        raise exception 'One or more answers have the wrong type.' using errcode = '22023';
      end if;
    elsif v_question_type in ('number', 'star_rating', 'linear_scale', 'nps') then
      if jsonb_typeof(v_answer) is distinct from 'number' then
        raise exception 'One or more answers have the wrong type.' using errcode = '22023';
      end if;
    elsif v_question_type in ('single_choice', 'dropdown', 'yes_no') then
      if jsonb_typeof(v_answer) is distinct from 'string' then
        raise exception 'One or more answers have the wrong type.' using errcode = '22023';
      end if;
    elsif v_question_type = 'multiple_choice' then
      if jsonb_typeof(v_answer) is distinct from 'array' then
        raise exception 'One or more answers have the wrong type.' using errcode = '22023';
      end if;
    elsif v_question_type in ('address', 'name_fields', 'file_upload') then
      if jsonb_typeof(v_answer) is distinct from 'object' then
        raise exception 'One or more answers have the wrong type.' using errcode = '22023';
      end if;
    end if;

    v_answer_text := case when jsonb_typeof(v_answer) = 'string' then v_answer #>> '{}' else null end;
    v_allow_other := coalesce((v_question ->> 'allow_other')::boolean, false);

    if v_question_type = 'short_text' and char_length(v_answer_text) > 1000 then
      raise exception 'One or more answers are too long.' using errcode = '22023';
    elsif v_question_type = 'long_text' and char_length(v_answer_text) > 20000 then
      raise exception 'One or more answers are too long.' using errcode = '22023';
    elsif v_question_type = 'email' and public.xert_form_answer_is_present(v_answer)
      and not public.xert_form_answer_is_already_provided(v_question, v_answer) and (
      char_length(v_answer_text) > 320
      or v_answer_text !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ) then
      raise exception 'One or more answers are invalid.' using errcode = '22023';
    elsif v_question_type = 'phone' and char_length(v_answer_text) > 60 then
      raise exception 'One or more answers are too long.' using errcode = '22023';
    elsif v_question_type = 'url' and char_length(v_answer_text) > 2048 then
      raise exception 'One or more answers are too long.' using errcode = '22023';
    elsif v_question_type in ('date', 'time', 'datetime') and char_length(v_answer_text) > 40 then
      raise exception 'One or more answers are invalid.' using errcode = '22023';
    elsif v_question_type in ('single_choice', 'dropdown') and public.xert_form_answer_is_present(v_answer) then
      v_options := v_question -> 'options';
      if char_length(v_answer_text) > 500
        or (not v_allow_other and not exists (
          select 1 from jsonb_array_elements_text(v_options) as configured(value)
          where configured.value = v_answer_text
        )) then
        raise exception 'One or more choice answers are invalid.' using errcode = '22023';
      end if;
    elsif v_question_type = 'yes_no' and public.xert_form_answer_is_present(v_answer)
      and v_answer_text not in ('Yes', 'No') then
      raise exception 'One or more choice answers are invalid.' using errcode = '22023';
    elsif v_question_type = 'multiple_choice' and jsonb_array_length(v_answer) > 0 then
      v_options := v_question -> 'options';
      if jsonb_array_length(v_answer) > 100
        or exists (
          select 1 from jsonb_array_elements(v_answer) as selected(value)
          where jsonb_typeof(selected.value) is distinct from 'string'
            or btrim(selected.value #>> '{}') = ''
            or char_length(selected.value #>> '{}') > 500
        )
        or exists (
          select 1
          from jsonb_array_elements(v_answer) as selected(value)
          group by selected.value
          having count(*) > 1
        )
        or (not v_allow_other and exists (
          select 1 from jsonb_array_elements_text(v_answer) as selected(value)
          where not exists (
            select 1 from jsonb_array_elements_text(v_options) as configured(value)
            where configured.value = selected.value
          )
        ))
        or (v_allow_other and (
          select count(*)
          from jsonb_array_elements_text(v_answer) as selected(value)
          where not exists (
            select 1 from jsonb_array_elements_text(v_options) as configured(value)
            where configured.value = selected.value
          )
        ) > 1) then
        raise exception 'One or more choice answers are invalid.' using errcode = '22023';
      end if;
    elsif v_question_type in ('star_rating', 'linear_scale', 'nps') then
      v_answer_number := (v_answer #>> '{}')::numeric;
      if v_answer_number <> trunc(v_answer_number) then
        raise exception 'One or more rating answers are invalid.' using errcode = '22023';
      end if;
      if v_question_type = 'star_rating' and v_answer_number not between 1 and 5 then
        raise exception 'One or more rating answers are invalid.' using errcode = '22023';
      elsif v_question_type = 'nps' and v_answer_number not between 0 and 10 then
        raise exception 'One or more rating answers are invalid.' using errcode = '22023';
      elsif v_question_type = 'linear_scale' then
        v_scale_min := coalesce((v_question ->> 'scale_min')::integer, 1);
        v_scale_max := coalesce((v_question ->> 'scale_max')::integer, 10);
        if v_answer_number not between v_scale_min and v_scale_max then
          raise exception 'One or more rating answers are invalid.' using errcode = '22023';
        end if;
      end if;
    elsif v_question_type = 'signature' and public.xert_form_answer_is_present(v_answer) then
      if not public.xert_valid_form_signature(v_answer_text) then
        raise exception 'The submitted signature is invalid.' using errcode = '22023';
      end if;
    elsif v_question_type in ('address', 'name_fields') then
      if exists (
        select 1 from jsonb_each(v_answer) as part(key, value)
        where (v_question_type = 'address' and part.key not in ('street', 'suburb', 'state', 'postcode', 'country'))
          or (v_question_type = 'name_fields' and part.key not in ('first', 'last'))
          or jsonb_typeof(part.value) is distinct from 'string'
          or char_length(part.value #>> '{}') > 500
      ) then
        raise exception 'One or more compound answers are invalid.' using errcode = '22023';
      end if;
    elsif v_question_type = 'file_upload' and public.xert_form_answer_is_present(v_answer) then
      if exists (
        select 1 from jsonb_object_keys(v_answer) as part(key)
        where part.key not in ('name', 'size', 'type')
      )
        or jsonb_typeof(v_answer -> 'name') is distinct from 'string'
        or nullif(btrim(v_answer ->> 'name'), '') is null
        or char_length(v_answer ->> 'name') > 180
        or jsonb_typeof(v_answer -> 'size') is distinct from 'number'
        or jsonb_typeof(v_answer -> 'type') is distinct from 'string'
        or char_length(v_answer ->> 'type') > 100 then
        raise exception 'The submitted file details are invalid.' using errcode = '22023';
      end if;
      v_answer_number := (v_answer ->> 'size')::numeric;
      if v_answer_number < 0 or v_answer_number <> trunc(v_answer_number) then
        raise exception 'The submitted file details are invalid.' using errcode = '22023';
      end if;
    end if;
  end loop;

  -- Required validation happens after branch calculation. A required field
  -- skipped by a legitimate forward rule was never presented and is therefore
  -- not required; a visible compound value must contain real content.
  for v_question in select value from jsonb_array_elements(v_form.questions)
  loop
    v_question_id := v_question ->> 'id';
    v_question_type := v_question ->> 'type';
    if coalesce((v_question ->> 'hidden')::boolean, false)
      or v_question_type in ('section_break', 'statement')
      or v_question_id = any(v_skipped_ids) then
      continue;
    end if;
    if coalesce((v_question ->> 'required')::boolean, false) then
      v_answer := p_answers -> v_question_id;
      if not coalesce(public.xert_form_answer_is_present(v_answer), false)
        or (v_question_type = 'file_upload' and nullif(btrim(v_answer ->> 'name'), '') is null) then
        raise exception 'Please complete every required question.' using errcode = '22023';
      end if;
    end if;
  end loop;

  if v_form.one_response_per_email then
    if v_email is null then
      raise exception 'Email is required for this form.' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.xert_form_responses r
      where r.form_id = v_form.id and lower(r.respondent_email) = v_email and r.archived_at is null
    ) then
      raise exception 'A response has already been submitted for this email.' using errcode = '23505';
    end if;
  end if;

  insert into public.xert_form_responses (
    form_id, answers, respondent_name, respondent_email, respondent_phone,
    time_taken_seconds, source_url, created_by
  ) values (
    v_form.id,
    p_answers,
    nullif(left(btrim(coalesce(p_respondent_name, '')), 160), ''),
    v_email,
    nullif(left(btrim(coalesce(p_respondent_phone, '')), 60), ''),
    least(greatest(coalesce(p_time_taken_seconds, 0), 0), 43200),
    nullif(left(coalesce(p_source_url, ''), 2048), ''),
    auth.uid()
  ) returning id into v_id;

  update public.xert_forms set response_count = response_count + 1 where id = v_form.id;
  return v_id;
end;
$function$;

-- Proof, then rolled back by the caller's transaction if any assertion fails.
do $$
begin
  if not public.xert_form_answer_is_already_provided(
    '{"type":"email","allow_already_provided":true}'::jsonb, to_jsonb('Already provided'::text)) then
    raise exception 'the tick must be accepted on a field that offers it';
  end if;
  if public.xert_form_answer_is_already_provided(
    '{"type":"email"}'::jsonb, to_jsonb('Already provided'::text)) then
    raise exception 'the tick must be refused on a field that does not offer it';
  end if;
  if public.xert_form_answer_is_already_provided(
    '{"type":"email","allow_already_provided":true}'::jsonb, to_jsonb('not an email'::text)) then
    raise exception 'only the exact tick answer is exempt';
  end if;
  if public.xert_form_answer_is_already_provided(
    '{"type":"number","allow_already_provided":true}'::jsonb, to_jsonb('Already provided'::text)) then
    raise exception 'a number field cannot carry the tick';
  end if;
end;
$$;
