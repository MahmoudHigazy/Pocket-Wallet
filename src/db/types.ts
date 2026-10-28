import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/** Any synchronous Drizzle SQLite db: expo-sqlite on device, better-sqlite3 in tests. */
export type Db = BaseSQLiteDatabase<'sync', any, typeof schema>;
