-- import_roster(school, rows): validate every row first, insert nothing if any row has an error.

create or replace function public.import_roster(p_school_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
  v_idx integer;
  v_errors jsonb := '[]'::jsonb;
  v_student_id uuid;
  v_students integer := 0;
  v_links integer := 0;
  v_inserted integer;
  v_rel text;
  v_phone text;
  v_n integer;
  c_relationships constant text[] := array['mother', 'father', 'guardian', 'other'];
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not private.is_school_admin(p_school_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;

  -- 1. validate all rows
  for v_row, v_idx in
    select e.value, (e.ordinality)::integer from jsonb_array_elements(p_rows) with ordinality as e
  loop
    if coalesce(trim(v_row->>'name_en'), '') = '' then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'NAME_EN_REQUIRED');
    end if;
    if coalesce(trim(v_row->>'name_ar'), '') = '' then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'NAME_AR_REQUIRED');
    end if;
    for v_n in 1..2 loop
      v_phone := nullif(trim(coalesce(v_row->>(case v_n when 1 then 'guardian_phone' else 'guardian2_phone' end), '')), '');
      v_rel := nullif(trim(coalesce(v_row->>(case v_n when 1 then 'relationship' else 'relationship2' end), '')), '');
      if v_phone is not null and private.normalize_phone(v_phone) is null then
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'BAD_PHONE');
      end if;
      if v_rel is not null and not (v_rel = any (c_relationships)) then
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'BAD_RELATIONSHIP');
      end if;
    end loop;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object('students_created', 0, 'links_created', 0, 'errors', v_errors);
  end if;

  -- 2. insert
  for v_row in select e.value from jsonb_array_elements(p_rows) as e loop
    insert into public.students (school_id, name_en, name_ar, grade)
    values (p_school_id, trim(v_row->>'name_en'), trim(v_row->>'name_ar'),
            nullif(trim(coalesce(v_row->>'grade', '')), ''))
    returning id into v_student_id;
    v_students := v_students + 1;

    for v_n in 1..2 loop
      v_phone := nullif(trim(coalesce(v_row->>(case v_n when 1 then 'guardian_phone' else 'guardian2_phone' end), '')), '');
      v_rel := coalesce(
        nullif(trim(coalesce(v_row->>(case v_n when 1 then 'relationship' else 'relationship2' end), '')), ''),
        'guardian');
      if v_phone is not null then
        -- the guardian_links trigger normalises the phone, sets school_id and attaches a profile
        insert into public.guardian_links (student_id, school_id, guardian_phone, relationship)
        values (v_student_id, p_school_id, v_phone, v_rel)
        on conflict (student_id, guardian_phone) do nothing;
        get diagnostics v_inserted = row_count;
        v_links := v_links + v_inserted;
      end if;
    end loop;
  end loop;

  return jsonb_build_object('students_created', v_students, 'links_created', v_links, 'errors', '[]'::jsonb);
end;
$$;

revoke execute on function public.import_roster(uuid, jsonb) from public, anon;
grant execute on function public.import_roster(uuid, jsonb) to authenticated;
