-- Supabase SQL Editor で実行してください。
-- 最後の admins insert のメールアドレスを管理者のGoogleアカウントに変更してください。

create extension if not exists pgcrypto;

create table if not exists public.admins (
  email text primary key,
  name text,
  created_at timestamptz default now()
);

create table if not exists public.facilitators (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  profile text,
  photo_url text,
  certification_status text default 'ファシリテーター',
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text,
  body text not null,
  images text[] default '{}',
  organizer_name text,
  author_email text,
  facilitator_id uuid references public.facilitators(id),
  published_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  images text[] default '{}',
  session_format text not null default 'Zoom',
  starts_at timestamptz,
  venue_name text,
  address text,
  venue_address text,
  organizer_name text,
  organizer_email text,
  facilitator_id uuid references public.facilitators(id),
  signup_url text,
  created_at timestamptz default now()
);

alter table public.facilitators add column if not exists photo_url text;
alter table public.facilitators alter column certification_status set default 'ファシリテーター';
alter table public.news_posts add column if not exists facilitator_id uuid references public.facilitators(id);
alter table public.events add column if not exists facilitator_id uuid references public.facilitators(id);

alter table public.admins enable row level security;
alter table public.facilitators enable row level security;
alter table public.news_posts enable row level security;
alter table public.events enable row level security;

drop policy if exists "Public can read facilitators" on public.facilitators;
drop policy if exists "Public can read news" on public.news_posts;
drop policy if exists "Public can read events" on public.events;
drop policy if exists "Admins can read admins" on public.admins;
drop policy if exists "Admins can insert facilitators" on public.facilitators;
drop policy if exists "Admins can update facilitators" on public.facilitators;
drop policy if exists "Authenticated can insert news" on public.news_posts;
drop policy if exists "Authenticated can insert events" on public.events;

create policy "Public can read facilitators" on public.facilitators for select using (true);
create policy "Public can read news" on public.news_posts for select using (true);
create policy "Public can read events" on public.events for select using (true);
create policy "Admins can read admins" on public.admins for select to authenticated using (auth.jwt() ->> 'email' = email);

create policy "Admins can insert facilitators" on public.facilitators for insert to authenticated with check (
  exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
);
create policy "Admins can update facilitators" on public.facilitators for update to authenticated using (
  exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
) with check (
  exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
);

create policy "Authenticated can insert news" on public.news_posts for insert to authenticated with check (auth.jwt() ->> 'email' = author_email);
create policy "Authenticated can insert events" on public.events for insert to authenticated with check (auth.jwt() ->> 'email' = organizer_email);

