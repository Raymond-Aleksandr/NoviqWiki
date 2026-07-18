# Pull Request

> [English](#pull-request) | [简体中文](#简体中文)

Complete either the English or Simplified Chinese section and remove the unused section before submitting. Do not mark a check as passed unless it ran successfully in the current checkout; list skipped checks and reasons under **Not run**.

## Summary

<!-- What changed, and what user, operator, or maintainer problem does it solve? -->

-

## Related Work

<!-- Link issues, decisions, designs, or prior pull requests. Use “None” when not applicable. -->

-

## Implementation and Risk

<!-- Describe the approach, important tradeoffs, and security/authorization/data/operational risks. -->

-

## Verification

### Results

<!-- Record useful result details, including test counts or manual routes checked. -->

-

### Quality gates

- [ ] `pnpm format`
- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm test:integration`
- [ ] `pnpm build`
- [ ] `UI_AUDIT_BASE_URL=http://localhost:3000 pnpm test:ui`
- [ ] `pnpm test:e2e`
- [ ] `docker compose config --quiet`
- [ ] `docker compose build`

`pnpm test:ui` audits an already-running local review app and does not reset it. Without `UI_AUDIT_USERNAME` and `UI_AUDIT_PASSWORD`, authenticated editor and admin routes are skipped. `pnpm test:e2e` uses a disposable database; read `docs/TESTING.md` before running it. Use `docker compose config --quiet` when real environment values are present; never paste expanded Compose output into a pull request.

### Not run

<!-- List every unchecked or non-applicable command and explain why. -->

-

## Visual Evidence

<!-- Add before/after screenshots or recordings for meaningful UI changes. Write “Not applicable” otherwise. -->

-

## Checklist

- [ ] The change is focused and does not include unrelated generated or formatting changes.
- [ ] Domain logic stays in `src/modules/**`; React components do not query the database directly.
- [ ] Route handlers and server actions validate input with Zod and delegate to domain services.
- [ ] Privileged operations enforce authorization server-side and include denied-path coverage where relevant.
- [ ] Markdown remains canonical page source; rendered HTML and search text derive from immutable revisions.
- [ ] Schema changes include reviewed Drizzle migrations and data safety or rollback notes.
- [ ] No MediaWiki compatibility, migration, extension, or API behavior was added.
- [ ] Tests cover the changed behavior and important failure paths.
- [ ] User-facing and contributor-facing English and Simplified Chinese guidance were updated together when affected.
- [ ] API contract changes regenerated `docs/openapi.json` with `pnpm openapi`.
- [ ] No secrets, private data, build output, or unrelated local files were added.

---

## 简体中文

> [English](#pull-request) | [简体中文](#简体中文)

提交前请填写英文或简体中文其中一个部分，并删除未使用的部分。只有命令在当前检出版本中成功运行后，才能将对应检查标记为通过；请在**未运行项目**中列出跳过的检查及原因。

### 摘要

<!-- 更改了什么？解决了用户、运维人员或维护者的什么问题？ -->

-

### 相关工作

<!-- 链接相关 issue、决策、设计或之前的 pull request。不适用时填写“不适用”。 -->

-

### 实现与风险

<!-- 说明实现方式、重要权衡，以及安全、授权、数据或运维风险。 -->

-

### 验证

#### 结果

<!-- 记录有用的结果详情，包括测试数量或手动检查的路由。 -->

-

#### 质量门禁

- [ ] `pnpm format`
- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm test:integration`
- [ ] `pnpm build`
- [ ] `UI_AUDIT_BASE_URL=http://localhost:3000 pnpm test:ui`
- [ ] `pnpm test:e2e`
- [ ] `docker compose config --quiet`
- [ ] `docker compose build`

`pnpm test:ui` 审核一个已经运行的本地预览应用，不会重置该应用。如果未提供 `UI_AUDIT_USERNAME` 和 `UI_AUDIT_PASSWORD`，会跳过需要身份验证的编辑和管理路由。`pnpm test:e2e` 使用一次性数据库；运行前请阅读 `docs/TESTING.md`。存在真实环境值时使用 `docker compose config --quiet`；绝不要把展开后的 Compose 输出粘贴到 pull request。

#### 未运行项目

<!-- 列出每个未勾选或不适用的命令并说明原因。 -->

-

### 视觉证据

<!-- 对有意义的 UI 更改添加修改前后截图或录屏；否则填写“不适用”。 -->

-

### 检查清单

- [ ] 更改保持聚焦，不包含无关的生成文件或格式调整。
- [ ] 领域逻辑保留在 `src/modules/**`；React 组件不直接查询数据库。
- [ ] 路由处理器和服务器操作使用 Zod 验证输入，并委托给领域服务。
- [ ] 特权操作在服务器端执行授权检查，并在相关时包含拒绝路径测试。
- [ ] Markdown 保持为页面规范源；渲染 HTML 和搜索文本从不可变修订派生。
- [ ] 数据库结构更改包含经过审查的 Drizzle 迁移，以及数据安全或回滚说明。
- [ ] 未添加 MediaWiki 兼容、迁移、扩展或 API 行为。
- [ ] 测试覆盖更改的行为和重要失败路径。
- [ ] 受影响的面向用户和贡献者的英文与简体中文指南已同步更新。
- [ ] API 契约更改已使用 `pnpm openapi` 重新生成 `docs/openapi.json`。
- [ ] 未添加密钥、私人数据、构建输出或无关本地文件。
