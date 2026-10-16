-- Run this migration in Supabase SQL Editor for an existing CalcBuddy project.

create table if not exists public.calculation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expression text not null check (length(expression) <= 1000),
  answer text not null check (length(answer) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists calculation_history_user_created_idx
  on public.calculation_history (user_id, created_at desc);

create table if not exists public.user_resource_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_slug text not null,
  resource_title text not null,
  is_bookmarked boolean not null default false,
  personal_note text not null default '' check (length(personal_note) <= 5000),
  updated_at timestamptz not null default now(),
  primary key (user_id, resource_slug)
);

alter table public.calculation_history enable row level security;
alter table public.user_resource_data enable row level security;

drop policy if exists "users read own calculation history" on public.calculation_history;
create policy "users read own calculation history" on public.calculation_history
for select to authenticated using (user_id = auth.uid());
drop policy if exists "users add own calculation history" on public.calculation_history;
create policy "users add own calculation history" on public.calculation_history
for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users delete own calculation history" on public.calculation_history;
create policy "users delete own calculation history" on public.calculation_history
for delete to authenticated using (user_id = auth.uid());

drop policy if exists "users manage own resource data" on public.user_resource_data;
create policy "users manage own resource data" on public.user_resource_data
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, delete on public.calculation_history to authenticated;
grant select, insert, update, delete on public.user_resource_data to authenticated;

drop policy if exists "profiles update own display name or admin" on public.profiles;
revoke update on public.profiles from authenticated;
grant select on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name',''),
    case when lower(coalesce(new.email, '')) = 'sooryavanshibhawishya@gmail.com' then 'admin' else 'student' end
  )
  on conflict (id) do update
    set role = case
      when lower(coalesce(new.email, '')) = 'sooryavanshibhawishya@gmail.com' then 'admin'
      else public.profiles.role
    end;
  return new;
end; $$;

update public.profiles p set role = case
  when lower(u.email) = 'sooryavanshibhawishya@gmail.com' then 'admin'
  else 'student'
end
from auth.users u
where p.id = u.id;
