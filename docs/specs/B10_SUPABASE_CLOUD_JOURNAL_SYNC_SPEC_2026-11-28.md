# B10 — Supabase Cloud Journal Sync

Date: 2026-11-28  
Status: B10-A browser auth bootstrap added on the B10 branch; static syntax checks passed; live OAuth acceptance is pending. Database sync is not implemented.  
Branch: `feature/b10-supabase-journal-sync-2026-11-28`  
Parent: B9 candidate head `28b7101bdd0ba999ff7396c49d07215ccb4fd911`.

## Objective

Make the Market Journal available on the owner's iPhone and PC through the owner's Supabase project. Supabase is the durable cross-device source of truth. The existing browser journal remains recoverable and must not be overwritten during migration.

This is foreground synchronization while the app is open. It does not provide background collection while the page is closed. That requires a separately deployed server-side collector and is deferred.

## Verified Supabase baseline (2026-11-28)

Project: `Crypto-Analyst-Database`, ref `ktqsaunwinmrsgrgojzf`, region `eu-central-1`, status `ACTIVE_HEALTHY`.

Applied migrations:
- `20261128081721_journal_cloud_foundation_v1`
- `20261128081746_journal_record_types_align_b9_v1`

Tables:
- `public.journal_records`: RLS enabled; append-only authenticated INSERT and owner-scoped SELECT; unique key on `(user_id, record_key)`.
- `public.journal_devices`: RLS enabled; owner-scoped SELECT/INSERT/UPDATE.
- `public.journal_import_batches`: RLS enabled; owner-scoped SELECT/INSERT.

Verified policies use `auth.uid() = user_id`. Table grants are present for `authenticated`; no `anon` grants were found. All three tables currently contain zero rows. Security Advisor returned no lints. No Edge Functions exist yet.

A modern `sb_publishable_` key exists. It is intended for browser use and may be embedded in the client. Never embed a Supabase secret key or legacy service-role key.

## Authentication decision

The owner previously preferred GitHub sign-in inside Crypto Analyst. Implement Supabase Auth GitHub OAuth as the primary sign-in flow, but do not assume the repository's installed GitHub App is an OAuth application. The owner must configure a GitHub OAuth App's Client ID/Secret in Supabase Auth Providers and allow the deployed app's exact redirect URL in Supabase Auth URL Configuration.

The Dashboard's GitHub connection, ChatGPT's Supabase connector, and the app's Supabase Auth session are separate identities/sessions. Never treat Dashboard login as an app user session.

Do not create a user through admin credentials or insert directly into `auth.users`. Do not bypass Auth/RLS. A successful app sign-in must return a real Supabase Auth user ID; every device must sign in as the same user to share the same journal.

## Record mapping

Keep the B5/B9 JSON record objects unchanged inside `journal_records.payload`.

| Existing journal array | record_type | recorded_at_ms |
| --- | --- | --- |
| `observations` | `observation` | `capturedAtMs` |
| `followups` | `followup` | `recordedAtMs` |
| `actualTrades` | `actual_trade` | `recordedAtMs` |

- `record_key` is the stable record `id` string.
- `schema_version` is the record's `schemaVersion`.
- `device_id` is a stable UUID generated once per browser installation and stored separately from the journal payload.
- `user_id` must be supplied by the authenticated session or database default; client code must never accept an arbitrary owner ID.
- The record payload remains immutable. No UPDATE or DELETE is required for `journal_records`.

## Sync contract

1. On app startup, initialize the Supabase client and restore the existing local journal exactly as B9 does.
2. If signed out, keep local-only behavior and show that cloud sync is not active.
3. If signed in, register/update the current device in `journal_devices`.
4. Push local records using INSERT with conflict-ignore on `(user_id, record_key)`; do not use UPDATE/upsert for immutable journal records. A duplicate key is idempotent only after verifying that the existing remote record has the same type and payload; conflicting content for one record ID is a hard sync error.
5. Pull the user's cloud records with pagination. RLS must enforce ownership. Never query using a client-supplied user ID filter as the security boundary.
6. Merge by stable record ID. If an ID exists locally and remotely with different canonical payloads, stop and surface a conflict; do not silently overwrite either copy.
7. Keep the existing JSON export/import as an independent recovery route. Add a full-cloud export path so a local cache limit cannot silently truncate a user's archive.
8. Update last-sync state only after push, pull, merge, and local persistence have all completed and been verified.
9. Reconnect and retry safely after offline periods. No silent record deletion or lossy pruning of unsynced records.

## Storage and quota requirements

