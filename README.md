# NoviqWiki

A self-hosted wiki built with Next.js, TypeScript, PostgreSQL, and Drizzle ORM.

## Features

- Markdown editing with drafts, publication, and immutable revision history
- Revision comparisons, rollback, wiki links, redirects, and categories
- PostgreSQL full-text search and article watchlists
- Local and S3-compatible media storage
- Users, groups, roles, permissions, and an administration dashboard
- English and Simplified Chinese interfaces with light and dark themes
- A versioned JSON API and container-image release workflow

## Docker setup

Install Docker Engine and Docker Compose, then create the environment file:

```bash
cp .env.example .env
openssl rand -hex 32
```

Configure these values in `.env`:

| Variable | Value |
| --- | --- |
| `POSTGRES_PASSWORD` | Database password. |
| `DATABASE_URL` | PostgreSQL URL using the same credentials; Compose host is `db:5432`. URL-encode reserved characters in the password. |
| `NOVIQWIKI_BASE_URL` | Application URL, such as `http://localhost:3000`. |
| `NOVIQWIKI_SECRET` | Random signing secret. |
| `NOVIQWIKI_SETUP_TOKEN` | Separate random setup token. |

Start the application:

```bash
docker compose up --build -d
```

Open <http://localhost:3000/setup>, enter the setup token, and create the Owner
account. After setup, remove the setup token from `.env` and recreate the app:

```bash
docker compose up -d app
```

The default application address is `127.0.0.1:3000`. PostgreSQL and local media
use persistent Docker volumes.

```bash
docker compose ps
docker compose logs --tail=200 app
```

## Local development

Use Node.js 22+, pnpm 11.7.0, and PostgreSQL 17.

```bash
corepack enable
pnpm install
cp .env.example .env
```

Configure `.env` as above and start the included database:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up -d db
```

For an application running on the host, set:

```dotenv
DATABASE_URL=postgres://noviqwiki:your-password@localhost:5432/noviqwiki
NOVIQWIKI_BASE_URL=http://localhost:3000
NOVIQWIKI_MEDIA_ROOT=media
```

Use the configured database credentials in the URL, then run:

```bash
pnpm db:migrate
pnpm dev
```

Open <http://localhost:3000/setup>. SMTP and S3-compatible storage options are
listed in [.env.example](.env.example).

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server. |
| `pnpm build` | Create the production standalone output. |
| `pnpm typecheck` | Check TypeScript across the application. |
| `pnpm test:frontend` | Run frontend behavior regression tests. |
| `pnpm start` | Serve an existing production build. |
| `pnpm db:generate` | Generate a forward Drizzle migration. |
| `pnpm db:migrate` | Apply migrations. |
| `pnpm db:seed` | Add preset development data. |
| `pnpm search:reindex` | Rebuild the search index. |
| `pnpm backup` | Back up PostgreSQL and local-driver media. |
| `pnpm restore` | Restore a database and optional local-media backup. |
| `pnpm openapi` | Regenerate the [OpenAPI specification](docs/openapi.json). |

## Frontend development

Frontend route files handle authorization and data loading on the server. Views,
client interactions, and their message contracts live in `src/features`; shared
presentation and dialog primitives live in `src/components/ui`. The application
shell uses a request-scoped context for site, session, language, and appearance.
Styles are organized by shared tokens, base rules, components, shell, and feature.

## API and license


The JSON API is available under `/api/v1`. The
[OpenAPI specification](docs/openapi.json) describes its endpoints.

Licensed under [Apache-2.0](LICENSE).

## 简体中文

NoviqWiki 是基于 Next.js、TypeScript 和 PostgreSQL 的自托管 wiki，支持 Markdown
编辑、不可变修订、差异与回滚、全文搜索、媒体管理，以及用户、用户组和角色权限。
界面提供英文和简体中文。

复制 `.env.example` 为 `.env`，配置数据库凭据、站点地址、签名密钥与设置令牌，
然后运行 `docker compose up --build -d`。访问 `/setup` 创建所有者账号。本地开发
和运维命令见上文。
