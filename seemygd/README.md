# SeeMyGD — AI Garage Door Visualizer

**Live: [seemygd.com](https://seemygd.com)** — a multi-tenant digital garage door tool that garage
door companies embed on their own sites (formerly "Doorframe" / "DoorViz Pro"; both names still
appear in older strings).

Upload a photo of your home and instantly preview real garage door styles from the leading U.S. manufacturers. The AI replaces only the garage door — keeping the rest of the house, sky, driveway, and lighting exactly the same.

> **Migrating off Vibecode? Read [MIGRATION.md](MIGRATION.md).** It's the step-by-step runbook for
> moving to Supabase Postgres with Better Auth and existing logins intact.
>
> **Setup:** copy `backend/.env.example` → `backend/.env` and `webapp/.env.example` → `webapp/.env`,
> fill in the real values, then `bun install && bunx prisma migrate deploy && bun src/index.ts` in
> `backend/`. Real `.env` files, the database, and `node_modules` are intentionally not in git.

## Stack

| Layer | Runs on |
| --- | --- |
| Code | GitHub |
| Database | Supabase Postgres (via Prisma) |
| Auth | Better Auth (email + password) |
| Storage | Supabase Storage — company logos & hero banners |
| AI | OpenAI `gpt-image-1` |
| Payments | Square subscriptions |
| Email | Resend |
| Domain | seemygd.com on Lovable, embedding the tool |

The API also serves the built frontend, so the whole tool deploys as a single service
on one origin — which keeps the frontend's relative `/api/...` calls and same-origin
auth cookies working exactly as before.

## Features

- **Photo upload or camera capture** — drag & drop, file picker, or live camera
- **Curated real-brand catalog** — signature styles from Clopay, C.H.I., Amarr, Wayne Dalton, Haas
- **Style picker** — filter by manufacturer, browse 17 signature doors across modern, carriage, traditional, and contemporary categories
- **AI photorealistic swap** — OpenAI `gpt-image-1` image edit with a constrained prompt that keeps the rest of the house unchanged
- **Before / after slider** — drag to compare your original photo against the new door
- **Share & download** — save the preview or share it via the native share sheet

## Architecture

| Layer | Stack |
| --- | --- |
| Frontend | React 18, Vite, Tailwind v3, shadcn/ui, React Query, Sonner toasts |
| Backend | Bun runtime, Hono, Zod validation |
| AI | OpenAI `gpt-image-1` (images/edits endpoint) via the Vibecode proxy |

### Endpoints

- `GET  /api/garage/catalog` — returns the list of manufacturers + curated styles
- `POST /api/garage/swap` — multipart: `image` (File) + `styleId` (string) → `{ imageBase64, styleId, generatedAt }`
- `GET  /api/companies/:idOrSlug/branding` — public branding; the param accepts a company id **or** its vanity slug
- `GET  /api/companies/slug-available?slug=` — (auth) check whether a vanity slug is free
- `PUT  /api/companies/me` — (auth) update branding, `vanitySlug`, and `customDomain` (Growth only)
- `GET  /api/companies/preview-branding?site=&expires=&sig=` — **public, admin-generated preview.** Validates a signed, self-expiring token, scrapes the given site's branding live, and returns it shaped like `/branding` with `subscriptionStatus: "active"`. Nothing is stored; after `expires` it returns 410.
- `POST /api/admin/preview-url` — (admin) generate an admin-only sales preview link for a prospect's website: `/preview?site=<host>&expires=<epochMs>&sig=<hmac>`, valid 48h. Clients cannot reach this route.
- `POST /api/companies/me/upload-image` — (auth) upload a `logo` or `hero` image. **Hero (background) photos are automatically re-rendered by `gpt-image-1` at a clean 1536×1024 banner ratio with sharpened resolution & clarity** so they don't look stretched/blurry when scaled to `cover` the visualizer banner. Falls back to the original if AI is unavailable.

## Repair Estimator (second tool)

Alongside the Door Visualizer, tenants get a **Repair Estimator**. The branded page shows a
segmented toggle — **"Design a New Door" / "Estimate a Repair"** (`?tool=repair`) — and both tools
use the same per-tenant branding (color, logo, name, phone).

The estimator is built for homeowners with zero technical knowledge:

1. **Dummy-proof door info** (`DoorInfoWizard`) — four big-button questions (no dropdowns): width
   (1-Car / 2-Car), height (Standard 7ft / Extra-tall 8ft+), insulation (Hollow / Vinyl-back /
   Steel-back), and spring type (Torsion above the door vs Extension on the sides, with SVG diagrams).
2. **Interactive diagram** (`GarageDoorDiagram`) — a clean SVG cutaway of the door's inside with
   clickable, glowing hotspots for Springs, Cables, Rollers, Hinges, Panels, and the Opener. Springs
   are drawn in the position the homeowner selected.
3. **Repair cart** (`RepairPanel` + `EstimateCart`) — clicking a part opens a side panel of
   plain-English repairs with checkboxes + tooltips; picks flow into a sticky "Estimate Summary".
4. **Dynamic pricing** — each repair's price updates from the door answers. A heavier door (Steel-back
   2-Car) costs more than a light one (Hollow 1-Car). A permanent disclaimer sits under the total, and
   a **Request Service** button submits the estimate as a lead.

