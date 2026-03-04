# Supabase Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Choose your organization, name the project (e.g., `mtg-match-tracker`)
4. Set a strong database password (save it somewhere safe)
5. Choose a region close to your users
6. Click **Create new project** and wait for it to provision

## 2. Get Your API Credentials

1. Go to **Settings → API** in your Supabase dashboard
2. Copy the **Project URL** (looks like `https://xxxxx.supabase.co`)
3. Copy the **anon/public** key (starts with `eyJ...`)
4. Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 3. Enable Google OAuth

1. Go to **Authentication → Providers** in your Supabase dashboard
2. Find **Google** and toggle it on
3. You'll need a Google OAuth client:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (or select existing)
   - Go to **APIs & Services → Credentials**
   - Click **Create Credentials → OAuth Client ID**
   - Application type: **Web application**
   - Add authorized redirect URI: `https://your-project-id.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client Secret**
4. Paste the Client ID and Client Secret into the Supabase Google provider settings
5. Click **Save**

## 4. Configure Auth Settings

1. Go to **Authentication → URL Configuration**
2. Set **Site URL** to your app's URL (e.g., `http://localhost:5173` for development)
3. Add redirect URLs:
   - `http://localhost:5173` (development)
   - `https://yourdomain.com/mtg-stats/` (VPS production)
   - `https://yourusername.github.io/mtg-match-tracker/` (GitHub Pages production)

## 5. Run Database Migrations

Run the SQL migrations in order via the **SQL Editor** in Supabase dashboard:

1. Go to **SQL Editor** → **New Query**
2. Copy and paste each migration file in order:
   - `supabase/migrations/001_profiles.sql`
   - `supabase/migrations/002_friendships.sql`
   - `supabase/migrations/003_games.sql`
   - `supabase/migrations/004_game_players.sql`
3. Run each one individually and verify no errors

**Alternatively**, if you have the Supabase CLI installed:

```bash
supabase db push
```

## 6. Verify Setup

1. Check **Table Editor** — you should see: `profiles`, `friendships`, `games`, `game_players`
2. Check **Authentication → Policies** — each table should have RLS policies
3. Try creating a test user via **Authentication → Users → Add User**
4. Verify a profile was auto-created in the `profiles` table

## 7. Configure Storage (Optional — for avatars)

1. Go to **Storage** → **New Bucket**
2. Create a bucket named `avatars`
3. Set it to **Public**
4. Add a policy allowing authenticated users to upload to their own folder:

```sql
create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');
```

## Troubleshooting

- **Auth redirects not working**: Make sure your redirect URLs match exactly (including trailing slashes)
- **RLS blocking queries**: Check the SQL editor for policy issues. You can temporarily disable RLS for debugging (re-enable after!)
- **Google OAuth errors**: Verify the redirect URI matches `https://your-project-id.supabase.co/auth/v1/callback` exactly
- **Profile not created on signup**: Check that the `on_auth_user_created` trigger exists on `auth.users`
