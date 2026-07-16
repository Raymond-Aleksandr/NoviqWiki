# Architecture Decisions

## ADR-0001: Product Name

NoviqWiki is the repository and product name for v0.1.0. It is inspired by modern wiki workflows but is not a MediaWiki fork, wrapper, skin, compatibility layer, or migration utility.

## ADR-0002: Modular Monolith

The application uses a Next.js App Router modular monolith. This keeps deployment to one application service plus PostgreSQL and persistent media storage while still separating domain modules.

## ADR-0003: Markdown Canonical Format

Markdown is the canonical editable format for v0.1.0. Rendered HTML, plain text, link metadata, categories, and headings are derived artifacts stored with immutable revisions.

## ADR-0004: PostgreSQL Full-Text Search First

Search is implemented through PostgreSQL full-text search with a service boundary so OpenSearch or another external adapter can be added later without rewriting UI flows.

## ADR-0005: Lightweight Plugin Boundary

v0.1.0 exposes an in-process plugin registry for future extension contributions, but it does not load arbitrary user code, ship a marketplace, or require another runtime service. This preserves the one-application deployment model while keeping a stable place for later plugin APIs.

## ADR-0006: Design Package As UI Source

`NoviqWiki.html` is treated as the authoritative UI reference for release styling. Confirmation dialogs, media picker dialogs, button states, mobile navigation, and design tokens should align with that package before new visual patterns are introduced.