### Repair pricing (business owner)

- Prices are per-company. The owner sets them in the dashboard **Repair Pricing** section: a **base
  price** per repair (for the baseline 1-Car / Standard / Hollow door) plus four **multipliers**
  (2-Car, Extra-tall, Vinyl, Steel) and an optional flat service-call fee. A live example table shows
  how those numbers translate to customer-facing prices (e.g. Hollow 1-Car Spring vs Steel-back 2-Car Spring).
- Shared math lives in `backend/src/types.ts`: `REPAIR_CATALOG`, `REPAIR_PARTS`,
  `computeRepairPrice()`, `effectiveRepairPrices()`, and the default prices/multipliers — imported by
  both the estimator, the dashboard preview, and the API so the numbers can never drift.

### Repair endpoints

- `GET  /api/repair/:idOrSlug/pricing` — public effective pricing (base prices merged with catalog
  defaults + multipliers) for the estimator.
- `GET  /api/repair/settings` — (auth) the owner's current pricing config.
- `PUT  /api/repair/settings` — (auth) update multipliers + per-repair base prices.
- `POST /api/leads` — repair requests reuse the leads pipeline with `serviceType:"repair"`,
  `estimateTotal`, and a `repairSummary`; they appear in the same Leads dashboard and email alerts.

Data model: `RepairSettings` (1:1 with `Company`, holds multipliers + fee) → `RepairPrice` rows
(one per repair key). `Lead` gained `serviceType`, `estimateTotal`, `repairSummary`.

## Distribution & embedding

Subscribers share their branded visualizer in three ways. Access is gated by the
Square subscription (`subscriptionStatus === "active"`) and split across tiers:

| Feature | Starter ($49/mo) | Growth ($99/mo) |
| --- | :---: | :---: |
| **Vanity slug** — clean `/v/your-company` URL (editable in the dashboard, unique) | ✓ | ✓ |
| **Popup button** — one-line `embed.js` snippet that opens the visualizer in a modal | ✓ | ✓ |
| **Inline iframe** — raw `<iframe>` to embed natively in a page | — | ✓ |
| **Custom domain** — serve the visualizer at `visualizer.theircompany.com` (CNAME) | — | ✓ |
| **"Powered by DoorViz Pro" badge** | shown | stripped (white-label) |

- **Vanity slugs** resolve via the branding endpoint (`OR: [{ id }, { vanitySlug }]`), so
  `/v/:companyId` works with either an id or a slug — no routing changes needed.
- **Popup widget** lives at `webapp/public/embed.js`. The snippet is
  `<script src="https://app/embed.js" data-slug="your-company" defer></script>`. It derives
  its origin from the script tag, then injects a floating "Visualize My Door" button (or binds
  to any `[data-doorviz]` element) that opens an iframe modal.
