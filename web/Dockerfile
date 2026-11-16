# Production image for the Deadly Drops site: Next.js standalone server on Node.
# Built on the VPS by deploy/vps/deploy.sh (docker compose build web).
# Debian slim, not Alpine: Next's prebuilt SWC binaries and npm optional deps target glibc.

FROM node:24-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies (dev deps included: the build needs TypeScript; the runner copies none of them)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the bundle at build time
ARG NEXT_PUBLIC_SITE_URL=https://ddptournament.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=80 \
    HOSTNAME=0.0.0.0 \
    CONTENT_DIR=/data \
    MIGRATIONS_DIR=/app/drizzle
# /data is the uploads volume; in compose it is a bind mount that deploy.sh chowns to uid 1000 (node)
RUN mkdir -p /data/uploads && chown -R node:node /data
# The app dir stays writable by node: Next writes its cache under .next/cache at runtime
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# SQL migrations, applied at server start by src/instrumentation.ts
COPY --from=build --chown=node:node /app/drizzle ./drizzle
USER node
# Port 80 as non-root works because compose sets net.ipv4.ip_unprivileged_port_start=0
EXPOSE 80
# robots.txt is prerendered and needs no database; slim has no curl, so use Node's fetch
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||80)+'/robots.txt').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.js"]
