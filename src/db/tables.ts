import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import * as schema from './schema';

/** Tables mirrored to Firestore, keyed by collection name. */
export const syncTables = {
  accounts: schema.accounts,
  categories: schema.categories,
  labels: schema.labels,
  payees: schema.payees,
  records: schema.records,
  rules: schema.rules,
  budgets: schema.budgets,
  inbox_items: schema.inboxItems,
  instruments: schema.instruments,
  trades: schema.trades,
  dividends: schema.dividends,
  prices: schema.prices,
  fx_rates: schema.fxRates,
} as const;

export type SyncTableName = keyof typeof syncTables;

export const syncTableNames = Object.keys(syncTables) as SyncTableName[];

export function tableFor(name: string): SQLiteTable & { id: any; deletedAt: any } {
  const t = (syncTables as Record<string, unknown>)[name];
  if (!t) throw new Error(`Unknown sync table: ${name}`);
  return t as SQLiteTable & { id: any; deletedAt: any };
}
