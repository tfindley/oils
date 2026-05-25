# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1

# Build — DATABASE_URL is not needed at build time (standalone output)
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npm run build

# Compile seed and enrich scripts to plain JS so they can run inside the container without tsx
RUN ./node_modules/.bin/esbuild scripts/seed.ts \
    --bundle --platform=node --format=cjs \
    --outfile=scripts/seed.js \
    --external:@prisma/client \
    --external:@prisma/adapter-pg \
    --external:pg

RUN ./node_modules/.bin/esbuild scripts/enrich-oils.ts \
    --bundle --platform=node --format=cjs \
    --outfile=scripts/enrich.js \
    --external:@prisma/client \
    --external:@prisma/adapter-pg \
    --external:pg

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat && apk upgrade --no-cache
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Prisma schema and migrations (read by scripts/migrate.js at startup)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma client binaries (runtime query engine)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# pg and its full transitive dependency tree (required by migrate.js, seed.js, enrich.js)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg ./node_modules/pg
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-pool ./node_modules/pg-pool
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-protocol ./node_modules/pg-protocol
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-types ./node_modules/pg-types
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-connection-string ./node_modules/pg-connection-string
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-int8 ./node_modules/pg-int8
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-cloudflare ./node_modules/pg-cloudflare
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pgpass ./node_modules/pgpass
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-array ./node_modules/postgres-array
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-bytea ./node_modules/postgres-bytea
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-date ./node_modules/postgres-date
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-interval ./node_modules/postgres-interval
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/adapter-pg ./node_modules/@prisma/adapter-pg

# Lightweight migration runner, seed, and enrichment scripts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.js ./scripts/migrate.js
COPY --from=builder --chown=nextjs:nodejs /app/scripts/seed.js ./scripts/seed.js
COPY --from=builder --chown=nextjs:nodejs /app/scripts/enrich.js ./scripts/enrich.js

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./docker-entrypoint.sh"]
