create table public.bus_positions (
  trip_id uuid primary key references public.trips (id),
  school_id uuid not null references public.schools (id),
  location extensions.geography(Point, 4326) not null,
  lat double precision not null,  -- Realtime sends geography as hex, so clients read lat/lng
  lng double precision not null,
  heading real,
  speed_mps real,
  accuracy_m real,
  recorded_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.bus_positions enable row level security;

create table public.location_pings (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips (id),
  location extensions.geography(Point, 4326) not null,
  heading real,
  speed_mps real,
  accuracy_m real,
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  unique (trip_id, recorded_at)  -- replays are ignored
);
create index location_pings_trip_recorded_idx on public.location_pings (trip_id, recorded_at);
alter table public.location_pings enable row level security;

create table public.absence_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  service_date date not null,
  direction public.trip_direction not null,  -- "both" is stored as two rows
  reported_by uuid references public.profiles (id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  unique (student_id, service_date, direction)
);
alter table public.absence_reports enable row level security;

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  expo_token text not null unique,
  platform public.device_platform not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  type public.notification_type not null,
  recipient_user_id uuid not null references public.profiles (id),
  school_id uuid not null references public.schools (id),
  trip_id uuid references public.trips (id),
  student_id uuid references public.students (id),
  params jsonb not null default '{}',
  send_after timestamptz not null default now(),
  status public.notification_status not null default 'pending',
  attempts integer not null default 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  expo_ticket_ids text[] not null default '{}',
  sent_tokens text[] not null default '{}',  -- same order as expo_ticket_ids
  receipts_checked_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index notification_outbox_status_send_after_idx
  on public.notification_outbox (status, send_after);
alter table public.notification_outbox enable row level security;

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  trip_id uuid references public.trips (id),
  type public.alert_type not null,
  severity public.alert_severity not null,
  dedupe_key text not null unique,
  payload jsonb not null default '{}',
  acknowledged_by uuid references public.profiles (id) on delete set null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
create index alerts_school_created_idx on public.alerts (school_id, created_at desc);
alter table public.alerts enable row level security;