insert into storage.buckets (id, name, public)
values ('yurupaka-media', 'yurupaka-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read yurupaka media" on storage.objects;
drop policy if exists "Authenticated can upload yurupaka media" on storage.objects;

create policy "Public can read yurupaka media" on storage.objects
for select using (bucket_id = 'yurupaka-media');

create policy "Authenticated can upload yurupaka media" on storage.objects
for insert to authenticated with check (bucket_id = 'yurupaka-media');

-- 最初の管理者メールを必ず差し替えてから実行してください。
-- insert into public.admins (email, name) values ('your-google-account@example.com', '江夏 大樹') on conflict (email) do update set name = excluded.name;

-- 管理画面から編集・削除するためのポリシー
alter table public.news_posts add column if not exists author_email text;
alter table public.events add column if not exists organizer_email text;

drop policy if exists "Owners or admins can update news" on public.news_posts;
drop policy if exists "Owners or admins can delete news" on public.news_posts;
drop policy if exists "Owners or admins can update events" on public.events;
drop policy if exists "Owners or admins can delete events" on public.events;

create policy "Owners or admins can update news"
on public.news_posts
for update
to authenticated
using (
  author_email = auth.jwt() ->> 'email'
  or exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
)
with check (
  author_email = auth.jwt() ->> 'email'
  or exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
);

create policy "Owners or admins can delete news"
on public.news_posts
for delete
to authenticated
using (
  author_email = auth.jwt() ->> 'email'
  or exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
);

create policy "Owners or admins can update events"
on public.events
for update
to authenticated
using (
  organizer_email = auth.jwt() ->> 'email'
  or exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
)
with check (
  organizer_email = auth.jwt() ->> 'email'
  or exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
);

create policy "Owners or admins can delete events"
on public.events
for delete
to authenticated
using (
  organizer_email = auth.jwt() ->> 'email'
  or exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
);

-- 既存テーブルに tenant_id が NOT NULL で追加されている場合の解除
-- このサイトは単独運用のため tenant_id を必須にしません。
alter table public.events alter column tenant_id drop not null;

-- address列で既存trigger等が詰まる場合に使う安全な住所列
alter table public.events add column if not exists venue_address text;


-- ブログ記事
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  category text default '未分類',
  excerpt text,
  cover_image text,
  body text not null,
  status text not null default 'published',
  author_name text,
  author_email text,
  published_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.blog_posts enable row level security;

drop policy if exists "Public can read published blog posts" on public.blog_posts;
drop policy if exists "Authors can insert blog posts" on public.blog_posts;
drop policy if exists "Owners or admins can update blog posts" on public.blog_posts;
drop policy if exists "Owners or admins can delete blog posts" on public.blog_posts;

create policy "Public can read published blog posts"
on public.blog_posts for select
using (status = 'published');

create policy "Authors can insert blog posts"
on public.blog_posts for insert
to authenticated
with check (author_email = auth.jwt() ->> 'email');

create policy "Owners or admins can update blog posts"
on public.blog_posts for update
to authenticated
using (
  author_email = auth.jwt() ->> 'email'
  or exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
)
with check (
  author_email = auth.jwt() ->> 'email'
  or exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
);

create policy "Owners or admins can delete blog posts"
on public.blog_posts for delete
to authenticated
using (
  author_email = auth.jwt() ->> 'email'
  or exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
);

create index if not exists blog_posts_published_at_idx on public.blog_posts (published_at desc);
create index if not exists blog_posts_category_idx on public.blog_posts (category);


-- 開催予定専用テーブル（既存eventsテーブルの制約・trigger問題を避けるため）
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  images text[] default '{}',
  session_format text not null default 'Zoom',
  starts_at timestamptz,
  venue_name text,
  venue_address text,
  organizer_name text,
  organizer_email text,
  facilitator_id uuid references public.facilitators(id),
  signup_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.calendar_events enable row level security;

drop policy if exists "Public can read calendar events" on public.calendar_events;
drop policy if exists "Owners can insert calendar events" on public.calendar_events;
drop policy if exists "Owners or admins can update calendar events" on public.calendar_events;
drop policy if exists "Owners or admins can delete calendar events" on public.calendar_events;

create policy "Public can read calendar events"
on public.calendar_events for select
using (true);

create policy "Owners can insert calendar events"
on public.calendar_events for insert
to authenticated
with check (organizer_email = auth.jwt() ->> 'email');

create policy "Owners or admins can update calendar events"
on public.calendar_events for update
to authenticated
using (
  organizer_email = auth.jwt() ->> 'email'
  or exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
)
with check (
  organizer_email = auth.jwt() ->> 'email'
  or exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
);

create policy "Owners or admins can delete calendar events"
on public.calendar_events for delete
to authenticated
using (
  organizer_email = auth.jwt() ->> 'email'
  or exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
);

create index if not exists calendar_events_starts_at_idx on public.calendar_events (starts_at);


-- 旧eventsテーブルに登録済みの開催予定を新calendar_eventsへコピーする場合
insert into public.calendar_events (id, title, description, images, session_format, starts_at, venue_name, venue_address, organizer_name, organizer_email, facilitator_id, signup_url, created_at)
select id, title, description, images, session_format, starts_at, venue_name, coalesce(venue_address, address), organizer_name, organizer_email, facilitator_id, signup_url, created_at
from public.events
on conflict (id) do nothing;
