create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz not null default now()
);

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(trim(new.email)),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_sync_profile on auth.users;
create trigger on_auth_user_created_sync_profile
after insert or update on auth.users
for each row execute procedure public.sync_profile_from_auth_user();

insert into public.profiles (id, email, full_name)
select
  users.id,
  lower(trim(users.email)),
  nullif(trim(coalesce(users.raw_user_meta_data ->> 'full_name', '')), '')
from auth.users as users
where users.email is not null
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name;

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
  assigned_to_user_id uuid references auth.users (id) on delete set null,
  status text not null default 'Beklemede' check (status in ('Beklemede', 'Devam Ediyor', 'Tamamlandı')),
  created_at timestamptz not null default now()
);

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  email text not null,
  participant_user_id uuid references auth.users (id) on delete set null,
  invitation_status text not null default 'invited' check (invitation_status in ('invited', 'accepted', 'declined')),
  invited_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, email)
);

alter table public.tasks add column if not exists assigned_to_user_id uuid references auth.users (id) on delete set null;
alter table public.event_participants add column if not exists participant_user_id uuid references auth.users (id) on delete set null;

update public.tasks
set assigned_to_user_id = profiles.id,
    assigned_to = profiles.email
from public.profiles
where tasks.assigned_to is not null
  and lower(trim(tasks.assigned_to)) = profiles.email
  and tasks.assigned_to_user_id is distinct from profiles.id;

update public.event_participants
set participant_user_id = profiles.id,
    email = profiles.email
from public.profiles
where lower(trim(event_participants.email)) = profiles.email
  and event_participants.participant_user_id is distinct from profiles.id;

create unique index if not exists event_participants_unique_user_per_event
on public.event_participants (event_id, participant_user_id)
where participant_user_id is not null;

create or replace function public.find_user_by_email(input_email text)
returns table (
  id uuid,
  email text,
  full_name text
)
language sql
security definer
set search_path = public
as $$
  select profiles.id, profiles.email, profiles.full_name
  from public.profiles
  where profiles.email = lower(trim(input_email))
  limit 1;
$$;

create or replace function public.is_event_owner(input_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = input_event_id
      and e.organizer_id = auth.uid()
  );
$$;

create or replace function public.is_event_task_assignee(input_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tasks t
    where t.event_id = input_event_id
      and t.assigned_to_user_id = auth.uid()
  );
$$;

create or replace function public.is_event_invited_or_accepted_participant(input_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_participants ep
    where ep.event_id = input_event_id
      and ep.participant_user_id = auth.uid()
      and ep.invitation_status in ('invited', 'accepted')
  );
$$;

create or replace function public.user_can_access_event(input_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_event_owner(input_event_id)
    or public.is_event_task_assignee(input_event_id)
    or public.is_event_invited_or_accepted_participant(input_event_id);
$$;

create or replace function public.get_event_participant_count(input_event_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select case
    when public.user_can_access_event(input_event_id)
      then coalesce((
        select count(*)::integer
        from public.event_participants ep
        where ep.event_id = input_event_id
          and ep.invitation_status <> 'declined'
      ), 0)
    else 0
  end;
$$;

create or replace function public.respond_to_invitation(input_event_id uuid, input_response text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_response text := lower(trim(input_response));
begin
  if normalized_response not in ('accepted', 'declined') then
    raise exception 'invalid invitation response';
  end if;

  update public.event_participants
  set invitation_status = normalized_response
  where event_id = input_event_id
    and participant_user_id = auth.uid();

  if not found then
    raise exception 'invitation not found';
  end if;

  return normalized_response;
end;
$$;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.tasks enable row level security;
alter table public.event_participants enable row level security;

drop policy if exists "profiles readable by authenticated users" on public.profiles;
create policy "profiles readable by authenticated users"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "owners manage own events" on public.events;
create policy "owners manage own events"
on public.events
for all
to authenticated
using (auth.uid() = organizer_id)
with check (auth.uid() = organizer_id);

drop policy if exists "shared users can view events" on public.events;
create policy "shared users can view events"
on public.events
for select
to authenticated
using (
  auth.uid() = organizer_id
  or public.is_event_task_assignee(id)
  or public.is_event_invited_or_accepted_participant(id)
);

drop policy if exists "owners manage tasks for own events" on public.tasks;
create policy "owners manage tasks for own events"
on public.tasks
for all
to authenticated
using (public.is_event_owner(event_id))
with check (public.is_event_owner(event_id));

drop policy if exists "shared users can view tasks" on public.tasks;
create policy "shared users can view tasks"
on public.tasks
for select
to authenticated
using (
  public.is_event_owner(event_id)
  or assigned_to_user_id = auth.uid()
  or public.is_event_invited_or_accepted_participant(event_id)
);

drop policy if exists "assignees update own tasks" on public.tasks;
create policy "assignees update own tasks"
on public.tasks
for update
to authenticated
using (assigned_to_user_id = auth.uid())
with check (assigned_to_user_id = auth.uid());

drop policy if exists "owners manage participants for own events" on public.event_participants;
create policy "owners manage participants for own events"
on public.event_participants
for all
to authenticated
using (public.is_event_owner(event_id))
with check (public.is_event_owner(event_id));

drop policy if exists "participants view own invitation row" on public.event_participants;
create policy "participants view own invitation row"
on public.event_participants
for select
to authenticated
using (participant_user_id = auth.uid());
