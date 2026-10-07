create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null,
  emirate text not null
    check (emirate in ('abu_dhabi','dubai','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah')),
  timezone text not null default 'Asia/Dubai',
  weekend_days smallint[] not null default '{0,6}',
  notify_parent_on_missing boolean not null default false,
  eta_alert_minutes integer not null default 10 check (eta_alert_minutes between 1 and 60),
  absence_cutoff_minutes integer not null default 60 check (absence_cutoff_minutes between 0 and 720),
  location_retention_days integer not null default 60 check (location_retention_days between 1 and 365),
  drop_distance_warning_m integer not null default 200,
  created_at timestamptz not null default now()
);
alter table public.schools enable row level security;

create table public.school_calendar (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  date date not null,
  type public.calendar_day_type not null,
  note text,
  am_departure_override time,
  pm_departure_override time,
  created_at timestamptz not null default now(),
  unique (school_id, date)
);
alter table public.school_calendar enable row level security;
