# SeeMyGD — single-service image (API + built frontend).
#
# Vibecode used to build the webapp and serve it from its own static host while
# proxying /api/* to the Hono server. Off-platform we ship one container: the API
# serves webapp/dist itself, so there is one origin, and the frontend's relative
# "/api/..." calls plus same-origin auth cookies keep working unchanged.

# ---------- stage 1: build the frontend ----------
FROM oven/bun:1 AS webapp-build
WORKDIR /app/webapp

# Install deps first so this layer caches until the lockfile changes.
COPY webapp/package.json webapp/bun.lock ./
RUN bun install --frozen-lockfile

COPY webapp/ ./

# The frontend imports the shared Zod schemas straight out of the backend
# ("../../../backend/src/types" — the single-source-of-truth contract), so the
# backend source must be present at /app/backend for the bundle to resolve.
# Without this the build dies with "Could not resolve ../../../backend/src/types".
#
# types.ts itself imports zod, and node resolution for that lookup starts at
# /app/backend — so the backend's own dependencies must be installed there too,
# from the same lockfile, or the build dies with "Rollup failed to resolve zod".
# This reproduces the local layout (webapp/ and backend/ side by side, each with
# its own node_modules) that the import paths were written against.
COPY backend/package.json backend/bun.lock /app/backend/
RUN cd /app/backend && bun install --frozen-lockfile
COPY backend/src /app/backend/src

RUN bun run vite build --outDir dist

# ---------- stage 2: runtime ----------
FROM oven/bun:1 AS runtime
WORKDIR /app/backend

COPY backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile

COPY backend/ ./

# Generate the Prisma client at build time so boot is fast. This needs no
# database connection — only the schema.
RUN bunx prisma generate

# The API resolves the frontend at ../../webapp/dist relative to src/index.ts,
# which is /app/webapp/dist here.
COPY --from=webapp-build /app/webapp/dist /app/webapp/dist

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Apply any pending migrations, then start. `migrate deploy` only applies
# committed migrations — it never resets or drops data.
CMD ["sh", "-c", "bunx prisma migrate deploy && exec bun src/index.ts"]
