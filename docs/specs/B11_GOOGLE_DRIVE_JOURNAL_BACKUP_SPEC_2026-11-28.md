# B11 Google Drive Journal Backup (Initial Local Export)

Date: 2026-11-28
Status: implementation candidate, requires owner browser acceptance.

## Scope
- Adds Google Identity Services token flow for the existing Google OAuth Web Client ID.
- Adds Google Picker folder selection using the configured API key and Cloud project number.
- Stores only the selected Drive folder ID/name in browser localStorage. OAuth access tokens remain in memory only.
- Uploads a timestamped JSON snapshot of the currently loaded local journal to the selected Drive folder using the Drive API.
- Upload is append-only: each click creates a new timestamped file. It does not overwrite or delete prior backups.
- Does not clear, compact, or mutate the local journal.
- Does not request or embed an OAuth client secret or service-role key.

## Explicit limitation
This is a local-browser journal backup, not a Supabase cloud archive. B10 Supabase sign-in is still not a journal sync implementation. Supabase records must not be represented as included until cloud push/pull is implemented and verified.

## Required Google Cloud configuration
- Google Picker API enabled.
- Google Drive API enabled.
- OAuth Web Client ID authorized JavaScript origin includes `https://rinatrakhimgulov-bit.github.io`.
- OAuth consent screen includes the owner as a test user while app is in Testing.
- OAuth scope: `https://www.googleapis.com/auth/drive.file`.
- API key application restrictions must include both the app origin `https://rinatrakhimgulov-bit.github.io/*` and `https://docs.google.com/*`.
- API key API restrictions must include Google Picker API and Google Drive API.

## Acceptance tests
1. Open the GitHub Pages candidate on iPhone Safari.
2. Select the manually created `Crypto Analyst` folder in Google Picker.
3. Confirm selected folder name appears in the app.
4. Upload backup and verify the timestamped JSON file appears in that Drive folder.
5. Download the Drive file and validate JSON format and record counts.
6. Confirm a second upload creates a separate file.
7. Confirm local journal entries remain unchanged.
8. Repeat on desktop browser.
9. Test cancelled Picker, OAuth denial, offline/network error, and expired token behavior.

## Safety
- Never put OAuth client secret, Supabase service-role key, or other server secret in this HTML.
- Do not delete Supabase rows or local journal data as part of backup.
- Do not call the backup a cloud archive until it exports verified Supabase rows.
