-- Public patient booking portal: narrowly scoped anonymous read and booking RPCs.
-- Implementations live in the non-exposed private schema. Public wrappers are
-- SECURITY INVOKER and expose only these specific operations to anon/authenticated.

create or replace function private.get_public_booking_page(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if p_slug is null or length(p_slug) < 2 or length(p_slug) > 100 then
    return null;
  end if;

  select jsonb_build_object(
    'business', jsonb_build_object(
      'name', b.name,
      'slug', b.slug,
      'phone', b.phone,
      'address', b.address,
      'timezone', b.timezone
    ),
    'services', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'description', s.description,
          'duration_minutes', s.duration_minutes,
          'price', s.price
        ) order by s.name
      )
      from public.services s
      where s.business_id = b.id and s.is_active
    ), '[]'::jsonb)
  )
  into v_result
  from public.businesses b
  where b.slug = p_slug and b.is_active;

  return v_result;
end;
$function$;

create or replace function private.get_public_available_slots(
  p_slug text,
  p_service_id uuid,
  p_local_date date
)
returns table(slot_start timestamptz, slot_end timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_business_id uuid;
  v_timezone text;
  v_duration integer;
  v_open timestamptz;
  v_close timestamptz;
  v_close_time time;
  v_open_time time;
begin
  if p_slug is null or p_service_id is null or p_local_date is null then
    raise exception 'Clinic, service and date are required';
  end if;

  select b.id, b.timezone, s.duration_minutes
    into v_business_id, v_timezone, v_duration
  from public.businesses b
  join public.services s on s.business_id = b.id
  where b.slug = p_slug and b.is_active
    and s.id = p_service_id and s.is_active;

  if not found then
    raise exception 'Clinic or active service was not found';
  end if;

  if p_local_date < (now() at time zone v_timezone)::date
     or p_local_date > (now() at time zone v_timezone)::date + 30 then
    raise exception 'Choose a date within the next 30 days';
  end if;

  select h.opens_at, h.closes_at
    into v_open_time, v_close_time
  from public.business_hours h
  where h.business_id = v_business_id
    and h.day_of_week = extract(dow from p_local_date)::smallint
    and not h.is_closed;

  if not found or v_open_time is null or v_close_time is null then
    return;
  end if;

  v_open := (p_local_date + v_open_time) at time zone v_timezone;
  v_close := (p_local_date + v_close_time) at time zone v_timezone;

  return query
  select candidate.slot_start,
         candidate.slot_start + make_interval(mins => v_duration)
  from pg_catalog.generate_series(
    v_open,
    v_close - make_interval(mins => v_duration),
    interval '15 minutes'
  ) as candidate(slot_start)
  where candidate.slot_start > now()
    and not exists (
      select 1
      from public.appointments a
      where a.business_id = v_business_id
        and a.resource_key = 'main-calendar'
        and a.status in ('pending', 'confirmed')
        and pg_catalog.tstzrange(a.starts_at, a.ends_at, '[)')
            && pg_catalog.tstzrange(
              candidate.slot_start,
              candidate.slot_start + make_interval(mins => v_duration),
              '[)'
            )
    )
  order by candidate.slot_start;
end;
$function$;

create or replace function private.create_public_booking(
  p_slug text,
  p_service_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_starts_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_business_id uuid;
  v_timezone text;
  v_duration integer;
  v_local_start timestamp;
  v_local_end timestamp;
  v_local_today date;
  v_day smallint;
  v_open time;
  v_close time;
  v_open_minutes integer;
  v_start_minutes integer;
  v_phone text;
  v_customer_id uuid;
  v_appointment public.appointments%rowtype;
  v_existing public.appointments%rowtype;
  v_existing_phone text;
begin
  if p_slug is null or length(p_slug) < 2 or length(p_slug) > 100 then
    raise exception 'Invalid clinic link';
  end if;
  if p_customer_name is null or length(btrim(p_customer_name)) not between 2 and 120 then
    raise exception 'Enter a name between 2 and 120 characters';
  end if;

  v_phone := regexp_replace(coalesce(p_customer_phone, ''), '[^0-9+]', '', 'g');
  if length(v_phone) <> 13 or v_phone !~ '^\+91[6-9][0-9]{9}' then
    raise exception 'Enter a valid 10-digit Indian mobile number';
  end if;

  if p_customer_email is not null and btrim(p_customer_email) <> ''
     and (length(p_customer_email) > 254
       or p_customer_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$') then
    raise exception 'Enter a valid email address';
  end if;

  if p_service_id is null or p_starts_at is null then
    raise exception 'Choose a service and available appointment time';
  end if;
  if p_idempotency_key is null
     or p_idempotency_key !~ '^[0-9a-fA-F-]{36}$' then
    raise exception 'Invalid booking request. Refresh the page and try again.';
  end if;

  select b.id, b.timezone, s.duration_minutes
    into v_business_id, v_timezone, v_duration
  from public.businesses b
  join public.services s on s.business_id = b.id
  where b.slug = p_slug and b.is_active
    and s.id = p_service_id and s.is_active;

  if not found then
    raise exception 'Clinic or active service was not found';
  end if;

  select a.* into v_existing
  from public.appointments a
  join public.customers c
    on c.id = a.customer_id and c.business_id = a.business_id
  where a.business_id = v_business_id
    and a.idempotency_key = p_idempotency_key;

  if found then
    select c.phone into v_existing_phone
    from public.customers c
    where c.id = v_existing.customer_id and c.business_id = v_business_id;

    if v_existing.service_id = p_service_id
       and v_existing.starts_at = p_starts_at
       and v_existing_phone = v_phone then
      return jsonb_build_object(
        'success', true,
        'duplicate_request', true,
        'booking_reference', v_existing.booking_reference,
        'starts_at', v_existing.starts_at,
        'ends_at', v_existing.ends_at,
        'status', v_existing.status
      );
    end if;
    raise exception 'This booking request was already used. Refresh the page and try again.';
  end if;

  if p_starts_at <= now() then
    raise exception 'Choose a future appointment time';
  end if;

  v_local_start := p_starts_at at time zone v_timezone;
  v_local_end := (p_starts_at + make_interval(mins => v_duration)) at time zone v_timezone;
  v_local_today := (now() at time zone v_timezone)::date;

  if v_local_start::date < v_local_today
     or v_local_start::date > v_local_today + 30 then
    raise exception 'Appointments can be booked up to 30 days ahead';
  end if;

  v_day := extract(dow from v_local_start)::smallint;
  select h.opens_at, h.closes_at
    into v_open, v_close
  from public.business_hours h
  where h.business_id = v_business_id
    and h.day_of_week = v_day
    and not h.is_closed;

  if not found or v_open is null or v_close is null
     or v_local_start::time < v_open
     or v_local_end::time > v_close
     or v_local_start::date <> v_local_end::date then
    raise exception 'That time is outside clinic hours';
  end if;

  v_open_minutes := extract(hour from v_open)::integer * 60
                    + extract(minute from v_open)::integer;
  v_start_minutes := extract(hour from v_local_start)::integer * 60
                     + extract(minute from v_local_start)::integer;
  if mod(v_start_minutes - v_open_minutes, 15) <> 0 then
    raise exception 'Choose one of the available 15-minute start times';
  end if;

  insert into public.customers(business_id, full_name, phone, email)
  values (
    v_business_id,
    btrim(p_customer_name),
    v_phone,
    nullif(btrim(coalesce(p_customer_email, '')), '')
  )
  on conflict (business_id, phone) do update
    set full_name = excluded.full_name,
        email = coalesce(excluded.email, public.customers.email)
  returning id into v_customer_id;

  insert into public.appointments(
    business_id, customer_id, service_id, starts_at, ends_at,
    resource_key, status, booking_source, notes, idempotency_key, booking_reference
  )
  values (
    v_business_id, v_customer_id, p_service_id, p_starts_at,
    p_starts_at + make_interval(mins => v_duration),
    'main-calendar', 'confirmed', 'web', null, p_idempotency_key, null
  )
  returning * into v_appointment;

  return jsonb_build_object(
    'success', true,
    'duplicate_request', false,
    'booking_reference', v_appointment.booking_reference,
    'starts_at', v_appointment.starts_at,
    'ends_at', v_appointment.ends_at,
    'status', v_appointment.status,
    'timezone', v_timezone
  );
exception
  when exclusion_violation then
    raise exception 'That time slot has just been booked. Please choose another available time.';
  when unique_violation then
    select a.* into v_existing
    from public.appointments a
    where a.business_id = v_business_id
      and a.idempotency_key = p_idempotency_key;
    if found then
      select c.phone into v_existing_phone
      from public.customers c
      where c.id = v_existing.customer_id and c.business_id = v_business_id;
      if v_existing.service_id = p_service_id
         and v_existing.starts_at = p_starts_at
         and v_existing_phone = v_phone then
        return jsonb_build_object(
          'success', true,
          'duplicate_request', true,
          'booking_reference', v_existing.booking_reference,
          'starts_at', v_existing.starts_at,
          'ends_at', v_existing.ends_at,
          'status', v_existing.status
        );
      end if;
    end if;
    raise exception 'A conflicting booking or duplicate request was detected';
end;
$function$;

revoke all on function private.get_public_booking_page(text) from public, anon, authenticated;
revoke all on function private.get_public_available_slots(text, uuid, date) from public, anon, authenticated;
revoke all on function private.create_public_booking(text, uuid, text, text, text, timestamptz, text) from public, anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.get_public_booking_page(text) to anon, authenticated;
grant execute on function private.get_public_available_slots(text, uuid, date) to anon, authenticated;
grant execute on function private.create_public_booking(text, uuid, text, text, text, timestamptz, text) to anon, authenticated;

create or replace function public.get_public_booking_page(p_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.get_public_booking_page(p_slug);
$function$;

create or replace function public.get_public_available_slots(
  p_slug text,
  p_service_id uuid,
  p_local_date date
)
returns table(slot_start timestamptz, slot_end timestamptz)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.get_public_available_slots(p_slug, p_service_id, p_local_date);
$function$;

create or replace function public.create_public_booking(
  p_slug text,
  p_service_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_starts_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.create_public_booking(
    p_slug, p_service_id, p_customer_name, p_customer_phone,
    p_customer_email, p_starts_at, p_idempotency_key
  );
$function$;

revoke all on function public.get_public_booking_page(text) from public;
revoke all on function public.get_public_available_slots(text, uuid, date) from public;
revoke all on function public.create_public_booking(text, uuid, text, text, text, timestamptz, text) from public;
grant execute on function public.get_public_booking_page(text) to anon, authenticated;
grant execute on function public.get_public_available_slots(text, uuid, date) to anon, authenticated;
grant execute on function public.create_public_booking(text, uuid, text, text, text, timestamptz, text) to anon, authenticated;
