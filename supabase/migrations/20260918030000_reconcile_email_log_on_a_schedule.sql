-- Every email since 4 September still reads "queued" in the Command Centre,
-- including ones the provider accepted with a 200 and a message id. Nothing
-- was wrong with the sending: the status only moves when the reconciler runs,
-- the reconciler only runs when an admin opens the email screen, and pg_net
-- throws the provider's answer away after a few hours. So unless somebody
-- happened to open that screen within the window, the record of a delivered
-- email stayed "queued" for good.
--
-- A staff member opening a page is the wrong trigger for this. It now runs on
-- a schedule, whether or not anybody is looking.

create extension if not exists pg_cron;

-- The work itself, with no session to check: the scheduler has no logged-in
-- admin, which is exactly why the admin-only entry point could never run here.
create or replace function public.reconcile_email_log()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer := 0;
begin
  with responses as (
    select l.id as log_id, r.status_code, r.content, r.error_msg, r.timed_out, r.created
    from public.email_log l
    join net._http_response r on r.id = l.request_id
    where l.status = 'queued' and l.request_id is not null
  )
  update public.email_log l set
    status = case when responses.status_code between 200 and 299 and not coalesce(responses.timed_out, false) then 'sent' else 'failed' end,
    provider_message_id = case when responses.status_code between 200 and 299 then left(responses.content::jsonb ->> 'id', 120) else null end,
    error = case when responses.status_code between 200 and 299 and not coalesce(responses.timed_out, false) then null
                 else left(coalesce(responses.error_msg, 'HTTP ' || coalesce(responses.status_code::text, 'timeout') || ' ' || coalesce(responses.content, '')), 500) end,
    sent_at = case when responses.status_code between 200 and 299 then responses.created else null end,
    updated_at = now()
  from responses
  where l.id = responses.log_id;
  get diagnostics v_count = row_count;

  -- Past the retention window the answer is genuinely gone. "Unknown" says so;
  -- "queued" would go on implying something is still about to happen.
  update public.email_log set status = 'unknown', error = 'PROVIDER_RESPONSE_EXPIRED', updated_at = now()
  where status = 'queued' and request_id is not null and created_at < now() - interval '6 hours';
  return v_count;
end;
$$;

revoke all on function public.reconcile_email_log() from public, anon, authenticated;

-- The admin button keeps its own door and does the same work, so a staff
-- member watching a send land does not have to wait for the next tick.
create or replace function public.admin_reconcile_email_log()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  return public.reconcile_email_log();
end;
$$;
revoke execute on function public.admin_reconcile_email_log() from public, anon;
grant execute on function public.admin_reconcile_email_log() to authenticated;

-- Every five minutes, comfortably inside pg_net's retention.
select cron.unschedule(jobid) from cron.job where jobname = 'reconcile-email-log';
select cron.schedule('reconcile-email-log', '*/5 * * * *', $job$select public.reconcile_email_log()$job$);

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'reconcile-email-log' and active) then
    raise exception 'The email reconciler is not scheduled.';
  end if;
  if pg_catalog.has_function_privilege('anon', 'public.reconcile_email_log()', 'execute')
     or pg_catalog.has_function_privilege('authenticated', 'public.reconcile_email_log()', 'execute') then
    raise exception 'The unauthenticated reconciler must not be reachable by anon or authenticated.';
  end if;
end;
$$;
