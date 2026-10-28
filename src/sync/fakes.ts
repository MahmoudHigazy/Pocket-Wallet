import type { LocalStore, OutboxEntry, PushResult, RemoteStore, SyncDoc } from './types';

/** In-memory LocalStore for tests. */
export class FakeLocal implements LocalStore {
  docs = new Map<string, SyncDoc>();
  outbox: OutboxEntry[] = [];
  pulledAt = new Map<string, number>();
  private seq = 0;

  private key = (t: string, id: string) => `${t}/${id}`;

  /** Simulates an app write: store the doc and queue it, like a repository would. */
  write(table: string, doc: SyncDoc) {
    this.docs.set(this.key(table, doc.id), doc);
    this.outbox.push({
      seq: ++this.seq,
      table,
      docId: doc.id,
      op: doc.deletedAt ? 'delete' : 'upsert',
      payload: doc,
      attempts: 0,
    });
  }

  async readOutbox(limit: number) {
    return this.outbox.slice(0, limit);
  }
  async removeOutbox(seqs: number[]) {
    this.outbox = this.outbox.filter((r) => !seqs.includes(r.seq));
  }
  async bumpAttempts(seqs: number[]) {
    for (const r of this.outbox) if (seqs.includes(r.seq)) r.attempts++;
  }
  async hasPendingOutbox(table: string, docId: string) {
    return this.outbox.some((r) => r.table === table && r.docId === docId);
  }
  async getDoc(table: string, id: string) {
    return this.docs.get(this.key(table, id)) ?? null;
  }
  async putDoc(table: string, doc: SyncDoc) {
    this.docs.set(this.key(table, doc.id), doc);
  }
  async getLastPulledAt(table: string) {
    return this.pulledAt.get(table) ?? 0;
  }
  async setLastPulledAt(table: string, at: number) {
    this.pulledAt.set(table, at);
  }
  async purgeTombstones(before: number) {
    let n = 0;
    for (const [k, d] of this.docs) {
      if (d.deletedAt != null && d.deletedAt < before) {
        this.docs.delete(k);
        n++;
      }
    }
    return n;
  }
}

/** In-memory Firestore stand-in with a monotonically increasing server clock. */
export class FakeRemote implements RemoteStore {
  docs = new Map<string, SyncDoc>();
  clock = 1000;
  failNextPush = false;

  async push(entries: { table: string; doc: SyncDoc }[]): Promise<PushResult[]> {
    if (this.failNextPush) {
      this.failNextPush = false;
      throw new Error('network down');
    }
    return entries.map(({ table, doc }) => {
      const serverUpdatedAt = ++this.clock;
      this.docs.set(`${table}/${doc.id}`, { ...doc, updatedAt: serverUpdatedAt });
      return { table, docId: doc.id, serverUpdatedAt };
    });
  }

  async pull(table: string, since: number) {
    return [...this.docs.entries()]
      .filter(([k, d]) => k.startsWith(`${table}/`) && d.updatedAt > since)
      .map(([, d]) => d)
      .sort((a, b) => a.updatedAt - b.updatedAt);
  }
}
