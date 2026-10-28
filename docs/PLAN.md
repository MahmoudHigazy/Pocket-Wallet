# Pocket Wallet — Implementation Plan

A personal finance app replacing BudgetBakers Wallet, with two fixes Wallet doesn't offer:

1. **Every EGX-listed company** (everything tradable on Thndr) in the investments module.
2. **Reliable automatic expense logging** from bank SMS, Apple Pay taps, and a one-tap shortcut.

This document is the hand-off brief for Claude Code. Work phase by phase; each phase ends with a demoable build and passing checks.

---

## 1. Decisions (locked)

| Area | Decision |
|---|---|
| App | React Native + **Expo SDK 58** (TypeScript, Expo Router, development build — not Expo Go) |
| Primary platform | iOS (Shortcuts automations are iOS-only). Keep Android buildable but don't target it in v1. |
| Data | **Local-first**: SQLite on device is the source of truth; Firebase syncs across devices |
| Backend | Firebase: Auth, Firestore (sync), Cloud Functions (ingest endpoint, price fetcher) |
| Auto-logging triggers | Bank SMS, Apple Pay "Transaction" automation, manual quick-add |
| v1 scope | Accounts/records/categories, budgets & reports, EGX investments, import from Wallet |

---

## 2. Architecture

```
iPhone
 ├─ Shortcuts automations ──HTTPS──► Cloud Function /ingest ──► Firestore (inbox)
 │   (SMS, Apple Pay, Quick-add)                                    │
 └─ Expo app                                                        │
     ├─ UI (Expo Router screens)                                    │
     ├─ Domain layer (pure TS: money, parsing, budgets, P&L)        │
     ├─ SQLite (expo-sqlite + Drizzle ORM) ◄── Sync engine ◄────────┘
     └─ Price service ◄── Firestore `prices/` ◄── scheduled Function (EGX quotes)
```

### Why auto-logging goes through a server endpoint
Wallet's shortcut is unreliable because it depends on the app being launched or woken up. Here, the Shortcut makes a single **"Get Contents of URL" POST** to a Cloud Function. That runs fully in the background, doesn't open the app, and can't silently fail because the app was killed. The app picks the item up on its next sync.

- Phase 6 (optional) adds a native **App Intent** for offline logging. It's not on the critical path.
- Auth for the endpoint is a per-user secret ingest token stored in the shortcut, which can be revoked and rotated in Settings. Don't use the Firebase ID token, because Shortcuts can't refresh it.

### Repo layout
```
src/app/            Expo Router screens only
src/domain/         pure TS, no React/Expo imports — 100% unit-tested
  money.ts          integer minor units, currency math, FX conversion
  parsing/          SMS + Apple Pay parsers, per-bank templates
  budgets.ts  reports.ts  investments.ts  import/wallet-csv.ts
src/db/             Drizzle schema, migrations, repositories
src/sync/           outbox, pull/push, conflict resolution
src/services/       firebase client, price service, fx service
src/components/     shared UI
functions/          Firebase Cloud Functions (TypeScript)
shortcuts/          exported .shortcut files + setup guide
```

---

## 3. Data model (SQLite, mirrored to Firestore under `users/{uid}/…`)

Every table has these columns: `id` (UUID v7), `createdAt`, `updatedAt`, `deletedAt` (soft delete), `version`.

