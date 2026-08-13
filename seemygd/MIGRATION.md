# Moving SeeMyGD off Vibecode

The app is unchanged — same visualizer, same repair estimator, same dashboard,
same logins. Only the things Vibecode provided *underneath* it have been replaced.

| Piece | Before (Vibecode) | After |
| --- | --- | --- |
| Code | Vibecode workspace | GitHub (`palikk87/AI-Agent`, `seemygd/`) |
| Database | SQLite file on the container | **Supabase** Postgres |
| Logins | Better Auth on SQLite | **Better Auth**, unchanged, on Supabase |
| Logo/hero uploads | local `uploads/` folder | Supabase Storage |
| Website hosting | Vibecode static host | the app serves itself — one service |
| Server | Vibecode container | **Render** |
| Address | `newdoor.vibecode.run` | **www.seemygd.com** |
| Backups | Vibecode disk snapshots | Supabase automatic backups |

**Unchanged, and never Vibecode's to begin with:** OpenAI (the app has always
called `api.openai.com` directly with your own `sk-proj-…` key), Square, Resend.

---

## ⚠️ Do this first: rescue the database

Everything else on this page can be redone. This cannot.

Every owner account, password, company branding, repair price and lead lives in
**one file** on the Vibecode container: `/data/production.db`. It was not in the
project zip. **If Vibecode locks before you export it, those users are gone.**

Using the Vibecode extension / file browser, download:

1. `/data/production.db` — keep two copies, in two places
2. `backend/uploads/` — the live logo and hero images
3. The project's `.env` — above all, the current `BETTER_AUTH_SECRET`

Do not start anything below until that file is safely on your computer.

---

## Step 1 — Supabase

1. supabase.com → **New project**. Save the database password it generates.
2. **Project Settings → Database → Connection string**, copy two:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`
   - **Direct connection** (port `5432`) → `DIRECT_URL`
3. **Storage → New bucket**, name it `branding`, tick **Public bucket**.
4. **Project Settings → API**, copy the **Project URL** and the **`service_role` key**.

## Step 2 — Move the data across

Copy `backend/.env.example` to `backend/.env` and fill it in, mostly from the old
Vibecode `.env`. **Reuse `BETTER_AUTH_SECRET` exactly** — a new value logs every
owner out.

Then, from `backend/`:

```bash
bun install
bunx prisma migrate deploy                                    # creates the tables
bun scripts/migrate-sqlite-to-postgres.ts /path/to/production.db   # copies the data
bun scripts/upload-legacy-images.ts /path/to/rescued/uploads      # copies the images
```

The data script keeps the original IDs and the bcrypt password hashes, so
**existing logins keep working** — no password resets, and anyone currently signed
in stays signed in. Both scripts are safe to run more than once.

Check **Supabase → Table Editor**: companies, users and leads should match the old
counts.

## Step 3 — Deploy to Render

The repo has `render.yaml` and a `Dockerfile`, so this is mostly clicking.

1. Render → **New → Blueprint** → pick this repo → set root directory `seemygd`.
2. Render prompts for each secret. Paste them from your `.env`.
3. Deploy, then open the temporary `*.onrender.com` URL and check it works
   **before** touching DNS.

The image builds the frontend and serves it from the same service as the API, so
there is one URL for everything.

## Step 4 — Point the domain

> **Note:** seemygd.com currently shows the Lovable landing page. Pointing it here
> replaces that with the app's own landing page, which already has the SeeMyGD
> branding, features and footer, plus the working tool at `/tool`. If you want to
> keep the Lovable page, put it on a subdomain instead.

At your registrar, point `seemygd.com` and `www` at Render (Render shows the exact
records). Wait for the certificate to go green.

## Step 5 — Cut over the embeds — the part that protects your users

**Do this while Vibecode is still running**, so both work at once.

Every widget already on a customer's website points at
`https://newdoor.vibecode.run/embed.js`. When Vibecode shuts off, those widgets
break — even though the app is running fine at the new address. `vibecode.run`
isn't yours, so it can't be redirected.

