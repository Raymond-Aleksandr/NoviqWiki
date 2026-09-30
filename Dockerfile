FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS production-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd -r noviqwiki && useradd -r -g noviqwiki noviqwiki
COPY --from=production-deps --chown=noviqwiki:noviqwiki /app/node_modules ./node_modules
COPY --from=builder --chown=noviqwiki:noviqwiki /app/.next/standalone ./
COPY --from=builder --chown=noviqwiki:noviqwiki /app/.next/static ./.next/static
COPY --from=builder --chown=noviqwiki:noviqwiki /app/drizzle ./drizzle
COPY --from=builder --chown=noviqwiki:noviqwiki /app/scripts/migrate.mjs ./scripts/migrate.mjs
RUN mkdir -p /app/media /app/backups && chown -R noviqwiki:noviqwiki /app/media /app/backups
USER noviqwiki
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node scripts/migrate.mjs && HOSTNAME=0.0.0.0 PORT=3000 node server.js"]
