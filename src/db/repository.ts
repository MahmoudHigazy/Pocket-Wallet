import { eq } from 'drizzle-orm';

import type { SyncDoc } from '@/sync/types';

import { outbox } from './schema';
import { tableFor, type SyncTableName } from './tables';
import type { Db } from './types';

export type RepoContext = {
  db: Db;
  now: () => number;
  newId: () => string;
};

type NewDoc = Record<string, unknown>;

/**
 * Create a doc: row + outbox entry in one transaction, so a crash can never
 * leave a change that never syncs. The UI never waits on the network.
 */
export function createDoc(ctx: RepoContext, table: SyncTableName, fields: NewDoc): SyncDoc {
  const t = ctx.now();
  const doc = { ...fields, id: ctx.newId(), createdAt: t, updatedAt: t, deletedAt: null, version: 1 };
  writeWithOutbox(ctx, table, doc, 'upsert');
  return doc;
}

/** Merge fields into an existing doc, bumping updatedAt and version. */
export function updateDoc(
  ctx: RepoContext,
  table: SyncTableName,
  id: string,
  patch: NewDoc,
): SyncDoc {
  const existing = readDoc(ctx, table, id);
  const doc = {
    ...existing,
    ...patch,
    id,
    createdAt: existing.createdAt,
    updatedAt: ctx.now(),
    version: (existing.version as number) + 1,
  };
  writeWithOutbox(ctx, table, doc, 'upsert');
  return doc;
}

/** Soft delete so the deletion syncs; tombstones are purged after 90 days. */
export function deleteDoc(ctx: RepoContext, table: SyncTableName, id: string): SyncDoc {
  const existing = readDoc(ctx, table, id);
  const t = ctx.now();
  const doc = { ...existing, deletedAt: t, updatedAt: t, version: (existing.version as number) + 1 };
  writeWithOutbox(ctx, table, doc, 'delete');
  return doc;
}

function readDoc(ctx: RepoContext, table: SyncTableName, id: string): SyncDoc & { version: unknown } {
  const t = tableFor(table);
  const row = ctx.db.select().from(t).where(eq(t.id, id)).get();
  if (!row) throw new Error(`${table}/${id} not found`);
  return row as SyncDoc & { version: unknown };
}

function writeWithOutbox(ctx: RepoContext, table: SyncTableName, doc: NewDoc, op: 'upsert' | 'delete') {
  const t = tableFor(table);
  ctx.db.transaction((tx) => {
    tx.insert(t).values(doc).onConflictDoUpdate({ target: t.id, set: doc }).run();
    tx.insert(outbox)
      .values({
        table,
        docId: doc.id as string,
        op,
        payload: doc as Record<string, unknown>,
        createdAt: ctx.now(),
      })
      .run();
  });
}
