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
