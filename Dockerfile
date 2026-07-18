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
RUN mkdir -p /app/media /app/backups /app/secrets /app/.next/standalone/.next && \
    if [ -d /app/public ]; then cp -R /app/public /app/.next/standalone/public; fi && \
    cp -R /app/.next/static /app/.next/standalone/.next/static && \
    chown -R nextwiki:nextwiki /app
USER nextwiki
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "scripts/start-container.sh"]
