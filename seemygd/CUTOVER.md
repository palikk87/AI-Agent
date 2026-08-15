# Cutover checklist — moving traffic to www.seemygd.com

Run this **while Vibecode is still up**, so both hosts serve at once and nothing
has a gap. Tick each row only after you've seen it work in a browser.

---

## The tenants

Five companies in production. **None has a vanity slug, custom domain, custom
subdomain, or individual URL enabled** — so there is no tenant DNS to re-point,
and every embed keys off the raw company id.

| # | Business | Company id | Tier | Subscription |
| --- | --- | --- | --- | --- |
| 1 | A Rated Garage Doors | `cmrwhk9sa0000pn550sm337gd` | free | active |
| 2 | 941 Garage Door | `cmrwhzmyx0000pn559ojbkz0m` | free | active |
| 3 | Grandview Garage Doors | `cmrxgkukk0001pn55j3zp10j4` | free | active |
| 4 | Garage door service and repair | `cmrxw0qv30006pn55heou2rtq` | free | active |
| 5 | Grateful garage doors | `cmryenll80007pn55bn2bzjcv` | free | active |

> Confirm the id↔name pairing against the export before editing anyone's site —
> it comes from two separate lists in the studio readout, not one joined table.
> `GET /api/companies/<id>/branding` returns the business name and settles it.

Why ids work as slugs: `embed.js` turns `data-slug` into `/v/<value>` (line 50),
and the branding lookup matches `OR: [{ id }, { vanitySlug }]`
(`routes/companies.ts` line 165).

---

## 1. Each tenant's direct link

| Business | New visualizer URL |
| --- | --- |
| A Rated Garage Doors | `https://www.seemygd.com/v/cmrwhk9sa0000pn550sm337gd` |
| 941 Garage Door | `https://www.seemygd.com/v/cmrwhzmyx0000pn559ojbkz0m` |
| Grandview Garage Doors | `https://www.seemygd.com/v/cmrxgkukk0001pn55j3zp10j4` |
| Garage door service and repair | `https://www.seemygd.com/v/cmrxw0qv30006pn55heou2rtq` |
| Grateful garage doors | `https://www.seemygd.com/v/cmryenll80007pn55bn2bzjcv` |

Open all five. Each should show that business's name, colour and phone.

## 2. Replace the embed snippet on each customer's website — **DONE**

Both sites we host are migrated and published, verified live:

| Site | Embed host now | Verified |
| --- | --- | --- |
| 941garagedoor.com (`/visualizer`) | `https://seemygd.onrender.com/embed.js` | swap completed in 33s |
| A Rated Garage Doors | `https://seemygd.onrender.com/embed.js` | swap completed in 27s |

Both previously loaded `embed.js` from the old host, which is an alias of the
platform we left. The widget derives its API origin from its own `<script src>`,
so it kept calling that host and would have died with it. That domain is not
ours and cannot be redirected, which is why the snippet itself had to change.

**The host below is deliberately the Render URL, not www.seemygd.com.** That
domain currently serves the Lovable landing page, so `www.seemygd.com/embed.js`
returns 404 — pasting the "obvious" URL breaks the widget immediately instead of
later. Switch these to `www.seemygd.com` only once that domain serves this app.

```html
<!-- A Rated Garage Doors -->
<script src="https://seemygd.onrender.com/embed.js" data-slug="cmrwhk9sa0000pn550sm337gd" defer></script>

<!-- 941 Garage Door -->
<script src="https://seemygd.onrender.com/embed.js" data-slug="cmrwhzmyx0000pn559ojbkz0m" defer></script>

<!-- Grandview Garage Doors -->
<script src="https://seemygd.onrender.com/embed.js" data-slug="cmrxgkukk0001pn55j3zp10j4" defer></script>

<!-- Garage door service and repair -->
<script src="https://seemygd.onrender.com/embed.js" data-slug="cmrxw0qv30006pn55heou2rtq" defer></script>

<!-- Grateful garage doors -->
<script src="https://seemygd.onrender.com/embed.js" data-slug="cmryenll80007pn55bn2bzjcv" defer></script>
```

