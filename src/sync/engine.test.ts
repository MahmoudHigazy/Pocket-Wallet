import { SyncEngine, TOMBSTONE_TTL_MS } from './engine';
import { FakeLocal, FakeRemote } from './fakes';
import type { Conflict } from './types';

const T = 'records';

function device(remote: FakeRemote, conflicts: Conflict[] = []) {
  const local = new FakeLocal();
  const engine = new SyncEngine(local, remote, { onConflict: (c) => conflicts.push(c) });
  return { local, engine };
}

describe('SyncEngine', () => {
  it('propagates a record from one device to another', async () => {
    const remote = new FakeRemote();
    const a = device(remote);
    const b = device(remote);

    a.local.write(T, { id: 'r1', updatedAt: 1, amount: 500 });
    await a.engine.sync([T]);
    await b.engine.sync([T]);

    expect(await b.local.getDoc(T, 'r1')).toMatchObject({ id: 'r1', amount: 500 });
    expect(a.local.outbox).toHaveLength(0);
  });

  it('adopts the server timestamp after push', async () => {
    const remote = new FakeRemote();
    const a = device(remote);
    a.local.write(T, { id: 'r1', updatedAt: 1 });
    await a.engine.push();
    expect((await a.local.getDoc(T, 'r1'))!.updatedAt).toBe(1001);
  });

  it('keeps edits made offline queued and delivers them later', async () => {
    const remote = new FakeRemote();
    const a = device(remote);
    const b = device(remote);

    a.local.write(T, { id: 'r1', updatedAt: 1, amount: 100 });
    remote.failNextPush = true;
    await expect(a.engine.push()).rejects.toThrow('network down');
    expect(a.local.outbox).toHaveLength(1);
    expect(a.local.outbox[0].attempts).toBe(1);

    a.local.write(T, { id: 'r1', updatedAt: 2, amount: 250 }); // offline edit
    await a.engine.push();
    await b.engine.pull([T]);

    expect(await b.local.getDoc(T, 'r1')).toMatchObject({ amount: 250 });
    expect(remote.docs.size).toBe(1); // two queued writes collapsed to one doc
  });

  it('propagates soft deletes', async () => {
    const remote = new FakeRemote();
    const a = device(remote);
    const b = device(remote);

    a.local.write(T, { id: 'r1', updatedAt: 1 });
    await a.engine.sync([T]);
    await b.engine.sync([T]);

    const doc = (await a.local.getDoc(T, 'r1'))!;
    a.local.write(T, { ...doc, deletedAt: 5000 });
    await a.engine.sync([T]);
    await b.engine.sync([T]);

    expect((await b.local.getDoc(T, 'r1'))!.deletedAt).toBe(5000);
  });

  it('last write wins: a pending local edit survives a newer remote doc and is logged', async () => {
    const remote = new FakeRemote();
    const conflicts: Conflict[] = [];
    const a = device(remote, conflicts);
    const b = device(remote);

    a.local.write(T, { id: 'r1', updatedAt: 1, note: 'base' });
    await a.engine.sync([T]);
    await b.engine.sync([T]);

    b.local.write(T, { ...(await b.local.getDoc(T, 'r1'))!, note: 'from B' });
    await b.engine.push();

    a.local.write(T, { ...(await a.local.getDoc(T, 'r1'))!, note: 'from A' });
    await a.engine.pull([T]); // sees B's change while A has a pending edit
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].resolution).toBe('local-kept-pending');

    await a.engine.sync([T]);
    await b.engine.sync([T]);
    expect(await b.local.getDoc(T, 'r1')).toMatchObject({ note: 'from A' });
    expect(await a.local.getDoc(T, 'r1')).toMatchObject({ note: 'from A' });
  });

  it('does not re-apply its own pushed docs', async () => {
    const remote = new FakeRemote();
    const a = device(remote);
    a.local.write(T, { id: 'r1', updatedAt: 1 });
    await a.engine.push();
    expect(await a.engine.pull([T])).toBe(0);
  });

  it('pulls incrementally using lastPulledAt', async () => {
    const remote = new FakeRemote();
    const a = device(remote);
    const b = device(remote);

    a.local.write(T, { id: 'r1', updatedAt: 1 });
    await a.engine.sync([T]);
    expect(await b.engine.pull([T])).toBe(1);
    expect(await b.engine.pull([T])).toBe(0);

    a.local.write(T, { id: 'r2', updatedAt: 2 });
    await a.engine.sync([T]);
    expect(await b.engine.pull([T])).toBe(1);
  });

  it('pushes in batches', async () => {
    const remote = new FakeRemote();
    const local = new FakeLocal();
    const engine = new SyncEngine(local, remote, { batchSize: 2 });
    for (let i = 0; i < 5; i++) local.write(T, { id: `r${i}`, updatedAt: i });
    expect(await engine.push()).toBe(5);
    expect(remote.docs.size).toBe(5);
  });

  it('purges tombstones older than 90 days only', async () => {
    const now = 10 * TOMBSTONE_TTL_MS;
    const local = new FakeLocal();
    const engine = new SyncEngine(local, new FakeRemote(), { now: () => now });
    await local.putDoc(T, { id: 'old', updatedAt: 1, deletedAt: now - TOMBSTONE_TTL_MS - 1 });
    await local.putDoc(T, { id: 'recent', updatedAt: 1, deletedAt: now - 1000 });
    await local.putDoc(T, { id: 'live', updatedAt: 1 });

    expect(await engine.purgeTombstones()).toBe(1);
    expect(await local.getDoc(T, 'old')).toBeNull();
    expect(await local.getDoc(T, 'recent')).not.toBeNull();
    expect(await local.getDoc(T, 'live')).not.toBeNull();
  });
});
