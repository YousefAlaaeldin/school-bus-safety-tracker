-- Phone normalisation to E.164. TS twin: packages/shared/src/phone.ts (keep in sync).
create or replace function private.normalize_phone(p text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  if p is null then
    return null;
  end if;
  v := regexp_replace(p, '[\s\-\(\)]', '', 'g');
  if v like '00%' then
    v := '+' || substr(v, 3);
  elsif v ~ '^05[0-9]{8}$' then
    v := '+971' || substr(v, 2);
  elsif v like '9715%' then
    v := '+' || v;
  end if;
  if v ~ '^\+[1-9][0-9]{7,14}$' then
    return v;
  end if;
  return null;
end;
$$;

create or replace function private.make_point(p_lat double precision, p_lng double precision)
returns extensions.geography
language sql
immutable
set search_path = ''
as $$
  select case
    when p_lat is null or p_lng is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
  end;
$$;
