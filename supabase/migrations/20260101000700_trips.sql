create table public.trips (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  route_id uuid not null references public.routes (id) on delete restrict,
  bus_id uuid not null references public.buses (id) on delete restrict,
  helper_id uuid references public.profiles (id) on delete set null,
  direction public.trip_direction not null,
  service_date date not null,
  scheduled_departure timestamptz not null,
  status public.trip_status not null default 'scheduled',
  started_at timestamptz,
  roll_call_confirmed_at timestamptz,
  arrived_school_at timestamptz,
  ended_at timestamptz,
  end_forced boolean not null default false,
  end_reason text,
  created_at timestamptz not null default now(),
  unique (route_id, service_date)
);
create index trips_helper_date_idx on public.trips (helper_id, service_date);
create index trips_school_date_idx on public.trips (school_id, service_date);
alter table public.trips enable row level security;

create table public.trip_students (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id),
  student_id uuid not null references public.students (id),
  stop_id uuid not null references public.stops (id) on delete restrict,
  stop_sequence integer not null,
  status public.student_trip_status not null default 'expected',
  boarded_at timestamptz,
  boarded_location extensions.geography(Point, 4326),
  dropped_at timestamptz,
  dropped_location extensions.geography(Point, 4326),
  drop_distance_m integer,  -- distance from the stop when the drop was ticked
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  eta_at timestamptz,
  eta_source public.eta_source,
  eta_updated_at timestamptz,
  eta_alert_sent_at timestamptz,
  unique (trip_id, student_id)
);
create index trip_students_student_idx on public.trip_students (student_id);
alter table public.trip_students enable row level security;

create table public.trip_events (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips (id),
  student_id uuid references public.students (id),
  type public.trip_event_type not null,
  actor_id uuid references public.profiles (id) on delete set null,
  client_action_id uuid,
  device_time timestamptz,
  server_time timestamptz not null default now(),
  location extensions.geography(Point, 4326),
  payload jsonb not null default '{}'
);
create index trip_events_trip_time_idx on public.trip_events (trip_id, server_time);
alter table public.trip_events enable row level security;
revoke update, delete on public.trip_events from authenticated, anon;

create table public.client_actions (
  id uuid primary key,  -- client-generated, no default
  user_id uuid not null references public.profiles (id),
  rpc text not null,
  result jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.client_actions enable row level security;
