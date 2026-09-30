import { sql } from "drizzle-orm";
import type { Database } from "@/db/client";

const PAGE_GRAPH_NAMESPACE = "noviqwiki.page-graph";
const SEARCH_INDEX_NAMESPACE = "noviqwiki.search-index";

function siteLockKey(namespace: string, siteId: string) {
  return `${namespace}:${siteId}`;
}

/**
 * These helpers must be called inside an open transaction. PostgreSQL releases
 * transaction-scoped advisory locks automatically on commit or rollback.
 */
export async function lockPageGraphForTransaction(siteId: string, database: Database) {
  await database.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${siteLockKey(PAGE_GRAPH_NAMESPACE, siteId)}, 0))`
  );
}

/**
 * Page-level search-index writers share this lock, so unrelated pages can be
 * updated concurrently. A rebuild takes the exclusive variant of the same key.
 */
export async function lockSearchIndexWriterForTransaction(siteId: string, database: Database) {
  await database.execute(
    sql`select pg_advisory_xact_lock_shared(hashtextextended(${siteLockKey(SEARCH_INDEX_NAMESPACE, siteId)}, 0))`
  );
}

export async function lockSearchIndexRebuildForTransaction(siteId: string, database: Database) {
  await database.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${siteLockKey(SEARCH_INDEX_NAMESPACE, siteId)}, 0))`
  );
}
