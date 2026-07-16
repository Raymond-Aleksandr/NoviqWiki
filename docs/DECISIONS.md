# Architecture Decisions

## ADR-0001: Product Name

NoviqWiki is the repository and product name for v0.1.0. It is inspired by modern wiki workflows but is not a MediaWiki fork, wrapper, skin, compatibility layer, or migration utility.

## ADR-0002: Modular Monolith

The application uses a Next.js App Router modular monolith. This keeps deployment to one application service plus PostgreSQL and persistent media storage while still separating domain modules.

## ADR-0003: Markdown Canonical Format

Markdown is the canonical editable format for v0.1.0. Rendered HTML, plain text, link metadata, categories, and headings are derived artifacts stored with immutable revisions.

## ADR-0004: PostgreSQL Full-Text Search First

Search is implemented through PostgreSQL full-text search with a service boundary so OpenSearch or another external adapter can be added later without rewriting UI flows.
