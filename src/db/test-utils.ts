import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

import { uuidv7 } from '@/domain/uuid';

import type { RepoContext } from './repository';
import * as schema from './schema';
import type { Db } from './types';

/** Fresh in-memory SQLite with all migrations applied. Node-only; used by tests. */
export function createTestDb(): Db {
  const db = drizzle(new Database(':memory:'), { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });
  return db as unknown as Db;
}

export function createTestContext(startAt = 1_000_000): RepoContext & { tick: (ms: number) => void } {
  let clock = startAt;
  let n = 0;
  return {
    db: createTestDb(),
    now: () => clock,
    newId: () => uuidv7(clock, (len) => new Uint8Array(len).fill(++n % 256)),
    tick: (ms) => {
      clock += ms;
    },
  };
}
