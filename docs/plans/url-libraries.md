# Plan: URL-Configurable Public Libraries

## Goal

Replace the hardcoded GCS bucket as the source of "Public_Network" archives with a configurable base URL.
The app fetches `{baseUrl}/manifest.json` to discover transmissions, then fetches individual files from the same base.
By default the base URL points to the same domain (local site), so JSON files can be served as plain static assets.
Users (or operators) can override the base URL at runtime by pasting any URL into a settings field.

---

## How It Works (After This Change)

```
baseUrl = localStorage.get('technoir_archive_url') ?? '/archives'

manifest  → GET {baseUrl}/manifest.json
file      → GET {baseUrl}/{manifest[i].filename}
```

The manifest format stays exactly the same (`CloudManifestItem[]`).
Individual transmission files can be plain `.json` or `.json.gz` — the existing decompression logic is kept.

---

## TODO

### 1. Add default archive path to `constants.tsx`

- [x] Remove `GCS_BUCKET_NAME` and `GCS_MANIFEST_FILE` constants (no longer needed).
- [x] Add `DEFAULT_ARCHIVE_URL = '/archives'` — the default base URL pointing to the local site's static folder.
- [x] Add `ARCHIVE_URL_STORAGE_KEY = 'technoir_archive_url'` — the localStorage key used to persist a custom URL.

---

### 2. Refactor `services/cloud.ts` → `services/archive.ts`

- [x] Rename the file to `archive.ts` to reflect it's no longer GCS-specific.
- [x] Remove `getPublicUrl` helper that built GCS URLs.
- [x] Add a `getArchiveBaseUrl()` helper that reads from `localStorage.getItem(ARCHIVE_URL_STORAGE_KEY)`, falling back to `DEFAULT_ARCHIVE_URL`. Strips trailing slashes for consistency.
- [x] Update `fetchCloudManifest` → `fetchArchiveManifest(baseUrl?: string)`:
  - Accepts an optional `baseUrl` override (for the "test URL before saving" UX).
  - Builds URL as `` `${baseUrl}/manifest.json?t=${Date.now()}` ``.
  - Returns `CloudManifestItem[]` (type unchanged).
- [x] Update `fetchCloudTransmission` → `fetchArchiveTransmission(filename: string, baseUrl?: string)`:
  - Builds URL as `` `${baseUrl}/${filename}` ``.
  - Keeps the existing `.gz` / `DecompressionStream` branch unchanged.
- [x] Remove all OAuth / write operations that were in this file (they were already read-only; just confirm nothing remains).

---

### 3. Add archive JSON files to `public/archives/`

- [x] Create folder `public/archives/` in the repo.
- [x] Add a `public/archives/manifest.json` with an empty array `[]` as the initial placeholder.
- [x] Document in `public/archives/README.md` that operators drop `<id>.json` files here and add entries to `manifest.json` to populate the public library.
- [x] Add `public/archives/*.json` to `.gitignore` if transmission files should not be committed (leave `manifest.json` tracked).

---

### 4. Add archive URL state to `App.tsx`

- [x] Add state: `const [archiveUrl, setArchiveUrl] = useState<string>(() => localStorage.getItem(ARCHIVE_URL_STORAGE_KEY) ?? DEFAULT_ARCHIVE_URL)`.
- [x] Update `loadCloudArchives` to call `fetchArchiveManifest(archiveUrl)` instead of `fetchCloudManifest()`.
- [x] Update `handleCloudLoad` to call `fetchArchiveTransmission(filename, archiveUrl)` instead of `fetchCloudTransmission(filename)`.
- [x] Update the import from `./services/cloud` → `./services/archive`.

---

### 5. Add URL configuration UI in the Public_Network tab

Place a small configuration row just below the "Featured Transmissions (Read Only)" label, above the archive list.

- [x] Show the current `archiveUrl` as a truncated read-only label (e.g. `SOURCE: /archives`).
- [x] Add a `[ Configure ]` button that expands an inline input field.
- [x] The input field shows the current URL and accepts a new one.
- [x] On confirm:
  1. Trim and strip trailing slash from the input.
  2. Attempt to fetch `{newUrl}/manifest.json` as a validation step.
  3. If successful: save to `localStorage`, update `archiveUrl` state, reload the archive list, collapse the input.
  4. If it fails: show an inline error (`"Could not reach manifest at that URL"`) without saving.
- [x] Add a `[ Reset ]` button that restores `DEFAULT_ARCHIVE_URL` and clears the localStorage key.
- [x] While validation fetch is in progress, show a small spinner / disabled state on the confirm button.

---

### 6. Update `index.html` / Vite config (if needed)

- [x] Verify that Vite's dev server serves files from `public/` at the root path — it does by default, so `/archives/manifest.json` will work in dev without changes.
- [x] Verify that the production build copies `public/archives/` into `dist/archives/` — confirmed (`dist/archives/manifest.json` present after build).
- [x] No changes to `vite.config.ts` are expected.

---

### 7. Cleanup

- [x] Remove the `GCS_BUCKET_NAME` and `GCS_MANIFEST_FILE` imports from everywhere they're used.
- [x] Search for any remaining `storage.googleapis.com` references and remove them.
- [x] Update `CLAUDE.md` to reflect the new architecture:
  - Replace the GCS read-only section with the archive URL approach.
  - Note the `public/archives/` folder convention.

---

## Files Touched

| File | Change |
|---|---|
| `constants.tsx` | Replace GCS constants with `DEFAULT_ARCHIVE_URL` + `ARCHIVE_URL_STORAGE_KEY` |
| `services/cloud.ts` → `services/archive.ts` | Full rewrite: URL-based, no GCS SDK |
| `App.tsx` | New state + updated calls + URL config UI |
| `public/archives/manifest.json` | New file (empty array placeholder) |
| `public/archives/README.md` | New file (operator instructions) |
| `.gitignore` | Ignore `public/archives/*.json` / `*.json.gz`, track manifest + README |
| `CLAUDE.md` | Update architecture notes |

---

## Out of Scope

- Writing/uploading transmissions to a remote URL (the public library remains read-only).
- Multiple simultaneous libraries / tabs.
- Authentication for private archive URLs.
