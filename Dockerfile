FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd -r nextwiki && useradd -r -g nextwiki nextwiki
COPY --from=builder /app ./
RUN mkdir -p /app/media /app/backups /app/.next/standalone/.next && \
    cp -R /app/public /app/.next/standalone/public && \
    cp -R /app/.next/static /app/.next/standalone/.next/static && \
    chown -R nextwiki:nextwiki /app
USER nextwiki
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "if [ -z \"$NEXTWIKI_SECRET\" ]; then export NEXTWIKI_SECRET=$(node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"); echo 'NEXTWIKI_SECRET was not set; generated an ephemeral runtime secret. Set a persistent secret for production.'; fi; node node_modules/tsx/dist/cli.mjs scripts/migrate.ts && HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js"]
