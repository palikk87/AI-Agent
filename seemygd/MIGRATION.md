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

**Do not use the workspace's Database tab** — that is the dev database
(`file:./dev.db`, 3 users). Production has no `DATABASE_URL` set at all, so the
old start script derived `file:/data/production.db` at boot. The go/no-go test is
the row count: production is **Company 5, User 7**; dev is 1 and 3.

Two ways to get it, in order of preference:

1. **SSH** (Deployment → Settings → SSH access) — gets the real SQLite file plus
   a definitive answer on the uploaded images. Commands are in the chat history;
   export with `sqlite3 -readonly … ".backup"`, or on a box without the `sqlite3`
   binary, `bun`'s `Database(..., {readonly:true}).serialize()`. Both were tested
   and both preserve hashes exactly.
2. **Studio REST API** (`/api/tables/*`) — a ~27 KB JSON dump of all 8 tables.
   Works without a shell, but yields JSON rather than a `.db`.

Also grab, before anything else: **Deployment → Environment → Backend →
`BETTER_AUTH_SECRET`** (eye icon). One click, and it is the single value that
cannot be reconstructed from anything else.

Do not start anything below until that data is safely on your computer.

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
bunx prisma migrate deploy    # creates the tables
```

**Then pick the importer that matches what you exported:**

| You have | Run |
| --- | --- |
| `production.db` (via SSH) | `bun scripts/migrate-sqlite-to-postgres.ts /path/to/production.db` |
| `…-export.json` (via studio REST) | `bun scripts/import-json-export.ts /path/to/export.json` |

Prefer the `.db` route — that script is the more heavily tested of the two.

The importer checks what it loaded against the row counts the studio reported and
refuses to declare success on a mismatch:

| Table | Production rows |
| --- | --- |
| Company | 5 |
| User | 7 |
| Account | 7 |
| Session | 35 |
| Lead | 1 |
| RepairSettings | 3 |
| RepairPrice | 22 |
| Verification | 0 |

The data script keeps the original IDs and the password hashes, so **existing
logins keep working** — no password resets, and anyone currently signed in stays
signed in. Both scripts are safe to run more than once.

This has been tested for real, not just written: the script was run against a live
Postgres using the actual SQLite database from the project, and every password
hash came across byte-identical, every session token was preserved, timestamps
converted correctly, and a second run produced no duplicates. See "Tested" below.

Check **Supabase → Table Editor**: companies, users and leads should match the old
counts.

## The uploaded images: broken on Vibecode, status on disk unknown

Three branding files are referenced in the production database:

```
cmrwhk9sa0000pn550sm337gd-logo-1784749151109.jpg
cmrwhk9sa0000pn550sm337gd-hero-1784749219382.jpg
cmrwhzmyx0000pn559ojbkz0m-logo-1784750038515.jpg
```

Over HTTP all three return a 3869-byte HTML page instead of an image. It is
tempting to conclude the files are gone. **They may not be** — the evidence says
something different:

| Path | Status | Type | `Server` header |
| --- | --- | --- | --- |
| `/api/garage/catalog` | 200 | json | *(none — Hono)* |
| `/api/nope` | 404 | text | *(none — Hono)* |
| `/uploads/<real file>` | 200 | html, 3869 B | **Caddy** |
| `/uploads/NOPE-12345.jpg` | 200 | html, 3869 B | **Caddy** |
| `/totally-fake-page` | 200 | html, 3869 B | **Caddy** |

A real upload and a nonsense filename return byte-identical responses, both
stamped by Caddy, while backend routes carry no server header. Vibecode's proxy
sends `/api/*` to Hono and everything else to the static host, which falls back to
the SPA shell. `/uploads/*` therefore **never reaches** the backend's
`/uploads/:filename` handler, so HTTP says nothing about whether the files exist.

Two consequences:

1. **Those images have been broken in production all along**, for proxy reasons —
   not because of this migration.
2. **This deployment fixes that**, because the API serves everything itself and
   `/uploads/:filename` (index.ts line 110) is registered ahead of the SPA
   catch-all (line 153). Hono matches in registration order, so the route wins —
   *provided the files are recovered*.

Only `ls` on the production server settles whether they're on disk. If they are,
copy them into the `branding` bucket with `scripts/upload-legacy-images.ts`. If
they aren't, **A Rated Garage Doors** and **941 Garage Door** need their logo and
hero re-uploaded after cutover. The other three companies use externally hosted
images and are unaffected either way.

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

> Per-tenant snippets, links and tick-boxes are in **[CUTOVER.md](CUTOVER.md)**.

**Do this while Vibecode is still running**, so both work at once.

Every widget already on a customer's website points at
`https://newdoor.vibecode.run/embed.js`. When Vibecode shuts off, those widgets
break — even though the app is running fine at the new address. `vibecode.run`
isn't yours, so it can't be redirected.

There are five tenants and **none has a vanity slug**, so each embed keys off the
raw company id. The per-tenant snippets are in [CUTOVER.md](CUTOVER.md); the shape is:

```html
<script src="https://www.seemygd.com/embed.js" data-slug="<company-id>" defer></script>
```

No tenant has a custom domain, so there is no tenant DNS to re-point. The only
custom hostname in play is the deployment's own `visualizer.941garagedoor.com`.

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

## If the deploy crash-loops

**Symptom:** the service restarts over and over, log ends with
`BetterAuthError: You are using the default secret.`

**Cause:** `BETTER_AUTH_SECRET` is not set. Better Auth refuses to run in
production without it. Set it — to the *existing* value from Vibecode — and
redeploy. This is the single most likely deploy failure; it's been reproduced
here deliberately.

## Tested

The migration path was rehearsed end to end against a real PostgreSQL 16 server,
using the actual SQLite database that came with the project:

| Check | Result |
| --- | --- |
| `prisma migrate deploy` on an empty Postgres | 8 tables, 7 unique indexes, 6 foreign keys created |
| Data import (Company / User / Account / Session) | 35/35 rows copied, 0 failures |
| Password hashes | all byte-identical, 161/161 chars — **logins survive** |
| Session tokens | 28/28 preserved — **signed-in users stay signed in** |
| Timestamps (SQLite epoch-ms → Postgres) | correct, e.g. `1784749471061` → `2026-07-22 19:44:31.061` |
| Booleans, company name, slug, flags | match exactly |
| Re-running the import | no duplicates — counts unchanged |
| App booted against the migrated Postgres | `/health` ok, branding endpoint served the real company, **zero startup errors** |

The **Docker image and JSON import path** were then proven the same way:

| Check | Result |
| --- | --- |
| `docker build` of the production image | succeeds, 1.06GB |
| JSON importer against real Postgres | all rows copied, hashes byte-identical, 28/28 session tokens kept |
| ISO-date and epoch-ms handling in JSON | both convert correctly |
| Row-count guard fed the wrong data | correctly refused: `Import did NOT match expectations` |
| Container boots, runs migrations, serves | `/health`, `/`, `/dashboard`, `/embed.js` all correct, JSON 404 for unknown API, real company branding served, **zero errors** |
| Container without `BETTER_AUTH_SECRET` | crash-loops with a clear error (see above) |

Two real deploy-blocking bugs were found and fixed this way, both of which would
have failed identically on Render:

1. The frontend imports shared Zod schemas from `backend/src/types`, which the
   build stage did not copy — `Could not resolve ../../../backend/src/types`.
2. That file imports `zod`, resolved from `/app/backend`, so the backend's
   dependencies had to be installed in the build stage too.

A `.dockerignore` was also added: the build was shipping 144MB of context,
dragging host `node_modules` over the container's and baking any local `.env`
into the image. Context is now 14MB.

**Still unproven:** the run against your actual production export and a real
Supabase instance. Mechanics are proven; your specific data is not. Step 2's
row-count check is what confirms it.
