// Ports for the sync engine. The engine is pure TS; SQLite and Firestore
// adapters implement these and live outside src/sync.

export type SyncDoc = {
  id: string;
  updatedAt: number;
  deletedAt?: number | null;
  [field: string]: unknown;
};

export type OutboxEntry = {
  seq: number;
  table: string;
  docId: string;
  op: 'upsert' | 'delete';
  payload: SyncDoc;
  attempts: number;
};

export type PushResult = { docId: string; table: string; serverUpdatedAt: number };

export interface LocalStore {
  /** Oldest-first outbox rows. */
  readOutbox(limit: number): Promise<OutboxEntry[]>;
  removeOutbox(seqs: number[]): Promise<void>;
  bumpAttempts(seqs: number[]): Promise<void>;
  hasPendingOutbox(table: string, docId: string): Promise<boolean>;
  getDoc(table: string, id: string): Promise<SyncDoc | null>;
  /** Insert or replace a doc without writing to the outbox. */
  putDoc(table: string, doc: SyncDoc): Promise<void>;
  getLastPulledAt(table: string): Promise<number>;
  setLastPulledAt(table: string, at: number): Promise<void>;
  /** Hard-delete soft-deleted docs whose deletedAt < before. Returns count. */
  purgeTombstones(before: number): Promise<number>;
}

export interface RemoteStore {
  /** Write docs; the server stamps updatedAt. Must be atomic per call or throw. */
  push(entries: { table: string; doc: SyncDoc }[]): Promise<PushResult[]>;
  /** Docs with updatedAt > since, oldest first. */
  pull(table: string, since: number): Promise<SyncDoc[]>;
}

export type Conflict = {
  table: string;
  docId: string;
  localUpdatedAt: number | null;
  remoteUpdatedAt: number;
  resolution: 'local-kept-pending';
};

export type SyncLogger = (conflict: Conflict) => void;
