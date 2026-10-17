# Supabase setup (accounts)

ReidConvert's login/account pages are built against Supabase Auth and run entirely from
the static site using the **public anon key** (safe to ship). Follow these steps once; then
flip `AUTH_ENABLED` to `true` in `assets/js/config.js`.

## 1. Create the project
1. Create a project at https://supabase.com.
2. Copy **Project URL** and the **anon public** key (Settings → API).
3. Paste them into `assets/js/config.js`:
   ```js
   window.RC_CONFIG = {
     SUPABASE_URL: 'https://xxxx.supabase.co',
     SUPABASE_ANON_KEY: 'eyJ...',   // anon public key (safe to commit)
     AUTH_ENABLED: true,
     MEMBERSHIP_ENFORCED: false,    // keep false until Stripe is live
     GOOGLE_SIGN_IN: true
   };
   ```

## 2. Auth providers
- **Email + password:** on by default. (Optional: Authentication → Providers → Email → turn
  off "Confirm email" for faster testing.)
- **Magic link:** works out of the box with the email provider.
- **Google:** Authentication → Providers → Google → enable, add your Google OAuth client ID/secret.
  Add `https://reidconvert.com/account/` (and your preview URL) to the redirect allow-list.

## 3. Database schema (SQL editor → paste & run)

```sql
-- Profiles: one row per user. Users can read/update their own row, but NOT the
-- subscription fields (only the service role, via the Stripe webhook, may change those).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  subscription_status text not null default 'free',   -- 'free' | 'active'
  stripe_customer_id text,
  current_period_end timestamptz
);

alter table public.profiles enable row level security;

create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users may update only non-billing columns on their own row.
create policy "update own profile (non-billing)"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and subscription_status = (select subscription_status from public.profiles p where p.id = auth.uid())
    and stripe_customer_id is not distinct from (select stripe_customer_id from public.profiles p where p.id = auth.uid())
    and current_period_end is not distinct from (select current_period_end from public.profiles p where p.id = auth.uid())
  );

-- Auto-create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Optional: conversion history (file NAMES + settings only, never contents).
create table if not exists public.conversion_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  converter_id text,
  original_name text,
  output_format text,
  file_size bigint,
  created_at timestamptz not null default now()
);

alter table public.conversion_history enable row level security;

create policy "read own history"
  on public.conversion_history for select using (auth.uid() = user_id);
create policy "insert own history"
  on public.conversion_history for insert with check (auth.uid() = user_id);
```

## 4. Turn it on
Set `AUTH_ENABLED: true` in `assets/js/config.js`, deploy, and visit `/login/`. The "Log in"
item appears in the header on any page that loads `config.js` + `auth.js` (the auth pages do;
to show it site-wide, add those two `<script>` tags to the shared `<head>` block — see
BUILD_REPORT.md → "Wiring the login link site-wide").

Leave `MEMBERSHIP_ENFORCED: false` until Stripe is live so no limits lock. Then see
[STRIPE_SETUP.md](STRIPE_SETUP.md).
