create table public.buses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  label_ar text not null,
  label_en text not null,
  plate text,
  capacity integer,
  created_at timestamptz not null default now()
);
alter table public.buses enable row level security;

create table public.stops (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  label_ar text not null,
  label_en text not null,
  location extensions.geography(Point, 4326) not null,
  area text,
  building text,
  makani_number text,
  landmark_notes text,
  is_school boolean not null default false,
  created_at timestamptz not null default now()
);
create index stops_location_gist on public.stops using gist (location);
alter table public.stops enable row level security;

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  bus_id uuid not null references public.buses (id) on delete restrict,
  direction public.trip_direction not null,
  name_ar text not null,
  name_en text not null,
  default_helper_id uuid references public.profiles (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.routes enable row level security;

create table public.route_schedules (
  route_id uuid not null references public.routes (id),
  weekday smallint not null check (weekday between 0 and 6),
  departure_time time not null,  -- local school time
  primary key (route_id, weekday)
);
alter table public.route_schedules enable row level security;

create table public.route_stops (
  route_id uuid not null references public.routes (id),
  stop_id uuid not null references public.stops (id) on delete restrict,
  sequence integer not null,  -- 1-based, in driving order
  primary key (route_id, stop_id),
  unique (route_id, sequence)
);
alter table public.route_stops enable row level security;

create table public.student_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  route_id uuid not null references public.routes (id),
  stop_id uuid not null references public.stops (id) on delete restrict,  -- must be in route_stops (trigger, T1.10)
  weekdays smallint[] not null default '{1,2,3,4,5}',
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now(),
  unique (student_id, route_id)
);
alter table public.student_assignments enable row level security;
