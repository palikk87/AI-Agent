# Moving SeeMyGD off Vibecode

The app itself is unchanged — same visualizer, same repair estimator, same
dashboard, same Better Auth logins. Only the things Vibecode used to provide
underneath it have been swapped out:

| Piece | Before (Vibecode) | After |
| --- | --- | --- |
| Code | Vibecode workspace | GitHub (`palikk87/AI-Agent`, `seemygd/`) |
| Database | SQLite file on the container | **Supabase** Postgres |
| Logins | Better Auth on SQLite | **Better Auth**, unchanged, on Supabase Postgres |
| Logo/hero uploads | local `uploads/` folder | Supabase Storage (old files still served) |
| OpenAI calls | Vibecode's built-in proxy | your own OpenAI key |
| Frontend hosting | Vibecode static host | served by the API itself — one URL |
| Domain | — | seemygd.com stays on Lovable, embeds the tool |

Nothing about how the app behaves changes. Owners keep their passwords, their
branding, their pricing and their leads.

---

## What you need

Three accounts: **GitHub** (done), **Supabase** (free tier is fine to start), and
somewhere to run the API — Render, Railway or Fly all work; any of them can run
a Bun app from this repo. Everything else you already have (OpenAI, Square,
Resend).

---

## Step 1 — Get your data out of Vibecode

In the Vibecode project, download the production database file. It lives at
`/data/production.db`. That single file holds every account, company, pricing
setting and lead.

Keep it somewhere safe on your computer — everything else in this guide can be
redone, but this file can't be.

> The copy of `dev.db` that came in the project zip was **not** committed to
> GitHub. It contained real accounts and password hashes, and this repo is
> public.

## Step 2 — Create the Supabase database

1. supabase.com → **New project**. Pick a region near your customers and save
   the database password it generates.
2. Once it finishes provisioning: **Project Settings → Database → Connection
   string**. Copy two of them:
   - **Transaction pooler** (port `6543`) → this is `DATABASE_URL`
   - **Direct connection** (port `5432`) → this is `DIRECT_URL`

## Step 3 — Create the storage bucket

**Storage → New bucket**, name it `branding`, and tick **Public bucket**. This is
where new logo and hero uploads go. (Existing images already in the repo under
`backend/uploads/` keep being served by the app, so current branding does not
break.)

Then **Project Settings → API** and copy the **Project URL** and the
**`service_role` key**.

## Step 4 — Fill in the environment variables

Copy `backend/.env.example` to `backend/.env` and fill it in. Most values come
straight from your old Vibecode `.env`.

Two that matter more than the rest:

- **`BETTER_AUTH_SECRET` — reuse the exact value from Vibecode.** Change it and
  every owner is logged out and has to sign in again.
- **`OPENAI_API_KEY` — must now be a real OpenAI key.** Vibecode was proxying
  these calls for you; that proxy is gone, so the door-swap feature needs your
  own key with `gpt-image-1` access.

## Step 5 — Create the tables, then move the data

From the `backend/` folder:

```bash
bun install
bunx prisma migrate deploy     # creates the tables in Supabase
bun scripts/migrate-sqlite-to-postgres.ts /path/to/production.db
```

The second command copies every row across, keeping the same IDs. Password
hashes come with it, so **existing logins keep working** — no password resets.
It's safe to run more than once if something goes wrong partway.

Check **Supabase → Table Editor** afterwards: you should see your companies,
users and leads.

## Step 6 — Deploy

The API now serves the built frontend too, so the whole tool is one service at
one URL.

Build command:

```bash
cd webapp && bun install && bun run vite build --outDir dist && cd ../backend && bun install && bunx prisma generate
```

Start command:

```bash
cd backend && bun src/index.ts
```

Paste every variable from your `.env` into the host's environment settings, and
set `BACKEND_URL` / `FRONTEND_URL` to the URL the host gives you.

## Step 7 — Point the domain and the embed at it

seemygd.com stays where it is on Lovable. The Lovable site embeds the tool, so
the only change is the URL in the embed snippet — swap the old Vibecode host for
the new one:

```html
<script src="https://YOUR-NEW-HOST/embed.js" data-slug="your-company" defer></script>
```

Owners' own embed snippets come from the dashboard, which builds them from
whatever host the app is running on, so those update themselves.

If you'd rather the tool live at something like `app.seemygd.com`, point that
subdomain at the host with a CNAME and set `EXTRA_TRUSTED_ORIGINS` to
`https://app.seemygd.com`.

## Step 8 — Check it end to end

1. Log in with your existing email and password.
2. Upload a photo and generate a door — confirms the OpenAI key works.
3. Change a logo in the dashboard — confirms Supabase Storage works.
4. Submit a repair estimate — confirms leads and Resend email alerts work.
5. Load the embed on the Lovable site.

## Step 9 — Turn Vibecode off

Only after the checks above pass. Keep the `production.db` backup regardless.

---

## What changed in the code

Everything below is the complete list — no application logic was touched.

- `prisma/schema.prisma` — provider `sqlite` → `postgresql`, added `directUrl`
- `src/prisma.ts` — dropped the SQLite `PRAGMA` statements (they error on Postgres)
- `src/auth.ts` — Better Auth adapter provider → `postgresql`; trusted origins now
  cover seemygd.com / Lovable / `EXTRA_TRUSTED_ORIGINS` instead of vibecode.run
- `src/index.ts` — removed the `@vibecodeapp/proxy` import; CORS list updated;
  added static serving of `webapp/dist` with SPA fallback; removed a hand-written
  root HTML block that pointed at old 941garagedoor URLs and loaded a dev-only script
- `src/storage.ts` (new) — Supabase Storage for branding uploads, local-disk fallback
- `src/routes/companies.ts` — upload handler writes through `storage.ts`
- `scripts/start` — Supabase-aware; dropped the SQLite backup and the Vibecode API call
- `scripts/env.sh` — deleted (it force-set `DATABASE_URL` to a SQLite path)
- `scripts/migrate-sqlite-to-postgres.ts` (new) — the data migration
- `package.json` (both) — removed `@vibecodeapp/*`, added `@supabase/supabase-js`
- `webapp/vite.config.ts` — removed the Vibecode dev plugin
- `webapp/src/lib/portal.ts` — platform-host check no longer looks for vibecode domains

Verified: backend `tsc --noEmit` passes, `vite build` passes, and the server boots
and serves the app, the API, static assets and SPA routes.

## Still worth doing

Not required to migrate, but outstanding:

- `webapp/index.html`, `public/sitemap.xml` and `public/robots.txt` still declare
  `https://visualizer.941garagedoor.com/` as the canonical URL. Search engines and
  social previews will credit the old domain until those are updated to the new host.