For each customer site (you know of 2 — confirm against the tenant list in the
database), replace the snippet with:

```html
<script src="https://www.seemygd.com/embed.js" data-slug="their-slug" defer></script>
```

If a customer is on the Growth tier with their own domain (e.g.
`visualizer.941garagedoor.com`), re-point that CNAME at Render too.

Owners' own snippets in the dashboard rebuild themselves from whatever host the
app runs on, so those are automatically correct from now on.

## Step 6 — Square

Point the webhook at `https://www.seemygd.com/api/square/webhook`. The signature
check compares against `BACKEND_URL`, so the two must match.

Worth knowing: Square is currently in **sandbox** mode
(`SQUARE_ENVIRONMENT=sandbox`) and `SQUARE_WEBHOOK_SIGNATURE_KEY` is empty, so
signatures aren't being verified today. Change both when you're ready to take real
subscription payments.

## Step 7 — Check everything, then shut Vibecode off

1. Log in with an **existing** email and password — proves the data moved.
2. Upload a photo and generate a door — proves the OpenAI key.
3. Change a logo in the dashboard — proves Supabase Storage.
4. Open a company's `/v/their-slug` page — proves branding.
5. Submit a repair estimate — proves leads and email alerts.
6. Load a real customer page with the new embed.

Only when all six pass: turn Vibecode off. Keep the `production.db` backup forever.

---

## What changed in the code

No application logic was touched. The complete list:

**Database (SQLite → Supabase Postgres)**
- `prisma/schema.prisma` — provider `postgresql`, added `directUrl`
- `prisma/migrations/00000000000000_init/` — the initial migration (8 tables,
  7 unique indexes, 6 foreign keys). Without this, `prisma migrate deploy` would
  silently create nothing.
- `src/prisma.ts` — dropped the SQLite `PRAGMA` statements, which error on Postgres
- `src/auth.ts` — Better Auth adapter provider → `postgresql`

**Cutting Vibecode out**
- `src/index.ts` — removed the `@vibecodeapp/proxy` import; CORS list updated
- `package.json` (both) — removed `@vibecodeapp/*`, added `@supabase/supabase-js`
- `webapp/vite.config.ts` — removed the Vibecode dev plugin
- `webapp/src/lib/portal.ts` — platform-host check no longer looks for vibecode domains
- `scripts/start` — Supabase-aware; no SQLite backup, no Vibecode API call
- `scripts/env.sh` — deleted; it force-set `DATABASE_URL` to a SQLite path and
  would have overridden Supabase in production

**Replacing what Vibecode hosted**
- `Dockerfile`, `render.yaml` — single-service deploy
- `src/index.ts` — serves `webapp/dist` with SPA fallback; unmatched `/api/*`
  returns a JSON 404 rather than HTML
- `src/storage.ts` (new) + `src/routes/companies.ts` — uploads to Supabase Storage,
  local-disk fallback for development

**No longer pointing at hosts we don't control**
- `src/index.ts` — `/api/link` redirect and its OG tags now build from `BACKEND_URL`
  instead of the hardcoded `visualizer.941garagedoor.com`
- `webapp/index.html`, `public/sitemap.xml`, `public/robots.txt` — canonical, OG,
  Twitter and sitemap URLs → `www.seemygd.com` (11 replacements)

**Migration tooling (new)**
- `scripts/migrate-sqlite-to-postgres.ts` — the data move
- `scripts/upload-legacy-images.ts` — the image move + DB URL rewrite

Verified: backend `tsc --noEmit` clean, `vite build` clean, and the server boots
and correctly serves the SPA, deep links, static assets, a JSON 404 for unknown
API paths, and `/api/link` redirecting to the new domain.

**Not verified:** none of this has run against a real Supabase database with your
real data — there isn't one to point at yet. Step 2 is where that gets proven.
