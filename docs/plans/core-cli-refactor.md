# Refactor Plan: Core Engine + CLI

## TODO

### Status

| Item | Status |
|---|---|
| Vitest + test infrastructure | ✅ Done |
| Phase 1 — Decouple API key (`core/generator.ts`) | ✅ Done |
| Phase 2 — `FileSystemStorage` adapter | ✅ Done |
| Phase 3 — `IndexedDbStorage` adapter | ✅ Done |
| Phase 4 — `services/gemini.ts` shim | ✅ Done |
| Phase 5 — CLI `generate` command (key/preset/output) | ✅ Done |
| Phase 6 — CLI `list` + `export` (plain JSON) | ✅ Done |
| Golden schema stability tests | ✅ Done |
| **Gap — `--no-images` flag wired + tested** | ✅ Done — 2 tests |
| **Gap — `formatTable` test** | ✅ Done — 3 tests |
| **Gap — `export --compress` (.json.gz)** | ✅ Done — 1 test |
| **Gap — `adapters/archive/` (IArchive, BrowserArchive, FileArchive)** | ✅ Done — 8 tests |
| **Gap — `adapters/ApiKeyProvider.ts`** | ✅ Done — 6 tests |
| **`--full` / lead-detail generation queue** | 🔜 Deferred — 73 tests green, no regressions |
| App.tsx cleanup (Phase 6 optional) | ⬜ Not started |

### Deferred: `--full` / Lead-Detail Queue

The `--full` CLI flag (trigger `generateLeadInspectionText` + `generateLeadImage` for all 36 leads) is **intentionally deferred**. Before exposing it the sequential loop in `generateFullTransmission` must be replaced with a **throttled promise queue** to stay within Gemini rate limits. Specifically:

- Extract a `runWithConcurrency(tasks, limit)` helper in `cli/utils/queue.ts`
- Default concurrency: 3 (configurable via `--concurrency <n>`)
- The `--full` flag enables lead-detail generation; without it only structure is produced
- Both the CLI and the browser's "Full Generate" button should share the same queue primitive

---

### 1. BDD + Golden Set — Red-Green-Refactor

This project uses strict **BDD red-green-refactor** cycles. No production code is written without a failing test driving it. The golden set provides the fixture data that makes those tests deterministic and Gemini-free.

#### The cycle, applied to every phase

```
RED     Write a BDD scenario that describes the desired behaviour.
        Run the suite — it must fail for the right reason.

GREEN   Write the minimum production code that makes it pass.
        No polish, no extras. Just green.

REFACTOR  Clean up the implementation while the suite stays green.
          Only now is it safe to restructure, rename, or optimise.
```

Every phase in the migration order below is one or more complete red-green-refactor cycles. A phase is done when its scenarios are green and the rest of the suite is still green.

---

#### Golden set — hand-crafted before cycle 1

The golden set is the bedrock. Fixtures are hand-crafted by the team to be structurally faithful to the `types.ts` schema and internally consistent with each other (title, setting, exposition, and leads all describe the same world). They are **never generated or mutated by tests** — committed as static files, read-only ground truth.

One golden `Transmission` covers what we need for BDD, complemented by individual mock Gemini response payloads for each generation step:

```
tests/
  fixtures/
    golden/
      neon-chrome-neotokyo.json        # Complete Transmission, Neon Chrome style
    mocks/
      gemini-responses/
        style-guide.json               # StyleGuide payload (generateStyleGuide)
        title-and-setting.json         # { title, settingSummary } (generateTitleAndSetting)
        exposition.json                # { technology, society, environment } (generateExposition)
        leads.json                     # { leads: [...36...] } (generateLeads)
        lead-inspection-text.json      # { sensory, expandedDescription } (generateLeadInspectionText)
  helpers/
    mockGemini.ts                      # Shared vi.mock setup and per-call configurators
```

---

#### LLM mock strategy

There are exactly **two SDK entry points** to mock in `services/gemini.ts`:

| Method | Used by | Returns |
|---|---|---|
| `ai.models.generateContentStream` | `streamJson<T>` — all text generation | async iterable of `{ text: string }` chunks |
| `ai.models.generateContent` | `generateTransmissionHeader`, `generateLeadImage` | `{ candidates: [{ content: { parts: [...] } }] }` |

**`tests/helpers/mockGemini.ts`** — shared setup imported by every test file that touches the generator:

