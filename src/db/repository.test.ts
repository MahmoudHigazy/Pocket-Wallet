import { createDoc, deleteDoc, updateDoc } from './repository';
import { SqliteLocalStore } from './sqlite-local-store';
import { createTestContext } from './test-utils';

const account = { name: 'CIB', type: 'bank', currency: 'EGP', initialBalance: 0 };

describe('repository', () => {
  it('writes the row and an outbox entry together', async () => {
    const ctx = createTestContext();
    const store = new SqliteLocalStore(ctx.db);
    const doc = createDoc(ctx, 'accounts', account);

    expect(await store.getDoc('accounts', doc.id)).toMatchObject({ name: 'CIB', version: 1 });
    const outbox = await store.readOutbox(10);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ table: 'accounts', docId: doc.id, op: 'upsert' });
  });

  it('rolls back the row when the outbox write fails', () => {
    const ctx = createTestContext();
    // Violate a NOT NULL on the row insert: nothing should be left behind.
    expect(() => createDoc(ctx, 'accounts', { name: 'bad' })).toThrow();
    const store = new SqliteLocalStore(ctx.db);
    return expect(store.readOutbox(10)).resolves.toHaveLength(0);
  });

  it('update bumps version and updatedAt and keeps createdAt', async () => {
    const ctx = createTestContext();
    const doc = createDoc(ctx, 'accounts', account);
    ctx.tick(500);
    const updated = updateDoc(ctx, 'accounts', doc.id as string, { name: 'CIB Main' });

    expect(updated).toMatchObject({ name: 'CIB Main', version: 2, createdAt: doc.createdAt });
    expect(updated.updatedAt).toBe(doc.updatedAt + 500);
  });

  it('delete is soft and queued as a delete op', async () => {
    const ctx = createTestContext();
    const store = new SqliteLocalStore(ctx.db);
    const doc = createDoc(ctx, 'accounts', account);
    ctx.tick(10);
    deleteDoc(ctx, 'accounts', doc.id as string);

    expect((await store.getDoc('accounts', doc.id as string))!.deletedAt).not.toBeNull();
    const outbox = await store.readOutbox(10);
    expect(outbox.map((o) => o.op)).toEqual(['upsert', 'delete']);
  });

  it('round-trips JSON array columns', async () => {
    const ctx = createTestContext();
    const store = new SqliteLocalStore(ctx.db);
    const doc = createDoc(ctx, 'accounts', { ...account, cardLast4: ['1234', '5678'] });
    expect((await store.getDoc('accounts', doc.id))!.cardLast4).toEqual(['1234', '5678']);
  });
});