B9 currently writes a bounded envelope to localStorage and rejects serialized payloads above 3.8 MB. The owner has already encountered iPhone localStorage quota failures. Therefore, simply downloading the entire cloud journal into the existing localStorage envelope is prohibited.

Before implementation, design and test:
- a durable offline outbox (prefer IndexedDB) for records not yet acknowledged by Supabase;
- a bounded local display/cache strategy that does not lose cloud history;
- full-archive export from Supabase, including pagination;
- safe migration of existing localStorage records, with export/backup and read-back verification before any cleanup;
- storage failures that do not break chart rendering or analysis.

Do not delete or clear `cryptoAnalyst.marketJournal.v1` during migration. Do not silently change the B5/B9 JSON envelope version.

## UI scope

Minimal additions only; the larger UX redesign remains deferred:
- sign-in / sign-out state;
- cloud sync state (signed out, syncing, synced, offline, error);
- last successful sync time;
- manual "Sync now" control;
- clear indication whether the visible journal is local cache or includes cloud history.

No visual redesign, no trade execution, and no new analysis gates.

## Security requirements

- Use the modern publishable key only in the browser.
- Never expose service-role/secret keys, database passwords, OAuth client secrets, or management tokens in HTML, GitHub, or chat artifacts.
- Authenticated users only. No anonymous access to journal tables.
- Preserve owner-scoped RLS; test cross-user isolation.
- Do not add broad SELECT/INSERT grants to `anon`.
- No privileged Edge Function is needed for ordinary journal sync. If a later server-side worker is added, authenticate and authorize it separately.

## Required tests

1. Signed-out app still works in local-only mode.
2. GitHub OAuth sign-in and return URL work on iPhone Safari and desktop browser.
3. Same Supabase Auth user on both devices sees the same cloud journal.
4. A record created on device A appears on device B after sync/reload.
5. Device B's record appears on device A after sync.
6. Duplicate sync does not create duplicate rows.
7. Same ID with different payload produces a visible conflict and preserves both source copies for recovery.
8. RLS prevents a second authenticated user from reading or inserting into the first user's journal.
9. Offline-created records remain queued and sync after reconnection.
10. iPhone quota pressure does not destroy or block the cloud archive.
11. Existing localStorage export/import and B5/B9 browser tests remain green.
12. Full-cloud export includes records beyond the local display/cache window.
13. No chart/analysis regression and zero uncaught browser errors.

## Required owner actions before live acceptance

- Configure a GitHub OAuth App in Supabase Auth Providers (unless one is already configured and verified).
- Confirm the exact deployed app URL so redirect allow-list entries are exact.
- Export the current iPhone journal JSON before first cloud migration. The existing local records are not accessible to repository CI or the ChatGPT Supabase database connector.
- Sign in on iPhone and PC with the same GitHub identity, then perform cross-device acceptance tests.

## Implementation order

B10-A: auth configuration audit and client bootstrap, no database writes.  
B10-B: device registration and append-only record push.  
B10-C: paginated cloud pull, conflict detection, and bounded cache/outbox.  
B10-D: legacy local journal migration and full-cloud export.  
B10-E: cross-device, offline, quota, and RLS verification.

Do not merge B10 or change production `main` until exact-head CI and owner iPhone/desktop acceptance pass.


## B10-A implementation checkpoint — 2026-11-28

The B10 candidate HTML now includes a minimal GitHub sign-in/sign-out panel in the journal and initializes Supabase Auth using the pinned UMD CDN build `@supabase/supabase-js@2.119.2`. It uses the project's modern `sb_publishable_` key only; no service-role or secret key is embedded. The client is configured for persisted sessions, token refresh, URL session detection and PKCE. The OAuth return target is the current HTTPS application URL with transient query/hash removed.

This is auth bootstrap only. It does not read or write `journal_records`, register devices, push/pull records, or alter the B9 local journal. The UI explicitly reports that journal sync is not yet connected. Sign-in is disabled on non-HTTPS origins. Signing out does not clear local journal data.

Static verification on commit `683529dc10a2495bf2b310d2fe464f3cc7e3a4bd`: all 3 inline script blocks parsed successfully; expected auth UI and OAuth call are present; no service-role/secret key markers and no journal database write calls were found. No GitHub Actions workflow run was returned for this commit. Real iPhone OAuth, callback persistence, Supabase provider configuration and session restoration remain unverified.

The currently published GitHub Pages file still comes from `main` and was verified to contain neither the B9 journal implementation nor Supabase Auth. The B10 branch is not yet the published application. Do not treat the currently open Pages build as a B10 test.
