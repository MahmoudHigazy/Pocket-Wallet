# Pocket Wallet

Personal finance app replacing BudgetBakers Wallet. Two things Wallet doesn't do: every EGX-listed company in investments, and reliable automatic expense logging (bank SMS, Apple Pay, one-tap shortcut).

Full phased plan: `docs/PLAN.md`. Work phase by phase; each phase ends with a demoable build and passing checks.

## Stack
- React Native + Expo SDK 58, TypeScript (strict), Expo Router, **development build** (not Expo Go)
- iOS primary; keep Android buildable but don't target it in v1
- Local-first: SQLite (expo-sqlite + Drizzle ORM) is the source of truth; Firebase (Auth, Firestore, Cloud Functions) syncs
- Jest (ts-jest) for `src/domain`

## Repo layout
```
src/app/         Expo Router screens only
src/domain/      pure TS, NO React/Expo imports, fully unit-tested
                 (money, parsing/, budgets, reports, investments, import/wallet-csv)
src/db/          Drizzle schema, migrations, repositories
src/sync/        outbox, pull/push, conflict resolution
src/services/    firebase client, price service, fx service
src/components/  shared UI
functions/       Firebase Cloud Functions (TypeScript)
shortcuts/       exported .shortcut files + setup guide
```

## Commands
- Add packages with `npx expo install` (never plain npm/yarn install for Expo deps)
- On a blank template, run `npx expo install react-dom` first or other installs won't resolve
- Quality gate, must pass before finishing any phase: `npx tsc --noEmit`, `npx expo lint`, `npx jest`

## Hard rules
- **Money is integer minor units.** Never floats for stored amounts. Record amounts are always positive; `type` carries direction. EGP has 2 decimals. Base currency is EGP, user-configurable.
- Every table has `id` (UUID v7), `createdAt`, `updatedAt`, `deletedAt` (soft delete), `version`.
- Writes go to SQLite **and** an outbox row in the same transaction. UI never waits on the network.
- Sync conflicts: last-write-wins per document by server timestamp; log conflicts. Tombstones purged after 90 days.
- `src/domain` must not import React or Expo. Parsing code is shared with Cloud Functions.
- Every migration is reversible and tested; back up SQLite before migrating.
- Every bank SMS parser template has fixtures and tests. Unknown formats go to the Inbox, never dropped.
- Auto-logging goes through the Cloud Function `POST /ingest` with a per-user, rotatable ingest token (not a Firebase ID token).
- Never log full SMS text in Functions logs. Raw SMS lives only in the user's own Firestore space.
- No analytics SDKs in v1.
- Price data goes through a pluggable `PriceProvider` interface; manual price override always allowed.

## Conventions
- Match surrounding code style, naming and comment density.
- Pick one charting library and wrap it behind a shared component.
- Real SMS fixtures must be redacted (no card numbers, names, balances that identify the user).

## Inputs still needed from Higazy
- Phase 2: a real Wallet CSV export (to lock column mapping)
- Phase 3: banks/cards and 5-10 redacted sample SMS per bank (purchase, refund, ATM, incoming transfer)
- Phase 5: Thndr holdings snapshot (symbol, quantity, average cost)
- Firebase project and Apple Developer account
