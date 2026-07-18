# Security Policy

> [English](SECURITY.md) | [简体中文](SECURITY.md#简体中文)

## Supported Versions

NoviqWiki is currently pre-1.0 software under active development. The source tree identifies itself as `0.1.0`; this policy does not claim that a tagged release exists.

| Version or source                | Security-fix status                                         |
| -------------------------------- | ----------------------------------------------------------- |
| `main` and current `0.1.x` work  | Considered on a best-effort basis during active development |
| Historical commits and snapshots | Not separately supported                                    |

When tagged releases are published, their release notes and this table must identify which lines still receive fixes. Operators should reproduce a report against the latest supported code when practical.

## Scope

This policy covers vulnerabilities in NoviqWiki's first-party application code, API routes, authentication and authorization logic, Markdown rendering, media handling, database workflows, operational scripts, and repository-provided container configuration.

A vulnerability in a third-party dependency is relevant when NoviqWiki exposes or worsens its impact. General support requests, feature requests, and conduct concerns belong in their documented channels rather than the vulnerability process.

## Report a Vulnerability Privately

Do not open a public issue, discussion, or pull request that contains exploitable details.

The preferred route is GitHub private vulnerability reporting:

<https://github.com/Raymond-Aleksandr/NoviqWiki/security/advisories/new>

Use that URL only if, after signing in, GitHub presents a private reporting form for this repository. Availability depends on repository settings and is not guaranteed by this document.

If the private form is unavailable:

1. Check the repository owner's GitHub profile for a private contact method and use it to request a secure reporting channel; or
2. Open a minimal public issue asking a maintainer to provide a private security contact. Do not include the vulnerability type, affected route, reproduction steps, screenshots, logs, or names in that issue.

Wait until a private channel is established before sending sensitive details. Never include production secrets, session tokens, passwords, private keys, unredacted cookies, or private user data in a report.

## What to Include

Provide enough information to reproduce and assess the problem safely:

- Affected version, branch, tag, or commit hash
- Deployment and configuration context, with secrets removed
- Vulnerability description and expected security boundary
- Minimal, deterministic reproduction steps or proof of concept
- Observed and potential impact
- Whether the issue is already public or known to another project
- Any known mitigation or suggested fix
- A safe way to contact you for follow-up, if you want a response

Use synthetic data and the minimum evidence necessary. Redact tokens, account details, hostnames, and user content that are not essential to the report.

## Handling and Disclosure

Maintainers will handle reports according to available project capacity. No acknowledgement, fix, disclosure, or release deadline is promised by this policy.

When a report can be investigated, the expected process is:

1. Confirm that the report was received through the private channel.
2. Reproduce the issue and assess affected versions, exploitability, and impact.
3. Develop and verify a fix or document a mitigation.
4. Coordinate the timing and content of public disclosure with the reporter when practical.
5. Publish an advisory, changelog entry, and supported-version update when appropriate.

Please keep exploitable details private until a fix or mitigation is available and coordinated disclosure has occurred. If you believe disclosure must happen sooner, explain the safety reason through the private channel so the project can coordinate rather than being surprised.

## Research Guidelines

To minimize harm:

- Test only systems, accounts, and data you own or are explicitly authorized to use.
- Prefer a local, isolated NoviqWiki instance with synthetic data.
- Stop when you have enough evidence to demonstrate the issue.
- Do not access, retain, alter, or destroy another person's data.
- Do not degrade availability, send spam, use social engineering, or establish persistence.
- Do not test third-party services merely because a NoviqWiki deployment integrates with them.
- Follow applicable law and the terms of any platform involved.

Following these guidelines helps the project treat research as good-faith activity, but this policy does not authorize access to systems you do not own and cannot bind third parties.

The project does not currently promise a bug bounty, payment, public credit, or CVE assignment. Maintainers may offer acknowledgement only with the reporter's consent.

## Operator Security

Security also depends on deployment. Use a stable `NEXTWIKI_SECRET`, HTTPS, restricted database and object-storage credentials, current dependencies, tested backups, and least-privilege roles. The v0.1.0 JSON resource API is trusted-integration only. Private wikis must disable shared caching for the current local-media route; immediate revocation additionally requires `Cache-Control: private, no-store` plus purging cached objects or rotating previously distributed URLs. Review [Configuration](docs/CONFIGURATION.md), [Deployment](docs/DEPLOYMENT.md), [Authorization](docs/AUTHORIZATION.md), [API](docs/API.md), and [Backup and restore](docs/BACKUP_RESTORE.md).

---

## 简体中文

> [English](SECURITY.md) | [简体中文](SECURITY.md#简体中文)

### 支持的版本

NoviqWiki 目前仍是处于积极开发阶段的 1.0 之前软件。源码将自身版本标识为 `0.1.0`；本策略并不表示已存在带标签的正式版本。

| 版本或源码                     | 安全修复状态               |
| ------------------------------ | -------------------------- |
| `main` 和当前 `0.1.x` 开发代码 | 活跃开发期间尽力评估与处理 |
| 历史提交和快照                 | 不单独提供支持             |

发布带标签的版本后，其发布说明和本表必须指出哪些版本线仍接收修复。在可行的情况下，运维人员应使用最新受支持代码复现问题。

### 适用范围

本策略适用于 NoviqWiki 第一方应用代码、API 路由、身份验证与授权逻辑、Markdown 渲染、媒体处理、数据库工作流、运维脚本以及仓库提供的容器配置中的漏洞。

当 NoviqWiki 暴露或加剧第三方依赖漏洞的影响时，该问题也属于相关范围。一般支持请求、功能建议和行为问题应使用各自记录的渠道，而不是漏洞报告流程。

### 私密报告漏洞

不要创建包含可利用细节的公开 issue、讨论或 pull request。

首选方式是 GitHub 私密漏洞报告：

<https://github.com/Raymond-Aleksandr/NoviqWiki/security/advisories/new>

只有在登录后 GitHub 确实为本仓库显示私密报告表单时，才使用该地址。该功能取决于仓库设置，本文件不能保证其可用。

如果私密表单不可用：

1. 查看仓库所有者的 GitHub 个人资料是否提供私密联系方式，并用它请求安全报告渠道；或
2. 创建一个内容最少的公开 issue，请求维护者提供私密安全联系方式。不要在该 issue 中包含漏洞类型、受影响路由、复现步骤、截图、日志或人员姓名。

在私密渠道建立之前，不要发送敏感细节。报告中绝不要包含生产密钥、会话令牌、密码、私钥、未脱敏 Cookie 或私人用户数据。

### 报告应包含的内容

请提供足以安全复现和评估问题的信息：

- 受影响的版本、分支、标签或提交哈希
- 已移除密钥的部署与配置背景
- 漏洞说明和预期的安全边界
- 最小且确定性的复现步骤或概念验证
- 已观察到和潜在的影响
- 问题是否已经公开或已告知其他项目
- 已知缓解措施或建议修复方案
- 如果希望收到回复，提供一种安全的后续联系方式

请使用合成数据并只提供必要的最少证据。对报告并非必需的令牌、账号信息、主机名和用户内容进行脱敏。

### 处理与披露

维护者会根据项目当前可用资源处理报告。本策略不承诺确认、修复、披露或发布时限。

当报告可以得到调查时，预期流程为：

1. 通过私密渠道确认已收到报告。
2. 复现问题并评估受影响版本、可利用性和影响。
3. 开发并验证修复，或记录缓解措施。
4. 在可行的情况下与报告人协调公开披露的时间和内容。
5. 在适当时发布安全公告、更新日志和支持版本说明。

在修复或缓解措施可用且已完成协调披露前，请对可利用细节保密。如果你认为必须提前披露，请通过私密渠道说明安全原因，以便项目协调，而不是在没有预警的情况下得知。

### 研究规范

为尽量减少伤害：

- 仅测试你拥有或得到明确授权的系统、账号和数据。
- 优先使用包含合成数据的本地隔离 NoviqWiki 实例。
- 获得足以证明问题的证据后立即停止测试。
- 不要访问、保留、更改或破坏他人的数据。
- 不要降低可用性、发送垃圾信息、进行社会工程攻击或建立持久访问。
- 不要仅因为某个 NoviqWiki 部署集成了第三方服务就测试该服务。
- 遵守适用法律和相关平台条款。

遵守这些规范有助于项目将研究视为善意行为，但本策略不授权访问你不拥有的系统，也不能约束第三方。

项目目前不承诺漏洞奖金、付款、公开致谢或 CVE 分配。维护者仅可在获得报告人同意后提供致谢。

### 运维安全

安全性也取决于部署方式。请使用稳定的 `NEXTWIKI_SECRET`、HTTPS、受限的数据库和对象存储凭据、最新依赖、经过验证的备份以及最小权限角色。v0.1.0 的 JSON 资源 API 仅限受信任集成。私有 Wiki 必须为当前本地媒体路由禁用共享缓存；若要求立即撤销访问，还必须配置 `Cache-Control: private, no-store`，并清除已缓存对象或轮换此前分发的 URL。请阅读[配置](docs/CONFIGURATION.md)、[部署](docs/DEPLOYMENT.md)、[授权](docs/AUTHORIZATION.md)、[API](docs/API.md)和[备份与恢复](docs/BACKUP_RESTORE.md)。
