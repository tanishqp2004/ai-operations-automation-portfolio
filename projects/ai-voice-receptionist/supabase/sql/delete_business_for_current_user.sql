create or replace function public.delete_business_for_current_user(
  p_business_id uuid,
  p_confirmation_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_business_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_business_id is null or p_confirmation_name is null then
    raise exception 'Clinic confirmation is required';
  end if;

  -- Only the authenticated creator who still has the owner role can delete
  -- this exact clinic. Lock the parent row while validating and deleting.
  select b.name
    into v_business_name
  from public.businesses as b
  join public.business_memberships as bm
    on bm.business_id = b.id
   and bm.user_id = v_user_id
   and bm.role = 'owner'
  where b.id = p_business_id
    and b.created_by = v_user_id
  for update of b;

  if not found then
    raise exception 'You are not authorized to delete this clinic';
  end if;

  if v_business_name <> p_confirmation_name then
    raise exception 'Clinic name confirmation does not match';
  end if;

  -- Appointments have RESTRICT references to clinic-scoped customers and
  -- services, so remove this clinic's appointments before parent cascades.
  delete from public.appointments
  where business_id = p_business_id;

  -- All remaining clinic-owned rows cascade from this one parent delete.
  -- The business_id predicate and creator/owner check prevent cross-clinic
  -- deletion. PostgreSQL runs this function call in one transaction.
  delete from public.businesses
  where id = p_business_id
    and created_by = v_user_id;

  if not found then
    raise exception 'Clinic could not be deleted';
  end if;

  return jsonb_build_object('success', true, 'business_id', p_business_id);
end;
$function$;

revoke all on function public.delete_business_for_current_user(uuid, text) from public;
revoke all on function public.delete_business_for_current_user(uuid, text) from anon;
grant execute on function public.delete_business_for_current_user(uuid, text) to authenticated;
