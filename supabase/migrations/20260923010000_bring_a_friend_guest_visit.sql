-- "Bring a friend free" days put people in a class who are not paying and not
-- joining, and nothing on the sign-up said so. On the floor on Friday every
-- name looks identical: a guest, a prospective casual and a member all read the
-- same, so staff cannot tell who has been invited from who still owes a visit
-- fee — and afterwards there is no way to count how the promotion went.
--
-- A guest says so when they book, and it stays on the booking.

alter table public.class_bookings
  add column if not exists guest_visit boolean not null default false;

comment on column public.class_bookings.guest_visit is
  'They came in free on a bring-a-friend day: no visit fee owed, no membership.';

-- Unchanged apart from carrying that answer through. Rebuilt from the live
-- definition so nothing else in it drifts.
CREATE OR REPLACE FUNCTION public.submit_class_signup(p_session_id uuid, p_full_name text, p_email text, p_phone text, p_consent boolean DEFAULT false, p_training_level text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_join_waitlist boolean DEFAULT false, p_guest_visit boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_capacity integer;
  v_start timestamptz;
  v_status text;
  v_public boolean;
  v_mode text;
  v_taken integer;
  v_waiting integer;
  v_bookings_open boolean := false;
  v_row_status text;
  v_id uuid;
  v_token uuid;
  v_actor uuid := auth.uid();
  v_name text := btrim(coalesce(p_full_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_level text := nullif(btrim(coalesce(p_training_level, '')), '');
begin
  if p_consent is not true then
    raise exception 'CONSENT_REQUIRED';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'NAME_REQUIRED';
  end if;
  if char_length(v_email) > 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'EMAIL_REQUIRED';
  end if;
  if char_length(v_phone) < 6 or char_length(v_phone) > 32
     or v_phone !~ '^\+?[0-9 ()-]+$' then
    raise exception 'PHONE_REQUIRED';
  end if;
  if char_length(coalesce(v_notes, '')) > 1000 then
    raise exception 'NOTES_TOO_LONG';
  end if;

  select coalesce(bool_or(settings.bookings_enabled), false)
    into v_bookings_open
    from public.admin_settings as settings;

  -- Serialise every sign-up for this class behind one row lock, so the
  -- capacity count below cannot be read stale by a concurrent sign-up.
  select capacity, start_time, status, public_visible, coalesce(booking_mode, 'request_to_book')
    into v_capacity, v_start, v_status, v_public, v_mode
    from public.class_sessions
   where id = p_session_id
     for update;

  if not found then
    raise exception 'CLASS_NOT_FOUND';
  end if;
  if v_status not in ('published', 'full') or v_public is not true then
    raise exception 'CLASS_NOT_OPEN';
  end if;
  if v_start <= now() then
    raise exception 'CLASS_STARTED';
  end if;

  -- 'waitlisted' counts as already signed up: joining a queue twice is the same
  -- mistake as signing up twice, and it made the queue position meaningless.
  if exists (
    select 1
      from public.class_bookings existing
     where existing.class_session_id = p_session_id
       and lower(btrim(existing.email)) = v_email
       and existing.status in ('requested', 'confirmed', 'waitlisted')
  ) then
    raise exception 'ALREADY_SIGNED_UP';
  end if;

  -- The same person must not hold two places in one class by using both doors:
  -- a credit booking on /booking and an anonymous sign-up on /timetable. Match
  -- on the signed-in account when there is one, and on the member's own email
  -- otherwise, since that is all an anonymous visitor gives us.
  if exists (
    select 1
      from public.session_bookings member_booking
      join public.profiles member on member.id = member_booking.user_id
     where member_booking.class_session_id = p_session_id
       and member_booking.status in ('requested', 'confirmed', 'waitlisted')
       and (
         (v_actor is not null and member_booking.user_id = v_actor)
         or lower(btrim(coalesce(member.email, ''))) = v_email
       )
  ) then
    raise exception 'ALREADY_BOOKED_AS_MEMBER';
  end if;

  select held, waiting into v_taken, v_waiting
    from public.class_places_held(p_session_id);

  if coalesce(p_join_waitlist, false) then
    -- An explicit "let me know if a place frees up". Holds no spot, but lands
    -- in a queue the Command Centre can see and work through in order.
    v_row_status := 'waitlisted';
  elsif v_mode = 'instant_book' and v_bookings_open then
    -- Members already queueing for this class have first claim on the room.
    if v_waiting > 0 then
      raise exception 'CLASS_WAITLISTED';
    end if;
    if v_capacity is not null and v_taken >= v_capacity then
      raise exception 'CLASS_FULL';
    end if;
    v_row_status := 'confirmed';
  else
    -- interest_only, request_to_book, or any class while bookings are paused:
    -- record the person and hold nothing.
    v_row_status := 'requested';
  end if;

  insert into public.class_bookings (
    class_session_id, full_name, email, phone, training_level, notes, consent_to_contact, status,
    guest_visit
  )
  values (
    p_session_id, v_name, v_email, v_phone, v_level, v_notes, true, v_row_status,
    coalesce(p_guest_visit, false)
  )
  returning id, cancel_token into v_id, v_token;

  return jsonb_build_object(
    'id', v_id,
    'status', v_row_status,
    'booking_mode', v_mode,
    'bookings_open', v_bookings_open,
    'guest_visit', coalesce(p_guest_visit, false),
    'took_spot', v_row_status = 'confirmed',
    'waitlisted', v_row_status = 'waitlisted',
    'cancel_token', case when v_row_status = 'confirmed' then v_token else null end,
    'spots_left', case
      when v_capacity is null then null
      when v_waiting > 0 then 0
      else greatest(v_capacity - (v_taken + (case when v_row_status = 'confirmed' then 1 else 0 end)), 0)
    end
  );
end;
$function$
;


-- The old signature would otherwise linger alongside the new one and win for
-- callers that pass every argument positionally.
drop function if exists public.submit_class_signup(uuid, text, text, text, boolean, text, text, boolean);

revoke all on function public.submit_class_signup(uuid, text, text, text, boolean, text, text, boolean, boolean) from public;
grant execute on function public.submit_class_signup(uuid, text, text, text, boolean, text, text, boolean, boolean) to anon, authenticated;

do $$
begin
  if not pg_catalog.has_function_privilege('anon',
    'public.submit_class_signup(uuid,text,text,text,boolean,text,text,boolean,boolean)', 'execute') then
    raise exception 'A guest with no account must still be able to sign up.';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_class_signup'
      and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'p_session_id uuid, p_full_name text, p_email text, p_phone text, p_consent boolean, p_training_level text, p_notes text, p_join_waitlist boolean'
  ) then
    raise exception 'The previous sign-up signature is still installed.';
  end if;
end;
$$;
