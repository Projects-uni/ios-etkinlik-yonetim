create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null,
  location text not null,
  category text not null check (category in ('Konser', 'Konferans', 'Spor', 'Festival', 'Atölye', 'Diğer')),
  status text not null default 'Taslak' check (status in ('Taslak', 'Planlanıyor', 'Yayında', 'Tamamlandı', 'İptal')),
  event_date timestamptz not null,
  budget numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  assigned_to text,
  status text not null default 'Beklemede' check (status in ('Beklemede', 'Devam Ediyor', 'Tamamlandı')),
  created_at timestamptz not null default now()
);

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  email text not null,
  invitation_status text not null default 'invited' check (invitation_status in ('invited', 'accepted', 'declined')),
  invited_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, email)
);

alter table public.events enable row level security;
alter table public.tasks enable row level security;
alter table public.event_participants enable row level security;

create policy "organizers manage own events"
on public.events
for all
to authenticated
using (auth.uid() = organizer_id)
with check (auth.uid() = organizer_id);

create policy "organizers manage tasks for own events"
on public.tasks
for all
to authenticated
using (
  exists (
    select 1
    from public.events
    where public.events.id = public.tasks.event_id
      and public.events.organizer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.events
    where public.events.id = public.tasks.event_id
      and public.events.organizer_id = auth.uid()
  )
);

create policy "organizers manage participants for own events"
on public.event_participants
for all
to authenticated
using (
  exists (
    select 1
    from public.events
    where public.events.id = public.event_participants.event_id
      and public.events.organizer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.events
    where public.events.id = public.event_participants.event_id
      and public.events.organizer_id = auth.uid()
  )
);
