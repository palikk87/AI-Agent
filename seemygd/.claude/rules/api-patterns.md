# API Contract Patterns

Shared conventions for API communication between backend and frontend.

<api_contracts>
  ALL app routes return { data: ... }. Client auto-unwraps.

  Backend: c.json({ data: posts })
  Frontend: api.get<Post[]>()  // Returns Post[], not { data: Post[] }

  Exceptions (no envelope):
  - /api/auth/* (Better Auth owns response)
  - 204 No Content
  - Non-JSON (use api.raw())

  Done gate: typecheck + e2e flow must pass before task complete.
</api_contracts>

<response_envelope>
  All app routes: c.json({ data: value })
  Errors: c.json({ error: { message, code } }, 4xx)

  cURL test: curl $BACKEND_URL/api/posts → { "data": [...] }
</response_envelope>

<auth_cors>
  Better Auth trustedOrigins (string wildcards). The live list is
  STATIC_TRUSTED_ORIGINS in backend/src/auth.ts — edit it there, not here:
  ["http://localhost:*", "http://127.0.0.1:*", "https://seemygd.com", "https://www.seemygd.com", "https://*.lovable.app", "https://*.lovableproject.com", "https://941garagedoor.com"]

  Tenant custom domains are appended at runtime by resolveTrustedOrigins(), so a
  customer signing in from their own domain is trusted without a code change.
  Extra hosts go in EXTRA_TRUSTED_ORIGINS rather than being hardcoded.

  WRONG: RegExp objects or returning boolean - crashes origin trust.
  RIGHT: String array with * wildcards.

  CORS middleware (separate from trustedOrigins): echo specific origin, not "*".
  Browsers reject "*" with credentials: "include".
</auth_cors>

<prisma_strategy>
  Dev/preview: bunx prisma db push (avoids P3005)
  Production: bunx prisma migrate deploy

  Startup issue: If routes return 404 but health works, Prisma client wasn't generated.
  Fix: bunx prisma generate && restart backend
  The start script auto-runs prisma generate if schema.prisma exists.
</prisma_strategy>

<api_typing>
  Type inner value only:
  ✅ api.get<Post[]>('/api/posts')
  ❌ api.get<{ data: Post[] }>()
  ❌ api.get<{ posts: Post[] }>()

  "Cannot read properties of undefined" = wrong type shape.
</api_typing>
