# Enable cross-device sync with Supabase

The current browser-only version stores leads in `localStorage`. That storage is private to one browser profile on one device. To see the same leads on a phone, tablet and computer, each person must sign in and the app must store that person's leads in a cloud database.

This version uses Supabase Auth + a `public.leads` table. Each person gets their own rows, protected by Row Level Security (RLS).

## 1. Create a Supabase project

1. Create a project at https://supabase.com/.
2. In **Project Settings → API**, copy the **Project URL** and the **anon/public key**.
3. Open `supabase-config.js` and replace the two placeholder values:

```js
export const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_PUBLIC_KEY";
```

The anon/public key is designed for client-side use when Row Level Security is enabled. **Never use the `service_role` key in this website.**

## 2. Create the table and secure it

In the Supabase dashboard, open **SQL Editor → New query** and run:

```sql
create table if not exists public.leads (
    id uuid primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    url text not null,
    created_at timestamptz not null default now()
);

create index if not exists leads_user_id_idx
    on public.leads (user_id);

alter table public.leads enable row level security;

drop policy if exists "Users can read their own leads" on public.leads;
create policy "Users can read their own leads"
    on public.leads for select
    using (auth.uid() = user_id);

drop policy if exists "Users can add their own leads" on public.leads;
create policy "Users can add their own leads"
    on public.leads for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own leads" on public.leads;
create policy "Users can update their own leads"
    on public.leads for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own leads" on public.leads;
create policy "Users can delete their own leads"
    on public.leads for delete
    using (auth.uid() = user_id);
```

## 3. Configure authentication URLs

In Supabase, open **Authentication → URL Configuration**. Set the Site URL to your deployed Leads Tracker address and add that address under **Redirect URLs**. Use your actual GitHub Pages URL (including the repository path if the app is hosted in a project site).

You can manage whether email confirmation is required under **Authentication → Providers → Email**. When confirmation is enabled, a new user must click the email confirmation link before signing in.

## 4. Deploy the files together

Keep these files in the same directory as `index.html`:

- `index.html`
- `index.css`
- `index.js`
- `supabase-config.js`
- `site.webmanifest`
- `favicon.svg`
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png`
- `android-chrome-192x192.png`
- `android-chrome-512x512.png`

Commit and push the updated files to GitHub Pages. Because the website is static, the Supabase URL and anon/public key are visible in the browser; this is expected. The RLS policies above are what prevent one user from reading or changing another user's leads.

## 5. How people use it

1. A new person opens Leads Tracker and chooses **Create Account**.
2. They confirm their email if your Supabase settings require it, then sign in.
3. Their leads are saved locally for quick access and synced to their Supabase account.
4. On another device, they open the same website and sign in with the same account. The app loads that account's cloud leads.
5. If they already had leads saved by the older version on one device, sign in and choose **Import this device's leads** to copy those guest leads into their account.

Without the Supabase configuration and SQL setup, the app continues to work in local-only mode. Local-only data does not automatically move between devices.
