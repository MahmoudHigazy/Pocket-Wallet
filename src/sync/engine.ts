import type { Conflict, LocalStore, OutboxEntry, RemoteStore, SyncDoc, SyncLogger } from './types';

export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

type Options = {
  batchSize?: number;
  onConflict?: SyncLogger;
  now?: () => number;
};

export class SyncEngine {
  private readonly batchSize: number;
  private readonly onConflict: SyncLogger;
  private readonly now: () => number;

  constructor(
    private readonly local: LocalStore,
    private readonly remote: RemoteStore,
    opts: Options = {},
  ) {
    this.batchSize = opts.batchSize ?? 200;
    this.onConflict = opts.onConflict ?? (() => {});
    this.now = opts.now ?? Date.now;
  }

  /**
   * Drain the outbox. Several queued writes to one doc collapse to the newest,
   * since payloads are full documents. On failure rows stay queued.
   * Returns the number of docs pushed.
   */
  async push(): Promise<number> {
    let pushed = 0;
    for (;;) {
      const rows = await this.local.readOutbox(this.batchSize);
      if (rows.length === 0) return pushed;

      const latest = new Map<string, OutboxEntry>();
      for (const row of rows) latest.set(`${row.table}/${row.docId}`, row);
      const entries = [...latest.values()].map((r) => ({ table: r.table, doc: r.payload }));
      const seqs = rows.map((r) => r.seq);

      let results;
      try {
        results = await this.remote.push(entries);
      } catch (err) {
        await this.local.bumpAttempts(seqs);
        throw err;
      }

      await this.local.removeOutbox(seqs);
      for (const res of results) {
        // Adopt the server stamp unless the doc was edited again meanwhile.
        if (await this.local.hasPendingOutbox(res.table, res.docId)) continue;
        const doc = await this.local.getDoc(res.table, res.docId);
        if (doc) await this.local.putDoc(res.table, { ...doc, updatedAt: res.serverUpdatedAt });
      }
      pushed += entries.length;
    }
  }

  /** Pull changes for each table and upsert them locally. Returns docs applied. */
  async pull(tables: string[]): Promise<number> {
    let applied = 0;
    for (const table of tables) {
      const since = await this.local.getLastPulledAt(table);
      const docs = await this.remote.pull(table, since);
      let maxSeen = since;
      for (const doc of docs) {
        if (await this.applyRemote(table, doc)) applied++;
        maxSeen = Math.max(maxSeen, doc.updatedAt);
      }
      if (maxSeen > since) await this.local.setLastPulledAt(table, maxSeen);
    }
    return applied;
  }

  /** Push then pull. */
  async sync(tables: string[]): Promise<{ pushed: number; pulled: number }> {
    const pushed = await this.push();
    const pulled = await this.pull(tables);
    return { pushed, pulled };
  }

  async purgeTombstones(): Promise<number> {
    return this.local.purgeTombstones(this.now() - TOMBSTONE_TTL_MS);
  }

  private async applyRemote(table: string, remote: SyncDoc): Promise<boolean> {
    const local = await this.local.getDoc(table, remote.id);

    // A pending local edit will get a newer server timestamp when pushed, so
    // under last-write-wins it beats this remote doc. Keep it and log.
    if (await this.local.hasPendingOutbox(table, remote.id)) {
      this.log({
        table,
        docId: remote.id,
        localUpdatedAt: local?.updatedAt ?? null,
        remoteUpdatedAt: remote.updatedAt,
        resolution: 'local-kept-pending',
      });
      return false;
    }

    if (local && local.updatedAt > remote.updatedAt) return false; // stale echo
    if (local && local.updatedAt === remote.updatedAt) return false; // already applied

    await this.local.putDoc(table, remote);
    return true;
  }

  private log(conflict: Conflict) {
    this.onConflict(conflict);
  }
}
