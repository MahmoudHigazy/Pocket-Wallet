import { and, asc, eq, isNotNull, lt } from 'drizzle-orm';

import type { LocalStore, OutboxEntry, SyncDoc } from '@/sync/types';

import { outbox, syncState } from './schema';
import { syncTableNames, tableFor } from './tables';
import type { Db } from './types';

/** LocalStore backed by SQLite via Drizzle. Methods are async only to satisfy the port. */
export class SqliteLocalStore implements LocalStore {
  constructor(private readonly db: Db) {}

  async readOutbox(limit: number): Promise<OutboxEntry[]> {
    const rows = this.db.select().from(outbox).orderBy(asc(outbox.seq)).limit(limit).all();
    return rows.map((r) => ({
      seq: r.seq,
      table: r.table,
      docId: r.docId,
      op: r.op,
      payload: r.payload as SyncDoc,
      attempts: r.attempts,
    }));
  }

  async removeOutbox(seqs: number[]): Promise<void> {
    this.db.transaction((tx) => {
      for (const seq of seqs) tx.delete(outbox).where(eq(outbox.seq, seq)).run();
    });
  }

  async bumpAttempts(seqs: number[]): Promise<void> {
    this.db.transaction((tx) => {
      for (const seq of seqs) {
        const row = tx.select().from(outbox).where(eq(outbox.seq, seq)).get();
        if (row) tx.update(outbox).set({ attempts: row.attempts + 1 }).where(eq(outbox.seq, seq)).run();
      }
    });
  }

  async hasPendingOutbox(table: string, docId: string): Promise<boolean> {
    const row = this.db
      .select({ seq: outbox.seq })
      .from(outbox)
      .where(and(eq(outbox.table, table), eq(outbox.docId, docId)))
      .limit(1)
      .get();
    return row !== undefined;
  }

  async getDoc(table: string, id: string): Promise<SyncDoc | null> {
    const t = tableFor(table);
    const row = this.db.select().from(t).where(eq(t.id, id)).get();
    return (row as SyncDoc | undefined) ?? null;
  }

  async putDoc(table: string, doc: SyncDoc): Promise<void> {
    const t = tableFor(table);
    this.db.insert(t).values(doc).onConflictDoUpdate({ target: t.id, set: doc }).run();
  }

  async getLastPulledAt(table: string): Promise<number> {
    const row = this.db.select().from(syncState).where(eq(syncState.collection, table)).get();
    return row?.lastPulledAt ?? 0;
  }

  async setLastPulledAt(table: string, at: number): Promise<void> {
    this.db
      .insert(syncState)
      .values({ collection: table, lastPulledAt: at })
      .onConflictDoUpdate({ target: syncState.collection, set: { lastPulledAt: at } })
      .run();
  }

  async purgeTombstones(before: number): Promise<number> {
    let purged = 0;
    this.db.transaction((tx) => {
      for (const name of syncTableNames) {
        const t = tableFor(name);
        const res = tx
          .delete(t)
          .where(and(isNotNull(t.deletedAt), lt(t.deletedAt, before)))
          .run();
        purged += (res as { changes?: number }).changes ?? 0;
      }
    });
    return purged;
  }
}