```ts
import { vi } from 'vitest';

// Module-level mock — call this at the top of each test file:
//   vi.mock('@google/genai', () => import('../helpers/mockGemini').then(m => m.geminiModuleStub));

export const mockGenerateContentStream = vi.fn();
export const mockGenerateContent = vi.fn();

export const geminiModuleStub = {
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContentStream: mockGenerateContentStream,
      generateContent: mockGenerateContent,
    },
  })),
  Type: {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    ARRAY:  'ARRAY',
  },
};

/** Configure generateContentStream to return a single-chunk async stream of the given payload. */
export function stubStreamResponse(payload: unknown): void {
  mockGenerateContentStream.mockResolvedValueOnce(
    (async function* () {
      yield { text: JSON.stringify(payload) };
    })(),
  );
}

/** Configure generateContent to return no inline image data (image skipped gracefully). */
export function stubNoImage(): void {
  mockGenerateContent.mockResolvedValueOnce({ candidates: [] });
}
```

Usage in a test file:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stubStreamResponse, stubNoImage } from '../helpers/mockGemini';
import titleFixture   from '../fixtures/mocks/gemini-responses/title-and-setting.json';
import expositionFixture from '../fixtures/mocks/gemini-responses/exposition.json';

vi.mock('@google/genai', () => import('../helpers/mockGemini').then(m => m.geminiModuleStub));

describe('generateTitleAndSetting', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns title and settingSummary from the API response', async () => {
    stubStreamResponse(titleFixture);
    const result = await generateTitleAndSetting('fake-key', 'Neo-Tokyo 2099');
    expect(result.title).toBe(titleFixture.title);
    expect(result.settingSummary).toBe(titleFixture.settingSummary);
  });
});
```

**Rules for mocks:**
- Every test that exercises any function from `services/gemini.ts` or `core/generator.ts` **must** declare `vi.mock('@google/genai', ...)`. No test ever hits the real Gemini API.
- Image generation calls always use `stubNoImage()` in tests — no base64 image data in fixtures.
- `stubStreamResponse` / `stubNoImage` are called in the order the SUT will call the SDK, one call per stub.

---

#### BDD scenarios per phase

Each scenario below maps directly to one red-green-refactor cycle.

**Phase 1 — API key decoupling (`core/generator`)**
```
Feature: Isomorphic generation engine
  Scenario: generateTitleAndSetting accepts an explicit apiKey and returns title + summary
  Scenario: generateExposition returns technology, society, and environment fields
  Scenario: generateLeads returns exactly 36 leads, 6 per category
  Scenario: generateFullTransmission assembles a complete Transmission object
  Scenario: No scenario imports localStorage, window, or document
```

**Phase 2 — Storage adapter (`FileSystemStorage`)**
```
Feature: FileSystem storage adapter
  Scenario: save writes a JSON file named by transmission id
  Scenario: getAll reads all files and returns them sorted newest first
  Scenario: delete removes the file; subsequent getAll omits it
  Scenario: save then getAll round-trips a golden fixture without data loss
```

**Phase 3 — Storage adapter (`IndexedDbStorage`)**
```
Feature: IndexedDB storage adapter satisfies the same IStorage contract
  Scenario: save and getAll round-trips a golden fixture (fake-indexeddb)
  Scenario: delete removes a transmission by id
  Scenario: getAll returns results sorted newest first
```

**Phase 4 — Gemini shim (regression)**
```
Feature: Browser service shim preserves existing behaviour
  Scenario: services/gemini.ts exports all functions that App.tsx currently imports
  Scenario: Each shim function calls core/generator with the key from localStorage
```

**Phase 5 — CLI `generate` command**
```
Feature: CLI generate command
  Scenario: --theme and --api-key flags produce a Transmission written to --output
  Scenario: output JSON passes golden-set schema validation
  Scenario: --no-images skips all image generation calls
  Scenario: --full triggers lead detail generation for all 36 leads
  Scenario: missing --api-key and missing GEMINI_API_KEY env exits with a clear error
```

**Phase 6 — CLI `list` and `export` commands**
```
Feature: CLI list command
  Scenario: prints a table of transmissions in the storage directory
  Scenario: empty directory prints a helpful "no transmissions" message

Feature: CLI export command
  Scenario: export <id> writes JSON identical to the stored fixture
  Scenario: export --compress writes a .json.gz readable by importTransmission
```

**Golden set schema stability (runs in every phase)**
```
Feature: Transmission JSON schema stability
  Scenario: each golden fixture passes TypeScript type validation
  Scenario: each golden fixture round-trips through JSON.stringify → JSON.parse identically
  Scenario: importTransmission accepts each golden fixture without error