- **Custom domains** are matched by hostname in `GET /api/companies/resolve-by-host`, rendering
  the visualizer at the domain root (see `webapp/src/pages/Root.tsx`).

### Individualized URL vs. embed-only (grandfathering)

`Company.individualUrlEnabled` controls whether a client sees their individualized
`/v/:slug` URL in the dashboard. All clients that existed before this flag were
grandfathered **on**; new clients default **off** and only get the popup embed
code (the vanity-slug card, the sidebar URL, the shareable URL row and the inline
iframe are all hidden for them). The public `/v/:slug` route itself is unchanged,
so grandfathered links keep working.

### Admin-only URL Preview Generator

The admin panel (`/admin` → Overview) has a **URL Preview Generator**: enter a
prospect's website and it produces a shareable `/preview?site=…&expires=…&sig=…`
link. The `/preview` page reuses the visualizer in a read-only "preview" mode
(`webapp/src/pages/Preview.tsx`), scraping the site's branding live via the signed
token. Links are HMAC-signed (`backend/src/preview-token.ts`), self-expire after
48h, and store nothing. For sales/demo use only — clients can't generate or see them.

### SEO & metadata

The visualizer is multi-tenant, so SEO is **per-company at runtime**:

- `webapp/src/lib/seo.ts` — `setDocumentHead()` rewrites `<title>`, description, canonical,
  Open Graph / Twitter tags, `theme-color`, and injects `application/ld+json` schema. Idempotent
  (managed tags carry `data-seo-managed`), so switching tenants never stacks stale schema.
- `webapp/src/hooks/useDocumentHead.ts` — declarative React wrapper.
- **Per-company** (`Visualizer.tsx`): when a subscriber's customer lands on the branded visualizer
  (custom domain or `/v/:slug`), the page carries THAT business's name, phone, brand color, hero/logo
  share image, and `HomeAndConstructionBusiness` + `WebApplication` JSON-LD — so it reinforces their
  brand and can rank for their own name.
- **Static defaults** (`index.html`): canonical, robots (`max-image-preview:large`), `theme-color`,
  apple-touch-icon, a lighter `og-thumbnail.jpg` share image, video card, and a baseline
  `WebApplication` schema for non-JS scrapers (social scrapers don't run JS).
- `public/robots.txt` references `public/sitemap.xml`.

> Per-company OG tags help Google (which renders JS); social-share previews fall back to the static
> tags in `index.html` since those scrapers don't execute JavaScript.

### Legal

- `webapp/src/pages/Legal.tsx` (route `/legal`) — a brand-neutral **Disclaimer & Privacy Policy** that
  disclaims liability for the AI-generated visualizations (illustrative approximations, no warranty,
  limitation of liability, indemnification) and describes how uploaded photos are handled. Linked from
  every footer (homepage + visualizer + custom domains), with a short inline disclaimer line in each footer.

### Shared types

All API contracts live in `backend/src/types.ts` as Zod schemas. The frontend imports the same TypeScript types from there — single source of truth.

## Project layout

```
backend/
  src/
    index.ts             — Hono app, CORS, route mounting
    types.ts             — Zod schemas + catalog data (manufacturers + styles)
    routes/
      garage.ts          — /api/garage/catalog & /swap
webapp/
  src/
    pages/Index.tsx      — main page
    components/garage/
      Hero.tsx           — header + value prop
      PhotoUploader.tsx  — upload / camera / drag-drop
      StylePicker.tsx    — manufacturer tabs + style grid
      BeforeAfter.tsx    — draggable before/after slider
      ResultViewer.tsx   — generated result + share/download
    lib/garage-api.ts    — typed client for the garage endpoints
    index.css            — Fraunces + Manrope, warm bone-white theme
```

## Design system

Matched to [941garagedoor.com](https://941garagedoor.com):

- Background: cool near-white (`#fafcfe`)
- Primary: deep navy (`#091f3b`)
- Accent: bold orange (`#ff7716`) — used for primary CTAs
- Display font: Fraunces (variable serif)
- Body font: Manrope
- Contact phone: (941) 404-7235