- **accounts**: name, type (`cash | bank | credit_card | savings | loan | investment | wallet`), currency, initialBalance, color/icon, archived, excludeFromStats, cardLast4[] (used to route SMS/Apple Pay)
- **categories**: name, parentId (2 levels, like Wallet), type (`expense | income`), icon/color. Seed with Wallet's default taxonomy so imports map cleanly.
- **records**: accountId, type (`expense | income | transfer`), amount (**integer minor units**, always positive), currency, refAmount (in base currency at the record date's FX rate), categoryId, payee, note, date, labels[], paymentType, status (`cleared | pending`), transferId (links both legs), source (`manual | sms | applepay | quickadd | import`), sourceRef (raw SMS hash / import row id), attachmentUris[]
- **labels**, **payees** (with default category → used to learn categories)
- **rules**: match (payee/merchant regex, sender, cardLast4) → set (category, account, labels)
- **budgets**: name, period (`week | month | year | custom`), amount, currency, categoryIds[], accountIds[], labelIds[], rollover
- **planned_payments** (Phase 6): template record + RRULE recurrence
- **debts**, **goals**, **shopping_lists** (Phase 6)
- **inbox_items**: raw text, parsed draft, confidence, status (`new | accepted | dismissed | duplicate`), linkedRecordId
- **instruments**: symbol (e.g. `COMI`), name (AR/EN), sector, currency (EGP), active
- **trades**: accountId, instrumentId, side (`buy | sell`), quantity, price, fees, date, note
- **dividends**: instrumentId, amount, date (cash dividends; stock splits as a separate `corporate_actions` table)
- **prices**: instrumentId, date, close, source (local cache of Firestore `prices/`)
- **fx_rates**: base, quote, date, rate

Money rules: never use floats for stored amounts. EGP has 2 decimals. The base/reference currency is EGP and is user-configurable.

---

## 4. Sync engine (local-first)

- Writes go to SQLite and to an **outbox** row in the same transaction. The UI never waits on the network.
- Push: drain the outbox in batches to Firestore with `updatedAt` = server timestamp.
- Pull: a Firestore listener per collection, using `updatedAt > lastPulledAt`, and upsert into SQLite.
- Conflicts: **last-write-wins per document** using server timestamp. Records are rarely edited concurrently, so this is fine for v1. Log conflicts for debugging.
- Deletes are soft (`deletedAt`) so they propagate. Purge tombstones after 90 days.
- Design the data model so a shared wallet can be added later (Phase 6): a `members` field on accounts and Firestore security rules per wallet group.

---

## 5. Phases

### Phase 0 — Foundation
- Expo SDK 58 project, Expo Router under `src/app/`, strict TS, ESLint, Jest (ts-jest) for `src/domain`.
  - Note: the blank template needs `npx expo install react-dom` before other installs resolve.
  - Always add packages with `npx expo install`.
- EAS development build profile for iOS.
- Drizzle + expo-sqlite schema and migrations.
- Firebase project with Sign in with Apple + Google, Firestore rules locked to `request.auth.uid`, and the Functions skeleton.
- Sync engine (section 4) with tests using a fake Firestore.
- **Done when:** a record created on one simulator appears on a second one, including after offline edits.

### Phase 1 — Core ledger (Wallet parity, daily-use)
- Accounts CRUD, balances (initial + Σ records), account reorder/archive.
- Record entry screen optimised for speed: amount keypad first, last-used account, category suggestions.
- Transfers: two linked legs, with cross-currency transfers storing both amounts.
- Categories (2-level), labels, payees, notes, receipt photo attachment.
- Records list: grouped by day, search, and filters (account, category, label, type, date range, amount range).
- Multi-currency: FX rates from a free provider via a scheduled Function, plus manual override.
- Settings: base currency, Face ID / PIN lock, export to CSV.
- **Done when:** you can run your real finances in it for a week.

### Phase 2 — Import from Wallet
- Source: Wallet web app → Records → Select all → **Export to CSV** (export is a Wallet premium feature).
- The parser must:
  - auto-detect the delimiter (Wallet commonly uses `;`)
  - map headers by name, not by position
  - handle the usual columns: `account, category, currency, amount, ref_currency_amount, type, payment_type, note, date, transfer, payee, labels`
  - **Verify against a real export file first**, since column names may differ by version or locale.
- Transfers export as two rows flagged `transfer`. Pair them by date, amount and opposite sign into one transfer.
- Map categories by name (from the seeded Wallet taxonomy) and auto-create unknown accounts, categories and labels.
- Import is idempotent (`sourceRef` = hash of the row) and can be run again safely.
- Show a dry-run preview before committing: counts, unmatched categories, balance check per account against Wallet.
- **Done when:** the imported per-account balances match Wallet exactly.

### Phase 3 — Automatic logging (the main fix)
**Cloud Function `POST /ingest`** with body `{ token, kind: "sms"|"applepay"|"quick", text?, amount?, merchant?, card?, sender?, at }`
- Validate the token, store the raw payload in `inbox_items`, run the parser server-side (shared code from `src/domain/parsing`), and return quickly.
- Rate-limit requests and never log the full SMS text to Functions logs.

**Parser (`src/domain/parsing`)**
- One template file per bank and sender ID. Templates are Arabic + English regexes that extract the amount, currency, card last4, merchant, debit/credit, and available balance when present.
- Start with the banks you actually use. The user will supply redacted sample SMS as test fixtures, and every template needs fixtures.
- Normalise Arabic-Indic digits and Arabic thousands/decimal separators.
- Ignore OTPs, promos and failed or declined transactions. Map refunds and reversals to income.
- Output a draft record plus a confidence score.

**Routing and categorisation**
- Use cardLast4 to pick the account, then apply rules (payee/merchant → category), then fall back to the payee's last-used category.

**De-duplication**
- An SMS and an Apple Pay automation fire for the same purchase. Treat items as duplicates when they have the same amount and card within a ±10 minute window; keep the richer one.

**Auto-commit policy**
- High-confidence items create records automatically, marked `pending`.
- Low-confidence items wait in an **Inbox** screen for one-tap accept, edit or dismiss.
- A badge plus a local notification on next app open tell you what was logged.

**Shortcuts (ship in `shortcuts/` with a setup guide)**
1. *SMS*: Automation "Message → Sender is <bank> → Run Immediately" → Get Contents of URL (POST).
2. *Apple Pay*: Automation "Transaction → cards → Run Immediately" → POST with Amount, Merchant, Card.
3. *Quick-add*: Ask for amount → choose category (from a list the app exposes via the endpoint) → POST. Bind it to the Action Button or Siri.

- **Done when:** a week of real purchases is logged with zero misses and zero duplicates. Every parser template has tests.

### Phase 4 — Budgets & reports
- Budgets: per period, filter by categories/accounts/labels, progress bar, projected end-of-period spend, and alerts at 80% and 100% (local notifications).
- Reports (Wallet's Statistics), all computed from SQLite in `src/domain/reports.ts`:
  - Balance trend: net worth over time, per account and in total.
  - Cash flow: income vs expense by month.
  - Spending by category: drill down into subcategories, with a comparison to the previous period.
  - Top payees and label breakdown.
  - Credit card overview: utilisation and statement-period spend.
- Charts: use a single charting library (e.g. victory-native or react-native-gifted-charts). Pick one and wrap it.
- **Done when:** the numbers match the same report in Wallet over your imported history.

### Phase 5 — Investments (EGX / Thndr)
**Instruments**
- Seed the full EGX listed-company list (symbol, AR/EN name, sector).
- A scheduled Function refreshes the list weekly so new listings appear automatically.

**Prices**
- A `PriceProvider` interface with a pluggable implementation.
- Candidate: the oanor EGX API, which has a free tier, multi-symbol quotes and data sourced via TradingView. **Verify its quota and reliability before relying on it**, because published free-tier limits are inconsistent.
- Paid fallback: EODHD, which covers EGX.
- Always allow a manual price override.
- A scheduled Function runs after market close (EGX trades Sun–Thu, 10:00–14:30 Cairo). It fetches quotes for the **union of held symbols in one batched call** and writes to `prices/`.

**Portfolio**
- Trades (buy/sell with fees), cash dividends, splits.
- The investment account cash balance is linked to the ledger, so a deposit to Thndr is a transfer from the bank.
- Thndr has no public API, so trades are entered manually.
- Stretch goal: parse Thndr's emailed trade confirmations through the same ingest pipeline.

**Metrics**
- Holdings: quantity, average cost, market value, unrealized P&L.
- Realized P&L (average-cost method), dividend income, and allocation by sector.
- Portfolio value feeds into net worth on the balance trend report.

**Later:** Thndr mutual funds and gold, using manual NAV entry.

- **Done when:** holdings and P&L match what the Thndr app shows for your portfolio.

### Phase 6 — Remaining Wallet features (prioritise after daily use)
- Planned and recurring payments with reminders.
- Debts: lent and borrowed, with partial repayments.
- Savings goals.
- Shopping lists.
- Record templates.
- Home-screen widgets: balance and quick-add.
- Shared wallet with family: per-account sharing and Firestore rules.
- Native App Intent for offline logging.
- Android SMS auto-read: Android can read SMS natively with permission.

---

## 6. Quality bar (every phase)
- `npx tsc --noEmit`, `npx expo lint`, and `npx jest` all pass.
- `src/domain` has **no** React/Expo imports and full test coverage for money, parsing, import, budgets, reports and P&L.
- No float money. Every migration is reversible-tested.
- Privacy: raw SMS is stored only in the user's own Firestore space. The ingest token can be rotated. No analytics SDKs in v1.

## 7. Inputs needed from Higazy before the relevant phase
- **Phase 2:** one real Wallet CSV export (can be a small date range) to lock the column mapping.
- **Phase 3:** the list of banks/cards and 5–10 redacted sample SMS per bank, covering purchase, refund, ATM withdrawal and incoming transfer.
- **Phase 5:** current Thndr holdings snapshot (symbol, quantity, average cost) to validate P&L.
- **Firebase:** create the project and an Apple Developer account for Sign in with Apple and EAS builds.

## 8. Risks
| Risk | Mitigation |
|---|---|
| Bank SMS formats change | Templates are data plus tests; unknown formats fall into the Inbox instead of being dropped |
| Free EGX price API disappears or throttles | `PriceProvider` interface, EODHD fallback, manual prices; batch calls keep usage low |
| iOS requires a tap for some automations | "Message" and "Transaction" automations support Run Immediately; quick-add is a fallback |
| Sync bugs corrupt data | Outbox pattern, soft deletes, and a local SQLite backup export before each migration |
