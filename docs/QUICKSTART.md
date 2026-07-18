# NoviqWiki Quickstart

> [English](QUICKSTART.md) | [简体中文](QUICKSTART.md#简体中文)

NoviqWiki is a Next.js App Router application backed by PostgreSQL and Drizzle ORM. Choose one of the two local paths below: run the complete evaluation stack in Docker Compose, or run PostgreSQL in Compose while developing the application on the host.

## Prerequisites

- Docker and Docker Compose for either path.
- Node.js 22 or newer and pnpm 10 or newer for host development. The repository currently pins `pnpm@11.7.0`.
- Available host ports `3000` and `5432` with the committed Compose configuration.

## Option A: Complete Docker Compose Evaluation

This is the shortest path to a working site. From the repository root, generate a secret for this local instance and start both services:

```bash
export NEXTWIKI_SECRET="$(openssl rand -base64 32)"
docker compose up --build -d
```

Check startup:

```bash
docker compose ps
docker compose logs --tail=200 app
```

Open `http://localhost:3000/setup` and complete the setup wizard. The committed image runs Drizzle migrations before starting the application.

The exported secret lasts only for that shell. For a long-lived local evaluation, put the generated value in an untracked `.env` or your deployment secret store. Docker Compose does not automatically read `.env.local`.

The committed Compose definition is not a production security baseline: it uses example PostgreSQL credentials, publishes PostgreSQL on port `5432`, serves HTTP, and uses local named volumes. See [DEPLOYMENT.md](./DEPLOYMENT.md) before an internet-facing deployment.

To stop the containers while preserving data:

```bash
docker compose down
```

Do not add `-v` unless you intentionally want to delete the database, media, and backup volumes.

## Option B: Host Development with Compose PostgreSQL

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d db
```

Confirm that the service is healthy:

```bash
docker compose ps db
docker compose logs --tail=100 db
```

### 3. Configure the Host Application

Create the Next.js local file:

```bash
cp .env.example .env.local
```

Edit the container-oriented values so the host process can reach them:

```bash
DATABASE_URL=postgres://nextwiki:nextwiki@localhost:5432/nextwiki
NEXTWIKI_BASE_URL=http://localhost:3000
NEXTWIKI_SECRET=replace-with-a-long-random-development-secret
NEXTWIKI_MEDIA_DRIVER=local
NEXTWIKI_MEDIA_ROOT=./media
NEXTWIKI_STORAGE_PUBLIC_PATH=/media
```

Use `localhost` for a host process. The hostname `db` and path `/app/media` are valid inside the Compose application container, not in a host `pnpm dev` process.

Generate a secret if needed:

```bash
openssl rand -base64 32
```

### 4. Apply Migrations

The migration script loads `.env` by default, whereas Next.js loads `.env.local`. Explicitly select the local file:

```bash
DOTENV_CONFIG_PATH=.env.local pnpm db:migrate
```

You can instead export `DATABASE_URL` directly:

```bash
DATABASE_URL=postgres://nextwiki:nextwiki@localhost:5432/nextwiki pnpm db:migrate
```

### 5. Run the Application

```bash
pnpm dev
```

Open `http://localhost:3000/setup` and create the first Owner on a fresh database.

### 6. Optional Development Seed

The browser setup wizard is the normal path. For deterministic disposable development content:

```bash
DOTENV_CONFIG_PATH=.env.local pnpm db:seed
```

On a fresh database, the seed command creates development-only credentials including `owner / OwnerPassword123`. It refuses to run with `NODE_ENV=production`. Never use these credentials in a shared or production system.

## Basic Verification

During development:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

Before merging or releasing, run the required full suite:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
docker compose config
docker compose build
```

`pnpm format` writes formatting changes. Use `pnpm format:check` for a read-only check.

The integration suite uses in-process PGlite and does not require the Compose PostgreSQL service. The e2e wrapper uses a disposable real PostgreSQL database named `nextwiki_e2e` by default, resets it, builds the application, and serves the standalone output on port `3101`. Override `NEXTWIKI_E2E_DATABASE_URL` when local credentials differ; the database name must contain a separate `test`, `e2e`, or `ci` token.

The live UI audit is separate and needs an already running app. For the host server on port `3000`:

```bash
UI_AUDIT_BASE_URL=http://localhost:3000 pnpm test:ui
```

See [TESTING.md](./TESTING.md) for authenticated UI audit variables and the exact scope of each suite. Do not record a command as passing unless it ran in the current checkout.

## First-Run Checklist

After setup:

- Sign out and sign back in as the Owner.
- Create and publish a test page, then edit it and inspect history.
- Search for text from the published page.
- Upload and load a small allowed media file if uploads are enabled.
- Open `/api/health` and `/api/ready`.
- Confirm that the base URL in `/admin/settings` matches how users reach the site.

## Common Local Issues

### Cannot Connect to PostgreSQL

For a host application, `DATABASE_URL` must normally contain `localhost`; for the Compose `app` service it must contain `db`.

```bash
docker compose ps db
docker compose logs --tail=100 db
```

Confirm that port `5432` is not already used by another PostgreSQL instance. If using a different database, export its exact URL for migration scripts as well as configuring Next.js.

### Migrations Use the Wrong Database

`.env.local` is not automatically loaded by the TypeScript migration script. Use:

```bash
DOTENV_CONFIG_PATH=.env.local pnpm db:migrate
```

Print or otherwise verify the target without exposing its password in shared logs. Never drop or recreate shared or production data to fix a local configuration error.

### Port 3000 or 5432 Is Already in Use

Stop the conflicting local service or change the host-side port mapping. When changing the web port, update `NEXTWIKI_BASE_URL` before setup and the stored base URL in `/admin/settings` after setup.

### Authentication Does Not Persist

Production mode sets `Secure` session and CSRF cookies. A `NODE_ENV=production` server must be accessed through HTTPS. Use normal development mode for local HTTP. Also keep `NEXTWIKI_SECRET` stable; changing it invalidates existing sessions.

### Media Does Not Load

For host development, use a writable path such as `NEXTWIKI_MEDIA_ROOT=./media` and keep `NEXTWIKI_STORAGE_PUBLIC_PATH=/media`. For Compose, confirm the `nextwiki-media` volume is mounted at `/app/media`.

With S3, all endpoint, region, bucket, access-key, and secret-key variables are required by the current adapter. The readiness endpoint does not make a remote S3 request, so validate a real upload and browser read.

### Playwright Browser Is Missing

Install the Chromium browser used by the e2e project:

```bash
pnpm exec playwright install chromium
```

The live UI audit uses Chromium and WebKit:

```bash
pnpm exec playwright install chromium webkit
```

Use `--with-deps` on supported Linux environments when system browser dependencies are also required.

---

## 简体中文

> [English](QUICKSTART.md) | [简体中文](QUICKSTART.md#简体中文)

NoviqWiki 是由 PostgreSQL 和 Drizzle ORM 支持的 Next.js App Router 应用。请选择以下两种本地方式之一：在 Docker Compose 中运行完整评估栈，或在 Compose 中运行 PostgreSQL、同时在主机上开发应用。

### 前置条件

- 两种方式都需要 Docker 和 Docker Compose。
- 主机开发需要 Node.js 22 或更高版本以及 pnpm 10 或更高版本。仓库当前固定 `pnpm@11.7.0`。
- 使用提交的 Compose 配置时，主机端口 `3000` 和 `5432` 必须可用。

### 方式 A：完整 Docker Compose 评估

这是最快获得可用站点的方式。在仓库根目录为该本地实例生成密钥并启动两个服务：

```bash
export NEXTWIKI_SECRET="$(openssl rand -base64 32)"
docker compose up --build -d
```

检查启动状态：

```bash
docker compose ps
docker compose logs --tail=200 app
```

打开 `http://localhost:3000/setup` 并完成设置向导。提交的镜像会在启动应用前执行 Drizzle 迁移。

导出的密钥只在当前 shell 中有效。长期本地评估应将生成值放在未跟踪的 `.env` 或部署密钥系统中。Docker Compose 不会自动读取 `.env.local`。

提交的 Compose 定义不是生产安全基线：它使用示例 PostgreSQL 凭据，将 PostgreSQL 发布到 `5432` 端口，通过 HTTP 提供服务，并使用本地命名卷。面向互联网部署前请阅读 [DEPLOYMENT.md](./DEPLOYMENT.md)。

停止容器并保留数据：

```bash
docker compose down
```

除非明确希望删除数据库、媒体和备份卷，否则不要添加 `-v`。

### 方式 B：主机开发与 Compose PostgreSQL

#### 1. 安装依赖

```bash
pnpm install
```

#### 2. 启动 PostgreSQL

```bash
docker compose up -d db
```

确认服务健康：

```bash
docker compose ps db
docker compose logs --tail=100 db
```

#### 3. 配置主机应用

创建 Next.js 本地文件：

```bash
cp .env.example .env.local
```

编辑面向容器的值，使主机进程可以访问：

```bash
DATABASE_URL=postgres://nextwiki:nextwiki@localhost:5432/nextwiki
NEXTWIKI_BASE_URL=http://localhost:3000
NEXTWIKI_SECRET=replace-with-a-long-random-development-secret
NEXTWIKI_MEDIA_DRIVER=local
NEXTWIKI_MEDIA_ROOT=./media
NEXTWIKI_STORAGE_PUBLIC_PATH=/media
```

主机进程使用 `localhost`。主机名 `db` 和路径 `/app/media` 只在 Compose 应用容器内有效，不适用于主机 `pnpm dev` 进程。

需要时生成密钥：

```bash
openssl rand -base64 32
```

#### 4. 应用迁移

迁移脚本默认加载 `.env`，而 Next.js 加载 `.env.local`。请明确选择本地文件：

```bash
DOTENV_CONFIG_PATH=.env.local pnpm db:migrate
```

也可以直接导出 `DATABASE_URL`：

```bash
DATABASE_URL=postgres://nextwiki:nextwiki@localhost:5432/nextwiki pnpm db:migrate
```

#### 5. 运行应用

```bash
pnpm dev
```

在全新数据库上打开 `http://localhost:3000/setup` 并创建第一个所有者。

#### 6. 可选开发种子

浏览器设置向导是正常流程。若需要确定性的可丢弃开发内容：

```bash
DOTENV_CONFIG_PATH=.env.local pnpm db:seed
```

在全新数据库上，种子命令会创建包括 `owner / OwnerPassword123` 在内的仅限开发凭据。它拒绝在 `NODE_ENV=production` 下运行。绝不能在共享或生产系统使用这些凭据。

### 基本验证

开发期间：

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

合并或发布前运行要求的完整套件：

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
docker compose config
docker compose build
```

`pnpm format` 会写入格式化变更。只读检查请使用 `pnpm format:check`。

集成测试使用进程内 PGlite，不需要 Compose PostgreSQL 服务。e2e 包装脚本默认使用名为 `nextwiki_e2e` 的可丢弃真实 PostgreSQL 数据库，重置该数据库、构建应用，并在 `3101` 端口提供独立输出。本地凭据不同时设置 `NEXTWIKI_E2E_DATABASE_URL`；数据库名必须包含独立的 `test`、`e2e` 或 `ci` 标记。

在线 UI 审计是独立步骤，需要应用已经运行。对于 `3000` 端口的主机服务器：

```bash
UI_AUDIT_BASE_URL=http://localhost:3000 pnpm test:ui
```

各套件的已登录 UI 审计变量和准确范围见 [TESTING.md](./TESTING.md)。只有在当前检出中实际运行过的命令才能记录为通过。

### 首次运行检查清单

完成设置后：

- 退出后重新以所有者身份登录。
- 创建并发布测试页面，然后编辑并查看历史。
- 搜索已发布页面中的文本。
- 启用上传时，上传并加载一个小型允许类型媒体文件。
- 打开 `/api/health` 和 `/api/ready`。
- 确认 `/admin/settings` 中的基础 URL 与用户访问站点的方式一致。

### 常见本地问题

#### 无法连接 PostgreSQL

对于主机应用，`DATABASE_URL` 通常必须包含 `localhost`；对于 Compose `app` 服务则必须包含 `db`。

```bash
docker compose ps db
docker compose logs --tail=100 db
```

确认端口 `5432` 没有被另一个 PostgreSQL 实例占用。使用不同数据库时，应为迁移脚本导出准确 URL，同时配置 Next.js。

#### 迁移使用了错误数据库

TypeScript 迁移脚本不会自动加载 `.env.local`。请使用：

```bash
DOTENV_CONFIG_PATH=.env.local pnpm db:migrate
```

在不向共享日志暴露密码的前提下输出或以其他方式核对目标。绝不能为了修复本地配置错误而删除或重建共享或生产数据。

#### 端口 3000 或 5432 已被占用

停止冲突的本地服务或修改主机端口映射。修改 Web 端口时，应在设置前更新 `NEXTWIKI_BASE_URL`，并在设置后通过 `/admin/settings` 更新已存储的基础 URL。

#### 身份验证无法保持

生产模式会为会话和 CSRF Cookie 设置 `Secure`。`NODE_ENV=production` 服务器必须通过 HTTPS 访问。本地 HTTP 应使用正常开发模式。同时保持 `NEXTWIKI_SECRET` 稳定；更改它会使现有会话失效。

#### 媒体无法加载

主机开发使用 `NEXTWIKI_MEDIA_ROOT=./media` 等可写路径，并保持 `NEXTWIKI_STORAGE_PUBLIC_PATH=/media`。Compose 中确认 `nextwiki-media` 卷挂载在 `/app/media`。

使用 S3 时，当前适配器要求完整设置端点、区域、存储桶、访问密钥和密钥。就绪端点不会发起远程 S3 请求，因此必须验证真实上传和浏览器读取。

#### 缺少 Playwright 浏览器

安装 e2e 项目使用的 Chromium：

```bash
pnpm exec playwright install chromium
```

在线 UI 审计使用 Chromium 和 WebKit：

```bash
pnpm exec playwright install chromium webkit
```

在受支持的 Linux 环境中，如还需要系统浏览器依赖，请使用 `--with-deps`。