```

---

#### Tooling

- **Vitest** — test runner (native Vite integration, no extra bundler config)
- **`vi.mock('@google/genai')`** — swap Gemini SDK with fixture responses at module level
- **`fake-indexeddb`** — in-memory IndexedDB for `IndexedDbStorage` tests
- **`os.tmpdir()`** + `afterEach` cleanup — isolated directories for `FileSystemStorage` tests
- `npm run test` — single run
- `npm run test:watch` — watch mode during active cycles

#### Rules

1. **Red first, always.** Running `npm run test` must show a failing test before any new production file is created or modified.
2. **Golden fixtures are immutable.** Tests may read them; nothing ever writes to them.
3. **The suite must be green between phases.** Never carry a red test across a phase boundary.
4. **No live LLM calls, ever.** Every test file that touches `services/gemini.ts` or `core/generator.ts` must declare `vi.mock('@google/genai', ...)`. CI has no `GEMINI_API_KEY` and must stay that way.

---

## Goal

Separate all generation and persistence logic from the browser/React UI so it can be reused by a Node.js CLI that produces the same `Transmission` JSON currently exported by the web app.

---

## Problem Analysis

### Current Coupling Issues

| File | Browser-only dependency |
|---|---|
| `services/gemini.ts` | `localStorage.getItem('technoir_api_key')` inside module-level `getApiKey()` |
| `services/db.ts` | `indexedDB`, `CompressionStream`, `DecompressionStream`, `window.showSaveFilePicker`, `document.createElement('a')` |
| `services/archive.ts` | `localStorage.getItem(ARCHIVE_URL_STORAGE_KEY)`, `window.DecompressionStream` |
| `App.tsx` | Orchestration logic (generate → save → reload archives) is inline inside React event handlers and wired to `setState` callbacks |

Everything else (`types.ts`, `constants.tsx`, the Gemini API calls themselves) is already environment-agnostic.

---

## Target Architecture

```
src/
  core/                        ← 100% isomorphic, no browser APIs
    generator.ts               ← Pure generation pipeline (replaces gemini.ts logic)
    types.ts                   ← Moved from root types.ts (no change needed)
    constants.ts               ← Renamed from constants.tsx, .tsx → .ts
    prompts.ts                 ← Optional: extract prompt strings out of generator.ts

  adapters/
    storage/
      IStorage.ts              ← Interface: save, getAll, delete, export, import
      IndexedDbStorage.ts      ← Browser implementation (current db.ts, minus export/import DOM)
      FileSystemStorage.ts     ← Node.js implementation (writes .json.gz to disk)
    archive/
      IArchive.ts              ← Interface: fetchManifest, fetchTransmission
      BrowserArchive.ts        ← Current archive.ts logic
      FileArchive.ts           ← Node.js: reads local directory (for offline use)
    ApiKeyProvider.ts          ← Interface + two impls: LocalStorageKeyProvider, EnvKeyProvider

  services/                    ← Thin wrappers used by the web app (keep backward compat)
    gemini.ts                  ← Re-exports core/generator.ts functions, passes browser key provider
    db.ts                      ← Re-exports IndexedDbStorage + DOM export/import helpers
    archive.ts                 ← Re-exports BrowserArchive

  cli/
    index.ts                   ← Entry point (commander.js)
    commands/
      generate.ts              ← Full generation pipeline → writes JSON to disk
      list.ts                  ← Lists transmissions saved locally
    utils/
      progress.ts              ← Terminal progress / log output (replaces setLoadingMessage)

  (existing)
  App.tsx
  index.tsx
  ErrorBoundary.tsx
  index.css
```

---

## Phase 1 — Decouple API Key from Gemini Service

**Files changed:** `services/gemini.ts` → split into `core/generator.ts`

The `getApiKey()` / `getAI()` helpers inside `gemini.ts` read from `localStorage`. Replace them with an explicit `apiKey: string` parameter injected at call-site.

### Before
```ts
// services/gemini.ts
const getApiKey = (): string | undefined => {
  return localStorage.getItem('technoir_api_key') || undefined;
};
const getAI = () => {
  const apiKey = getApiKey();
  ...
  return new GoogleGenAI({ apiKey });
};
```

### After
```ts
// core/generator.ts
export const generateTitleAndSetting = async (
  apiKey: string,
  theme: string,
  onUpdate?: (text: string) => void
): Promise<Pick<Transmission, 'title' | 'settingSummary'>> => { ... }
```

The web app reads the key from `localStorage` once (in the React component) and passes it down. The CLI reads it from `process.env.GEMINI_API_KEY` or a `--api-key` flag.

**Impact on App.tsx:** Add `const apiKey = localStorage.getItem('technoir_api_key')` at the top of each generation handler (already effectively done — just move it out of the module).

---

## Phase 2 — Storage Adapter Interface

**New file:** `adapters/storage/IStorage.ts`

```ts
export interface IStorage {
  saveTransmission(t: Transmission): Promise<void>;
  getAllTransmissions(): Promise<Transmission[]>;
  deleteTransmission(id: number): Promise<void>;
}
```

**`adapters/storage/IndexedDbStorage.ts`** — extracts `initDB`, `saveTransmission`, `getAllTransmissions`, `deleteTransmission` from the current `db.ts`. DOM-specific helpers (`exportTransmission`, `importTransmission`, `showSaveFilePicker`) stay in `services/db.ts` as browser-only utilities.

**`adapters/storage/FileSystemStorage.ts`** — Node.js implementation:
- `saveTransmission` → writes `<id>.json` (or `.json.gz`) to a configurable `~/.technoir/transmissions/` directory.
- `getAllTransmissions` → reads all `.json` / `.json.gz` files from that directory.
- `deleteTransmission` → unlinks the file.

---

## Phase 3 — Archive Adapter Interface

**New file:** `adapters/archive/IArchive.ts`

```ts
export interface IArchive {
  fetchManifest(): Promise<CloudManifestItem[]>;
  fetchTransmission(filename: string): Promise<Transmission>;
}
```

`BrowserArchive.ts` — current `archive.ts` logic, unchanged but class-wrapped.  
`FileArchive.ts` — Node.js: reads a local directory path instead of HTTP fetching.

---

## Phase 4 — Core Generator Module

**New file:** `core/generator.ts`

Move all Gemini call functions from `services/gemini.ts` here, adding `apiKey: string` as the first parameter to every function. Keep all prompt logic, schema definitions, and the `generateFullTransmission` pipeline.

This module has **zero** imports from browser APIs — only `@google/genai`, types, and constants.

```ts
// core/generator.ts — public API
export { generateStyleGuide }
export { generateTitleAndSetting }
export { generateExposition }
export { generateLeads }
export { generateTransmissionHeader }
export { generateLeadInspectionText }
export { generateLeadImage }
export { generateFullTransmission }
export { regenerateSensoryField }
export { regenerateExpandedDescription }
export { formatStyleContext }
```

**`services/gemini.ts`** becomes a thin compatibility shim:
```ts
// services/gemini.ts (shim — keeps existing imports working in App.tsx)
import { localStorage.getItem } from ...  // still reads key from browser storage
import * as core from '../core/generator';

