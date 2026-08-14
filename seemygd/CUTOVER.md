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

## 2. Replace the embed snippet on each customer's website

Anything already installed points at `https://newdoor.vibecode.run/embed.js` and
**stops working the moment Vibecode goes dark** — the widget derives its origin
from its own `<script src>`, so it keeps calling the old host. `vibecode.run` is
not yours, so it cannot be redirected. This step is the one that protects users.

Paste before `</body>`, swapping in the right id:

```html
<!-- A Rated Garage Doors -->
<script src="https://www.seemygd.com/embed.js" data-slug="cmrwhk9sa0000pn550sm337gd" defer></script>

<!-- 941 Garage Door -->
<script src="https://www.seemygd.com/embed.js" data-slug="cmrwhzmyx0000pn559ojbkz0m" defer></script>

<!-- Grandview Garage Doors -->
<script src="https://www.seemygd.com/embed.js" data-slug="cmrxgkukk0001pn55j3zp10j4" defer></script>

<!-- Garage door service and repair -->
<script src="https://www.seemygd.com/embed.js" data-slug="cmrxw0qv30006pn55heou2rtq" defer></script>

<!-- Grateful garage doors -->
<script src="https://www.seemygd.com/embed.js" data-slug="cmryenll80007pn55bn2bzjcv" defer></script>
```

Optional attributes: `data-label` (button text), `data-color` (accent),
`data-float="false"` to suppress the floating button and bind to your own
`[data-doorviz]` element instead.

Owners who copy their snippet from the dashboard get the correct host
automatically — it's built from wherever the app is running.

## 3. `visualizer.941garagedoor.com`

This is the only custom hostname in play, and it belongs to the deployment rather
than to a tenant row. Re-point its CNAME at Render, or retire it in favour of the
`/v/...` link above. Its SEO tags already move to `www.seemygd.com` in this repo.

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
