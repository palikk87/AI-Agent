# SeeMyGD workspace

Garage door visualizer SaaS. Companies sign up, get a branded embed for their own
site, and the embed backlinks here. Self-hosted on Render + Supabase since the
migration off the original build platform — see MIGRATION.md and CUTOVER.md.

This workspace contains a web app and backend server.

<projects>
  webapp/    — React app (port 8000, environment variable VITE_BASE_URL)
  backend/   — Hono API server (port 3000)

  In production, the webapp uses relative URLs (/api/...) so it works on any domain.
  VITE_BACKEND_URL is only needed in development for cross-origin requests to the backend on a different port.

  Set `baseURL: env.BACKEND_URL` in betterAuth() config (required for crossSubDomainCookies, harmless otherwise —
  proxy headers override via trustedProxyHeaders: true).
  The webapp auth client (createAuthClient) should use: baseURL: import.meta.env.VITE_BACKEND_URL || undefined
  The webapp API helper should use: import.meta.env.VITE_BACKEND_URL || "" (empty string = relative URLs)
</projects>

<agents>
  Use subagents for project-specific work:
  - backend-developer: Changes to the backend API
  - webapp-developer: Changes to the webapp frontend

  Each agent reads its project's CLAUDE.md for detailed instructions.
</agents>

<coordination>
  When a feature needs both frontend and backend:
  1. Define Zod schemas for request/response in backend/src/types.ts (shared contracts)
  2. Implement backend route using the schemas
  3. Test backend with cURL (use $BACKEND_URL, never localhost)
  4. Implement frontend, importing schemas from backend/src/types.ts to parse responses
  5. Test the integration

  <shared_types>
    All API contracts live in backend/src/types.ts as Zod schemas.
    Both backend and frontend can import from this file — single source of truth.
  </shared_types>
</coordination>

<skills>
  Shared skills in .claude/skills/:
  - database-auth: Set up Prisma + Better Auth for user accounts and data persistence
  - ai-apis-like-chatgpt: Use this skill when the user asks you to make an app that requires an AI API.

  Frontend only skills:
  - frontend-app-design: Create distinctive, production-grade web interfaces using React, Tailwind, and shadcn/ui. Use when building pages, components, or styling any web UI.
</skills>

<environment>
  Self-hosted. You DO manage git here: commit and push your own work.
  Production is Render (Docker, autoDeploy on commit) with Supabase Postgres and
  Supabase Storage. `render.yaml` is the blueprint.

  The tracked branch is `claude/seemygd-garage-door-tool-2dg3dw`, NOT main.
  Pushing to main deploys nothing and reports nothing. render.yaml pins no
  branch, so it reads as though main ships — the dashboard overrides it. See the
  comment at the top of render.yaml before changing anything about deploys.

  Hosts, which are not yet the same thing:
  - seemygd.com / www.seemygd.com — currently the Lovable landing page
  - seemygd.onrender.com — this app: /signup, /login, /dashboard, /v/<companyId>,
    /embed.js. Customer embeds point here.
  Do not assume seemygd.com serves this app; /embed.js there returns 404 today.

  Write one-off scripts to achieve tasks. Verify against the live service rather
  than assuming — a swap can look fine in code and be wrong in production.
  Be concise and don't talk too much.
</environment>