export const generateTitleAndSetting = (theme, onUpdate) => {
  const apiKey = localStorage.getItem('technoir_api_key') ?? '';
  return core.generateTitleAndSetting(apiKey, theme, onUpdate);
};
// ... repeat for each export
```

This means **App.tsx needs zero changes** in Phase 4.

---

## Phase 5 — CLI

**New package entry:** add `"cli"` to `package.json` scripts and a `bin` entry.

```
cli/
  index.ts            ← commander setup
  commands/
    generate.ts
    list.ts
    export.ts
  utils/
    progress.ts       ← onLog / onUpdate callbacks → console output
```

### `generate` command

```
technoir generate \
  --theme "Neo-Tokyo 2099" \
  --preset neon-chrome \
  --full \
  --output ./my-transmission.json
```

| Flag | Description |
|---|---|
| `--theme <text>` | Required. Generation theme |
| `--preset <id>` | Style preset ID (default: `neon-chrome`) |
| `--style <file>` | Path to a custom `StyleGuide` JSON file |
| `--full` | Generate all lead details + images (like bulk mode) |
| `--no-images` | Skip image generation (faster, text-only) |
| `--output <path>` | Where to write the JSON (default: stdout or `./transmissions/`) |
| `--api-key <key>` | Gemini API key (falls back to `GEMINI_API_KEY` env var) |

Progress is printed to stderr so stdout can be piped cleanly.

### `list` command

```
technoir list
```

Reads from `~/.technoir/transmissions/` and prints a table of saved transmissions.

### `export` command

```
technoir export <id> --output ./my-transmission.json
```

Reads a saved transmission by ID and writes it as JSON (gzip optional).

---

## Phase 6 — App.tsx Cleanup (optional, post-CLI)

Once the shims are in place and the CLI is working, App.tsx can be cleaned up to use the adapter interfaces directly (instead of the legacy shim layer), making the dependency chain explicit. This is purely cosmetic — not required for functionality.

---

## Migration Order

```
Phase 1  →  Decouple API key from gemini.ts              ✅ DONE
Phase 2  →  Storage adapter + FileSystemStorage           ✅ DONE
Phase 3  →  Archive adapter                               ✅ DONE (IndexedDbStorage)
Phase 4  →  core/generator.ts + gemini.ts shim            ✅ DONE
Phase 5  →  CLI                                           ✅ DONE
Phase 6  →  App.tsx cleanup                               ⬜ Optional, cosmetic
```

---

## Dependencies to Add

| Package | Purpose | Where |
|---|---|---|
| `commander` | CLI argument parsing | CLI only |
| `chalk` | Terminal colors for progress output | CLI only |
| `ora` | Spinner for long-running steps | CLI only |
| `zlib` (Node built-in) | Gzip for FileSystemStorage | CLI only |

No new dependencies needed in the browser bundle.

---

## Key Invariant

The `Transmission` JSON produced by the CLI must be **byte-for-byte compatible** with the JSON produced by the web app — the same `types.ts` shape, the same field names, and importable by the web app's `importTransmission` function without modification.
