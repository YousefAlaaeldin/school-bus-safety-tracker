-- Clients read stop coordinates only through this view (RLS of the caller still applies).
create view public.stops_with_coords
  with (security_invoker = true) as
  select s.*,
         extensions.st_y(s.location::extensions.geometry) as lat,
         extensions.st_x(s.location::extensions.geometry) as lng
  from public.stops s;

grant select on public.stops_with_coords to authenticated;
