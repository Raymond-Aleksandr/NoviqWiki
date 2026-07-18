# Contributing to NoviqWiki

> [English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING.md#简体中文)

Thank you for helping improve NoviqWiki. Contributions can include bug reports, feature proposals, documentation, tests, design review, and code.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Follow [SECURITY.md](SECURITY.md) for vulnerabilities, and never place vulnerability details in a public issue.

## Before You Start

- Search existing issues and pull requests before opening a duplicate.
- Use the repository's bug, feature, or maintenance issue template when it matches the work.
- Discuss large features, schema changes, security-sensitive changes, and architectural changes before investing in a full implementation.
- Keep each change focused. Separate unrelated refactors or formatting changes from functional work.
- Do not add MediaWiki compatibility, migration, extension, or API behavior to this repository.

## Development Setup

Prerequisites:

- Node.js 22 or newer
- pnpm 10 or newer; `package.json` currently pins pnpm 11.7.0
- PostgreSQL 17 for the repository-matched setup, or the included Compose database service
- Docker Engine and Docker Compose for container and full-gate verification

Install dependencies and create a local environment file:

```bash
corepack enable
pnpm install
cp .env.example .env
```

When the app runs on the host and PostgreSQL runs in Compose, set a host-reachable database URL and a local secret in `.env`:

```dotenv
DATABASE_URL=postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki
NOVIQWIKI_BASE_URL=http://localhost:3000
NOVIQWIKI_SECRET=replace-with-a-long-random-secret
NOVIQWIKI_MEDIA_DRIVER=local
NOVIQWIKI_MEDIA_ROOT=media
NOVIQWIKI_STORAGE_PUBLIC_PATH=/media
```

Generate a secret with `openssl rand -base64 32`, then prepare and start the app:

```bash
docker compose up -d db
pnpm db:migrate
pnpm dev
```

Open <http://localhost:3000> and complete the full setup wizard on a fresh database. If the database already contains a site but has no users, complete the Owner-only bootstrap on a trusted network. See [Quickstart](docs/QUICKSTART.md) and [Development](docs/DEVELOPMENT.md) for detailed setup and troubleshooting.

## Architecture Rules

- Keep domain logic in `src/modules/**`; React components must not query the database directly.
- Validate route-handler and server-action input with Zod, then delegate to domain services.
- Enforce authorization on the server for every privileged operation. UI visibility is not a security boundary.
- Keep Markdown as the canonical page source. Store sanitized rendered HTML and searchable plain text in immutable revisions.
- Represent schema changes with reviewed Drizzle migrations.
- Add audit logging where privileged or operational actions require traceability.
- Preserve the project's explicit non-goal: no MediaWiki compatibility, migration, extension, or API behavior.

Read [Architecture](docs/ARCHITECTURE.md), [Authorization](docs/AUTHORIZATION.md), and [Content format](docs/CONTENT_FORMAT.md) before changing those boundaries.

## Change Workflow

1. Create or identify an issue for work that benefits from discussion or tracking.
2. Make the smallest coherent change that solves the stated problem.
3. Add or update unit, integration, UI, or end-to-end coverage in proportion to risk.
4. Run focused checks while developing, then the applicable full gate before submission.
5. Update English and Simplified Chinese guidance together when user-facing or contributor-facing behavior changes.
6. Update the changelog when a change is visible to users or operators.
7. Submit a pull request with a clear summary, risk notes, and exact verification results.

## Verification

During development, run the smallest relevant subset:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

Before submitting application or release-related changes, run the applicable full gate:

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
UI_AUDIT_BASE_URL=http://localhost:3000 pnpm test:ui
pnpm test:e2e
docker compose config --quiet
docker compose build
```

Important test conditions:

- `pnpm format` rewrites files; `pnpm format:check` verifies the final tree without rewriting it.
- Integration tests use isolated in-memory PGlite databases created by the test helpers. Do not change test configuration to point at production or shared staging data.
- `pnpm test:ui` audits an already-running local review app and does not reset it. Without `UI_AUDIT_USERNAME` and `UI_AUDIT_PASSWORD`, authenticated editor and admin routes are skipped.
- `pnpm test:e2e` resets only a database whose name is recognized as disposable and starts its own production-mode test server. Review [Testing](docs/TESTING.md) before running it.
- Use `docker compose config --quiet` when `.env` or the shell contains a real secret. Plain `docker compose config` expands environment values and its output must not be copied into logs or pull requests.
- Documentation-only changes may make runtime or Docker checks not applicable. In that case, record each skipped command and the reason in the pull request instead of marking it as passed.

Do not claim a command passed unless it ran successfully in the current checkout. Include relevant failure output and environment limitations for commands that fail or cannot run.

## Database and Generated Artifacts

For a schema change:

```bash
pnpm db:generate
pnpm db:migrate
```

Review generated SQL before committing it. For changes that affect production data, describe backup, rollback, or restore considerations in the pull request.

Regenerate `docs/openapi.json` with `pnpm openapi` when the documented API contract changes. Do not hand-edit generated output when a repository generator owns it.

## Documentation

Update the documentation that owns the changed behavior, including configuration, deployment, API, content format, testing, or upgrade guidance as applicable.

Keep commands, paths, environment variables, API routes, and role identifiers identical across English and Simplified Chinese sections.

## Pull Requests

A pull request should:

- Explain the problem, the chosen solution, and important tradeoffs.
- Stay focused and avoid unrelated generated or formatting changes.
- Link relevant issues or decisions.
- Identify security, authorization, data migration, compatibility, and operational risks.
- List exact commands run and their results; explain anything not run.
- Include screenshots or recordings for meaningful UI changes.
- Keep documentation and tests aligned with the implementation.

Reviewers may ask for changes when authorization, validation, migration safety, immutable revision behavior, bilingual documentation, or verification evidence is incomplete.

## Licensing

NoviqWiki is distributed under the [Apache License 2.0](LICENSE). Submit only work you have the right to contribute, and do not add third-party material with incompatible terms.

---

## 简体中文

> [English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING.md#简体中文)

感谢你帮助改进 NoviqWiki。贡献可以包括缺陷报告、功能建议、文档、测试、设计审查和代码。

参与本项目即表示你同意遵守[行为准则](CODE_OF_CONDUCT.md)。请按照 [SECURITY.md](SECURITY.md) 报告漏洞，不要通过公开 issue 提交漏洞细节。

### 开始之前

- 创建新 issue 前，先搜索现有 issue 和 pull request，避免重复。
- 当仓库提供的缺陷、功能或维护任务模板适用时，请使用对应模板。
- 对大型功能、数据库结构更改、安全敏感更改和架构更改，请先讨论，再投入完整实现。
- 每次更改应保持聚焦。不要将无关重构或格式调整与功能更改混在一起。
- 不要在本仓库中添加 MediaWiki 兼容、迁移、扩展或 API 行为。

### 开发环境设置

前置条件：

- Node.js 22 或更高版本
- pnpm 10 或更高版本；`package.json` 当前固定使用 pnpm 11.7.0
- 与仓库配置一致的 PostgreSQL 17，或 Compose 中包含的数据库服务
- 用于容器验证和完整质量门禁的 Docker Engine 与 Docker Compose

安装依赖并创建本地环境变量文件：

```bash
corepack enable
pnpm install
cp .env.example .env
```

当应用在主机运行而 PostgreSQL 在 Compose 中运行时，请在 `.env` 中设置主机可访问的数据库地址和本地密钥：

```dotenv
DATABASE_URL=postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki
NOVIQWIKI_BASE_URL=http://localhost:3000
NOVIQWIKI_SECRET=replace-with-a-long-random-secret
NOVIQWIKI_MEDIA_DRIVER=local
NOVIQWIKI_MEDIA_ROOT=media
NOVIQWIKI_STORAGE_PUBLIC_PATH=/media
```

使用 `openssl rand -base64 32` 生成密钥，然后准备并启动应用：

```bash
docker compose up -d db
pnpm db:migrate
pnpm dev
```

打开 <http://localhost:3000>，并在全新数据库上完成完整初始化向导。如果数据库已有站点但没有用户，请先在受信网络完成仅 Owner 引导。详细设置和故障排查请参阅[快速开始](docs/QUICKSTART.md)和[开发指南](docs/DEVELOPMENT.md)。

### 架构规则

- 将领域逻辑保留在 `src/modules/**`；React 组件不得直接查询数据库。
- 使用 Zod 验证路由处理器和服务器操作的输入，然后委托给领域服务。
- 每个特权操作都必须在服务器端执行授权检查。界面是否可见不能作为安全边界。
- 将 Markdown 保持为页面的规范源。在不可变修订中存储经过清理的渲染 HTML 和可搜索纯文本。
- 使用经过审查的 Drizzle 迁移表示数据库结构更改。
- 对需要可追溯性的特权或运维操作添加审计日志。
- 保持项目明确的非目标：不添加 MediaWiki 兼容、迁移、扩展或 API 行为。

更改这些边界前，请阅读[架构](docs/ARCHITECTURE.md)、[授权](docs/AUTHORIZATION.md)和[内容格式](docs/CONTENT_FORMAT.md)。

### 更改流程

1. 对需要讨论或跟踪的工作，创建或确定对应的 issue。
2. 以最小且完整的一组更改解决所述问题。
3. 根据风险添加或更新单元、集成、UI 或端到端测试。
4. 开发期间运行有针对性的检查，提交前再运行适用的完整质量门禁。
5. 面向用户或贡献者的行为发生变化时，同时更新英文和简体中文指南。
6. 用户或运维人员可见的变化应更新更新日志。
7. 提交 pull request，清楚说明摘要、风险和精确的验证结果。

### 验证

开发期间运行最相关的检查子集：

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

提交应用或发布相关更改前，请运行适用的完整质量门禁：

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
UI_AUDIT_BASE_URL=http://localhost:3000 pnpm test:ui
pnpm test:e2e
docker compose config --quiet
docker compose build
```

重要测试条件：

- `pnpm format` 会重写文件；`pnpm format:check` 用于在不重写文件的情况下验证最终工作树。
- 集成测试使用测试辅助工具创建的隔离内存 PGlite 数据库。不要更改测试配置，使其指向生产或共享预发布数据。
- `pnpm test:ui` 审核一个已经运行的本地预览应用，不会重置该应用。如果未提供 `UI_AUDIT_USERNAME` 和 `UI_AUDIT_PASSWORD`，会跳过需要身份验证的编辑和管理路由。
- `pnpm test:e2e` 只会重置名称被识别为一次性用途的数据库，并启动自己的生产模式测试服务器。运行前请阅读[测试指南](docs/TESTING.md)。
- 当 `.env` 或 shell 含真实密钥时使用 `docker compose config --quiet`。普通 `docker compose config` 会展开环境变量值，其输出不得复制到日志或 pull request。
- 对于仅修改文档的更改，运行时或 Docker 检查可能不适用。此时请在 pull request 中逐项记录跳过的命令及原因，不要将其标记为已通过。

只有命令在当前检出版本中成功运行后，才能声称其通过。对于失败或无法运行的命令，请提供相关失败输出和环境限制。

### 数据库与生成文件

对于数据库结构更改：

```bash
pnpm db:generate
pnpm db:migrate
```

提交前请审查生成的 SQL。对于影响生产数据的更改，请在 pull request 中说明备份、回滚或恢复注意事项。

当 API 文档契约更改时，使用 `pnpm openapi` 重新生成 `docs/openapi.json`。如果某个生成文件由仓库生成器管理，请勿手动编辑。

### 文档

根据需要更新负责对应行为的文档，包括配置、部署、API、内容格式、测试或升级指南。

英文和简体中文部分中的命令、路径、环境变量、API 路由和角色标识符必须保持一致。

### Pull request

Pull request 应：

- 说明问题、所选解决方案和重要权衡。
- 保持聚焦，避免无关的生成文件或格式更改。
- 链接相关 issue 或决策记录。
- 指出安全、授权、数据迁移、兼容性和运维风险。
- 列出实际运行的命令及结果，并说明未运行的项目。
- 对有意义的 UI 更改提供截图或录屏。
- 确保文档和测试与实现一致。

如果授权、验证、迁移安全、不可变修订行为、双语文档或验证证据不完整，审查者可能要求进一步修改。

### 许可

NoviqWiki 按 [Apache License 2.0](LICENSE) 分发。请仅提交你有权贡献的内容，不要添加许可条款不兼容的第三方材料。
