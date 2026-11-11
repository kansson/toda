# Sync

How lists and tasks move between the phone and Convex. The phone is the source of what the user
sees; the server is the meeting point of phones.

## On the phone (`apps/mobile/src/data`)

- **Collections.** TanStack DB mirrors two Convex queries: `lists.mine` (every list) and
  `tasks.page` (every task, paginated so a change re-sends one page of 250 rather than all of
  them). Rows are keyed by `clientId`, a UUID made on the phone, so a row exists before the
  server has seen it; references (`listId`, `parentId`, `seriesId`) use client ids too.
- **Optional fields.** A subtask's `cadence` is optional on the server, so rows written before it
  existed, and by app versions that never set it, stay valid; the app reads a missing one as null.
- **Persistence.** Both collections are wrapped in `persistedCollectionOptions` over expo-sqlite
  (`toda-cache.db`), so the app opens offline with everything in it. Raising `SCHEMA_VERSION` in
  `db.ts` drops the copy and syncs it again.
- **Writes.** Every write is an offline action (`actions.ts`) from
  `@tanstack/offline-transactions`: applied to the collections at once, kept in an outbox
  (`toda-outbox.db`) and sent in order as one call to `sync.apply` once the Convex connection is
  up (`online.ts`). A write the server refuses is undone on the phone with a snackbar; one refused
  for want of a session waits until the phone is signed in.
- **One copy per runtime.** `shared-db.ts` opens the data once for the screens and for work
  without them, such as a reminder's Done tapped while the app is closed.

## On the server (`apps/backend/convex`)

- `sync.apply` takes an idempotency key and a list of inserts, updates and deletes, and applies
  them all or none. A receipt per key makes a replay after a lost answer a no-op, and inserts are
  upserts by `clientId`. Updates carry only changed fields; an update of a deleted row does
  nothing, so a delete always wins.
- Each write is validated (lengths, real dates, times only with a date, repeat rules and subtask
  cadences), and once the batch is applied, relationships are checked: a task's list exists, and
  a subtask's parent is a top-level task in the same list. Deleting a task deletes its subtasks; deleting a list its
  tasks; the default list cannot be deleted.
- An account holds at most 1000 lists and 10,000 tasks, counted as they change.
- A daily cron prunes receipts older than 90 days and expired pairing codes.

## Accounts (`auth.ts`, `@convex-dev/auth` 2.0)

- `signInWithDevice` signs in with the phone's 256-bit credential (stored hashed as the account
  identity) and creates the account with its default list the first time.
- `signInWithPairingCode` joins another account with a fresh credential; the code is stored
  hashed, works once and expires in ten minutes.
- Queries throw while signed out rather than answering with nothing, which would clear the copy
  on the phone.
- A deployment needs `AUTH_PRIVATE_KEY` (a base64 PKCS#8 RS256 key) and `AUTH_JWKS` (its public
  JWKS) in its environment; the JWKS is served under `/auth`.

## Servers

- No deployment is built into a preview or production app: whoever installs it deploys
  `apps/backend` to a Convex account of their own and enters its address on the phone (see the
  README). The address is kept on the phone (`server.ts`, in `expo-sqlite/kv-store`) and the
  Convex client is made for it (`client.ts`).
- A development build starts on `EXPO_PUBLIC_CONVEX_URL`, or else the `CONVEX_URL` that
  `convex dev` wrote to `apps/backend/.env.local` (`config/backend.ts`).
- Moving to another server closes the screens, deletes the copy and the outbox, which belong to
  the old account, and opens on the new server (`switchServer` in `shared-db.ts`).
- Functions are deployed by hand with `vp run backend:deploy`, using the Convex CLI's login; no
  workflow holds a deploy key. `vp run backend:keys` (with `--prod` for production) sets
  `AUTH_PRIVATE_KEY` and `AUTH_JWKS`.