Optional attributes: `data-label` (button text), `data-color` (accent),
`data-float="false"` to suppress the floating button and bind to your own
`[data-doorviz]` element instead.

Owners who copy their snippet from the dashboard get the correct host
automatically — it's built from wherever the app is running.

### The three tenants we do not host — scanned, and mostly a non-issue

Their sites were scanned for `embed.js`, `data-slug`, `doorviz` and any seemygd
reference, across every URL in each site's own sitemap:

| Tenant | Site | Finding |
| --- | --- | --- |
| Garage door service and repair | gdsutah.com (SpotOn) | **never installed it** — 0 markers across all 7 sitemap pages |
| Grateful garage doors | wefixgaragedoors.pro (Duda) | **never installed it** — 0 markers across all 5 sitemap pages |
| Grandview Garage Doors | grandviewgaragedoors.com | **never installed it** — confirmed from a real browser: no embed.js, no doorviz, no seemygd, no old-host reference, and zero `[data-doorviz]` elements in either the 230KB served HTML or the rendered DOM |

So the exposure from tenants we cannot edit is **zero**. All three signed up and
never put the tool on their site, so none of them carries a dependency on the
old host and none needs a cutover step. **Step 2 is closed** — the only installs
that ever existed were 941 and A Rated, and both now load from Render.

Grandview took a browser to settle: its host answers automated requests with a
captcha, so a scan from a sandbox reads identically to an empty site. Worth
remembering the next time a scan reports "nothing found" on a protected host.

Note: A Rated Garage Doors has no `websiteUrl` set on its company record. Its
real domain is **aratedgd.com** — recorded here so the value is not lost. Not
applied: this is a data-quality fix, deliberately parked, and nobody should be
editing tenant records as a side effect of a cutover.

## Parked — known, deliberately not fixed here

**Cold-start makes the widget inert on first click.** `embed.js` is deferred and
served from an instance that spins down, so on a cold hit a visitor can press
"Visualize My Door" for several seconds and get nothing at all. Observed on a
real tenant site: first attempt inert, second attempt fine. That is a conversion
and credibility problem on customer sites, not a cosmetic one, and it wants a
real fix (keeping the instance warm, or making the button show progress and
survive a slow script) rather than a workaround. Left open on purpose.

## 3. `visualizer.941garagedoor.com`

This is the only custom hostname in play, and it belongs to the deployment rather
than to a tenant row. It still resolves to the old platform, but nothing we host
loads from it any more — both embeds now point at Render — so it is dead weight
rather than a live dependency. Re-point its CNAME at Render or retire it in
favour of the `/v/...` link above. Its SEO tags already move to
`www.seemygd.com` in this repo.

## 4. Square

Set the webhook to `https://www.seemygd.com/api/square/webhook`. Signatures are
verified against `BACKEND_URL`, so the two must match exactly.

Also outstanding: `SQUARE_ENVIRONMENT` is `sandbox` and
`SQUARE_WEBHOOK_SIGNATURE_KEY` is empty, so no real money moves and signatures
aren't checked. Change both when you're ready to bill.

## 5. Environment differences to watch

Production currently has no `DATABASE_URL` at all — the old start script derived
`file:/data/production.db` at boot. On Render you set it explicitly to Supabase.

Neither environment has `FRONTEND_URL`; you're adding it fresh. `render.yaml`
already sets it alongside `BACKEND_URL`.

## 6. Final checks before switching Vibecode off

- [ ] Log in with an **existing** owner account — proves the data migrated
- [ ] Generate a door from a photo — proves the OpenAI key
- [ ] Upload a logo in the dashboard — proves Supabase Storage
- [ ] All five `/v/<id>` pages show correct branding
- [ ] Submit a repair estimate — proves leads + Resend alerts
- [ ] The new embed works on a real customer page
- [ ] Row counts in Supabase match: Company 5, User 7, Account 7, Session 35, Lead 1, RepairSettings 3, RepairPrice 22

Only when every box is ticked: shut Vibecode down. Keep the exported database
forever.
