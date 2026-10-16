-- CalcBuddy Supabase schema
-- Run in Supabase SQL Editor. Keep the service_role key server-side only.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  category text not null default 'General',
  title text not null,
  slug text not null unique,
  summary text not null default '',
  body_md text not null default '',
  tags text[] not null default '{}',
  published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_published_updated_idx on public.notes (published, updated_at desc);
create index if not exists notes_tags_idx on public.notes using gin(tags);

create table if not exists public.note_formulas (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  label text not null default 'Formula',
  latex text not null,
  sort_order integer not null default 0
);

create table if not exists public.note_code_blocks (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  title text not null default 'Example',
  language text not null check (language in ('python','matlab','cpp','javascript','typescript','java','c','text','bash')),
  code text not null,
  sort_order integer not null default 0
);

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

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at before update on public.notes
for each row execute function public.set_updated_at();

-- New auth users get student access; the designated account is the sole automatic admin.
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
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.notes enable row level security;
alter table public.note_formulas enable row level security;
alter table public.note_code_blocks enable row level security;
alter table public.calculation_history enable row level security;
alter table public.user_resource_data enable row level security;

-- Helper function avoids repeating role checks. SECURITY DEFINER bypasses RLS on profiles
-- for the lookup only; use a fixed search_path and revoke public execution.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "profiles read own or admin" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles update own display name or admin" on public.profiles;

create policy "published categories visible" on public.categories
for select to anon, authenticated using (
  exists (select 1 from public.notes n where n.category_id = categories.id and n.published = true)
  or public.is_admin()
);
create policy "admins manage categories" on public.categories
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "published notes visible" on public.notes
for select to anon, authenticated using (published = true or public.is_admin());
create policy "admins insert notes" on public.notes
for insert to authenticated with check (public.is_admin());
create policy "admins update notes" on public.notes
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete notes" on public.notes
for delete to authenticated using (public.is_admin());

create policy "formulas visible for published notes" on public.note_formulas
for select to anon, authenticated using (
  exists (select 1 from public.notes n where n.id = note_id and n.published = true)
  or public.is_admin()
);
create policy "admins manage formulas" on public.note_formulas
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "code visible for published notes" on public.note_code_blocks
for select to anon, authenticated using (
  exists (select 1 from public.notes n where n.id = note_id and n.published = true)
  or public.is_admin()
);
create policy "admins manage code" on public.note_code_blocks
for all to authenticated using (public.is_admin()) with check (public.is_admin());

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

grant select on public.categories, public.notes, public.note_formulas, public.note_code_blocks to anon, authenticated;
grant insert, update, delete on public.categories, public.notes, public.note_formulas, public.note_code_blocks to authenticated;
grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant select, insert, delete on public.calculation_history to authenticated;
grant select, insert, update, delete on public.user_resource_data to authenticated;

-- Keep this email as the only administrator; all other existing accounts are students.
update public.profiles p
set role = 'student'
from auth.users u
where p.id = u.id and lower(coalesce(u.email, '')) <> 'sooryavanshibhawishya@gmail.com';

insert into public.profiles (id, display_name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  'admin'
from auth.users u
where lower(coalesce(u.email, '')) = 'sooryavanshibhawishya@gmail.com'
on conflict (id) do update set role = 'admin';

notify pgrst, 'reload schema';
-- Keep this SQL restricted to the project owner/admin. Do not expose SQL credentials.
