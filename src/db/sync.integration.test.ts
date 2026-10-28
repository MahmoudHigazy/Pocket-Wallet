import { SyncEngine } from '@/sync/engine';
import { FakeRemote } from '@/sync/fakes';

import { createDoc, updateDoc } from './repository';
import { SqliteLocalStore } from './sqlite-local-store';
import { syncTableNames } from './tables';
import { createTestContext } from './test-utils';

function device(remote: FakeRemote) {
  const ctx = createTestContext();
  const store = new SqliteLocalStore(ctx.db);
  return { ctx, store, engine: new SyncEngine(store, remote) };
}

const record = {
  accountId: 'acc1',
  type: 'expense',
  amount: 12550,
  currency: 'EGP',
  date: 1_700_000_000_000,
  labels: ['coffee'],
};

describe('SQLite + SyncEngine', () => {
  it('a record created on one device appears on another, including offline edits', async () => {
    const remote = new FakeRemote();
    const a = device(remote);
    const b = device(remote);

    const rec = createDoc(a.ctx, 'records', record);
    await a.engine.sync(syncTableNames);
    await b.engine.sync(syncTableNames);
    expect(await b.store.getDoc('records', rec.id)).toMatchObject({ amount: 12550, labels: ['coffee'] });

    // B edits while "offline" (no sync), then comes back online.
    b.ctx.tick(1000);
    updateDoc(b.ctx, 'records', rec.id, { amount: 9900, note: 'edited offline' });
    expect(await b.store.readOutbox(10)).toHaveLength(1);

    await b.engine.sync(syncTableNames);
    await a.engine.sync(syncTableNames);

    expect(await a.store.getDoc('records', rec.id)).toMatchObject({
      amount: 9900,
      note: 'edited offline',
      version: 2,
    });
    expect(await b.store.readOutbox(10)).toHaveLength(0);
  });

  it('purges old tombstones across all sync tables', async () => {
    const remote = new FakeRemote();
    const a = device(remote);
    await a.store.putDoc('labels', { id: 'l1', name: 'x', createdAt: 1, updatedAt: 1, deletedAt: 5, version: 1 });
    await a.store.putDoc('labels', { id: 'l2', name: 'y', createdAt: 1, updatedAt: 1, deletedAt: null, version: 1 });
    expect(await a.store.purgeTombstones(10)).toBe(1);
    expect(await a.store.getDoc('labels', 'l1')).toBeNull();
    expect(await a.store.getDoc('labels', 'l2')).not.toBeNull();
  });
});
