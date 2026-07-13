-- ============================================================
-- HabitQuest — User profile pictures
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- 1. Column to store the public URL of the uploaded avatar.
alter table public.profiles
  add column if not exists avatar_url text;

-- 2. Storage bucket for avatar images (public read, so avatars display
--    on the leaderboard/profile pages for everyone, same as the rest of
--    this app's public-read data model).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3. RLS on storage.objects for the avatars bucket:
--    - anyone can read (public bucket, matches profiles/task_logs/etc.)
--    - a user may only insert/update/delete files inside a folder named
--      after their own auth uid (path convention: "<user_id>/avatar.jpg"),
--      so nobody can overwrite someone else's picture.
drop policy if exists "avatars_public_read"   on storage.objects;
drop policy if exists "avatars_own_insert"    on storage.objects;
drop policy if exists "avatars_own_update"    on storage.objects;
drop policy if exists "avatars_own_delete"    on storage.objects;

create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_own_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_own_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_own_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
