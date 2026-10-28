import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Columns shared by every synced table. Timestamps are epoch milliseconds.
const base = {
  id: text('id').primaryKey(), // UUID v7
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'), // soft delete so deletes propagate
  version: integer('version').notNull().default(1),
};

const json = <T>(name: string) => text(name, { mode: 'json' }).$type<T>();

export const accounts = sqliteTable('accounts', {
  ...base,
  name: text('name').notNull(),
  type: text('type', {
    enum: ['cash', 'bank', 'credit_card', 'savings', 'loan', 'investment', 'wallet'],
  }).notNull(),
  currency: text('currency').notNull(),
  initialBalance: integer('initial_balance').notNull().default(0), // minor units
  color: text('color'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  excludeFromStats: integer('exclude_from_stats', { mode: 'boolean' }).notNull().default(false),
  cardLast4: json<string[]>('card_last4').notNull().default([]),
  members: json<string[]>('members'), // reserved for shared wallets (Phase 6)
});

export const categories = sqliteTable('categories', {
  ...base,
  name: text('name').notNull(),
  parentId: text('parent_id'), // 2 levels max
  type: text('type', { enum: ['expense', 'income'] }).notNull(),
  icon: text('icon'),
  color: text('color'),
});

export const labels = sqliteTable('labels', {
  ...base,
  name: text('name').notNull(),
  color: text('color'),
});

export const payees = sqliteTable('payees', {
  ...base,
  name: text('name').notNull(),
  defaultCategoryId: text('default_category_id'),
});

export const records = sqliteTable(
  'records',
  {
    ...base,
    accountId: text('account_id').notNull(),
    type: text('type', { enum: ['expense', 'income', 'transfer'] }).notNull(),
    amount: integer('amount').notNull(), // minor units, always positive
    currency: text('currency').notNull(),
    refAmount: integer('ref_amount'), // base currency at the record date's FX rate
    categoryId: text('category_id'),
    payee: text('payee'),
    note: text('note'),
    date: integer('date').notNull(),
    labels: json<string[]>('labels').notNull().default([]),
    paymentType: text('payment_type'),
    status: text('status', { enum: ['cleared', 'pending'] }).notNull().default('cleared'),
    transferId: text('transfer_id'), // links both legs of a transfer
    source: text('source', { enum: ['manual', 'sms', 'applepay', 'quickadd', 'import'] })
      .notNull()
      .default('manual'),
    sourceRef: text('source_ref'), // SMS hash / import row hash, for idempotency
    attachmentUris: json<string[]>('attachment_uris').notNull().default([]),
  },
  (t) => [
    index('records_account_date_idx').on(t.accountId, t.date),
    index('records_source_ref_idx').on(t.sourceRef),
  ],
);

export const rules = sqliteTable('rules', {
  ...base,
  match: json<{ payeeRegex?: string; sender?: string; cardLast4?: string }>('match').notNull(),
  set: json<{ categoryId?: string; accountId?: string; labelIds?: string[] }>('set').notNull(),
});

export const budgets = sqliteTable('budgets', {
  ...base,
  name: text('name').notNull(),
  period: text('period', { enum: ['week', 'month', 'year', 'custom'] }).notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  categoryIds: json<string[]>('category_ids').notNull().default([]),
  accountIds: json<string[]>('account_ids').notNull().default([]),
  labelIds: json<string[]>('label_ids').notNull().default([]),
  rollover: integer('rollover', { mode: 'boolean' }).notNull().default(false),
});

export const inboxItems = sqliteTable('inbox_items', {
  ...base,
  kind: text('kind', { enum: ['sms', 'applepay', 'quick'] }).notNull(),
  rawText: text('raw_text'),
  draft: json<Record<string, unknown>>('draft'),
  confidence: real('confidence'),
  status: text('status', { enum: ['new', 'accepted', 'dismissed', 'duplicate'] })
    .notNull()
    .default('new'),
  linkedRecordId: text('linked_record_id'),
});

export const instruments = sqliteTable('instruments', {
  ...base,
  symbol: text('symbol').notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar'),
  sector: text('sector'),
  currency: text('currency').notNull().default('EGP'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

export const trades = sqliteTable('trades', {
  ...base,
  accountId: text('account_id').notNull(),
  instrumentId: text('instrument_id').notNull(),
  side: text('side', { enum: ['buy', 'sell'] }).notNull(),
  quantity: integer('quantity').notNull(),
  price: integer('price').notNull(), // minor units per share
  fees: integer('fees').notNull().default(0),
  date: integer('date').notNull(),
  note: text('note'),
});

export const dividends = sqliteTable('dividends', {
  ...base,
  instrumentId: text('instrument_id').notNull(),
  amount: integer('amount').notNull(),
  date: integer('date').notNull(),
});

export const prices = sqliteTable('prices', {
  ...base,
  instrumentId: text('instrument_id').notNull(),
  date: integer('date').notNull(),
  close: integer('close').notNull(), // minor units
  source: text('source').notNull(),
});

export const fxRates = sqliteTable('fx_rates', {
  ...base,
  baseCurrency: text('base_currency').notNull(),
  quoteCurrency: text('quote_currency').notNull(),
  date: integer('date').notNull(),
  rate: real('rate').notNull(), // rate is a ratio, not stored money
});

// Local-only sync plumbing (not mirrored to Firestore).
export const outbox = sqliteTable('outbox', {
  seq: integer('seq').primaryKey({ autoIncrement: true }),
  table: text('table').notNull(),
  docId: text('doc_id').notNull(),
  op: text('op', { enum: ['upsert', 'delete'] }).notNull(),
  payload: json<Record<string, unknown>>('payload').notNull(),
  createdAt: integer('created_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
});

export const syncState = sqliteTable('sync_state', {
  collection: text('collection').primaryKey(),
  lastPulledAt: integer('last_pulled_at').notNull().default(0),
});
