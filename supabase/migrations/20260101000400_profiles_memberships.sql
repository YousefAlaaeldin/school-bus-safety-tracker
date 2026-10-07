create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique,
  email text,
  display_name text,
  locale public.locale_code not null default 'ar',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  school_id uuid not null references public.schools (id),
  role public.membership_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, school_id, role)
);
alter table public.memberships enable row level security;

create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  role public.membership_role not null,
  phone text,
  email text,
  display_name text,
  claimed_by uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  check (phone is not null or email is not null),
  unique (school_id, role, phone),
  unique (school_id, role, email)
);
alter table public.staff_invites enable row level security;
