<div align="center">
<img width="1200" height="475" alt="Technoir Transmission Engine banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Technoir Transmission Engine

A high-fidelity generator for [Technoir RPG](https://technoirrpg.com/) Transmissions — the cyberpunk noir setting packages that fuel the game. Paste in a theme, pick a visual style, and the engine produces a complete Transmission: title, exposition, 36 plot nodes across six categories, sensory dossiers, and AI-generated imagery.

> **BYOK** — Bring Your Own Key. The app runs entirely in the browser. Your Gemini API key is stored only in your browser's localStorage and is sent directly to Google's API. Nothing passes through any server.

## Features

- **Transmission generation** — title, setting summary, technology / society / environment exposition
- **36 leads** across Connections, Events, Locations, Objects, Threats, and Factions
- **Lead dossiers** — sensory data (sight, sound, smell, vibe), expanded hardboiled description, and a generated image
- **Style presets** — Neon Chrome, Rust & Decay, Shadow Deep, Vinepunk — each shapes the narrative voice and visual palette of the entire transmission
- **Custom style editor** — tweak any preset or save your own
- **Interactive vs Full Gen** — step-by-step streaming or a single full-detail run
- **Field regeneration** — re-roll any individual sensory field, dossier paragraph, or image
- **Inline editing** — edit any lead name, description, or dossier field by hand
- **Local archive** — transmissions saved to IndexedDB; import/export as compressed JSON
- **Public network** — browse and download featured transmissions from a shared cloud archive

## Requirements

- A free [Google AI Studio API key](https://aistudio.google.com/app/apikey) (Gemini API)
- Node.js 18+ for local development

## Run Locally

```bash
git clone https://github.com/your-username/technoir-transmission-engine.git
cd technoir-transmission-engine
npm install
npm run dev          # http://localhost:3000
```

Enter your Gemini API key in the UI when prompted. It is stored in your browser's localStorage only.

## Live Demo

🔗 **[https://technoir-transmission-engine.onrender.com](https://technoir-transmission-engine.onrender.com)**

## Deploy to Render

The repo includes a `render.yaml` for zero-config static site deployment.

1. Push the repo to GitHub
2. In [Render](https://render.com), click **New → Static Site** and connect the repo
3. Render will auto-detect `render.yaml` — no extra configuration needed
4. Deploy. No environment variables required (BYOK model)

Or deploy manually via the Render dashboard:

| Field | Value |
|---|---|
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

## Deploy to Google Cloud Run

```bash
gcloud run deploy technoir-transmission-engine \
  --source . \
  --region us-west1 \
  --platform managed \
  --allow-unauthenticated
```

## CLI

The CLI lets you generate, browse, and export transmissions from the terminal — no browser required. Output JSON is fully compatible with the web app's import function.

### Setup

```bash
# Install dependencies (includes tsx for running TypeScript directly)
npm install

# Copy your Gemini API key into the environment
export GEMINI_API_KEY=your-key-here
# or pass it per-command with --api-key <key>
```

### `generate`

Generate a complete Transmission and write it to disk.

```bash
npx tsx cli/index.ts generate \
  --theme "Rain-soaked Hong Kong, 2077" \
  --preset neon-chrome \
  --no-images \
  --output ./transmissions/kowloon.json
```

| Flag | Default | Description |
|---|---|---|
| `--theme <text>` | *(required)* | The setting prompt — any cyberpunk theme works |
| `--preset <id>` | `neon-chrome` | Style preset: `neon-chrome`, `rust-decay`, `shadow-deep`, `vinepunk` |
| `--output <path>` | `./transmission.json` | Where to write the JSON file |
| `--no-images` | off | Skip all image generation (much faster, text-only) |
| `--api-key <key>` | `$GEMINI_API_KEY` | Gemini API key (falls back to env var) |

> **Note:** Without `--no-images` the generator produces a header image and one image per lead (37 image calls total). Use `--no-images` for fast iteration; images can be generated later in the web app.

### `list`

Print a table of transmissions saved in the local storage directory.

```bash
npx tsx cli/index.ts list
npx tsx cli/index.ts list --dir ./transmissions
```

```
ID               Created      Leads  Title
────────────────────────────────────────────────────────────────────────────────
1774213322149    3/22/2026    36     The Lion's Halo
1774212669099    3/22/2026    36     Silt & Silicon: The Drowning Metropolis
```

Default storage directory: `~/.technoir/transmissions/`

### `export`

Export a saved transmission to a file by ID.

```bash
# Plain JSON
npx tsx cli/index.ts export 1774213322149 \
  --dir ./transmissions \
  --output ./lion-halo.json

# Gzip-compressed (smaller, compatible with web app import)
npx tsx cli/index.ts export 1774213322149 \
  --dir ./transmissions \
  --output ./lion-halo.json.gz \
  --compress
```

The exported file can be imported directly in the web app via **Local Archive → Import**.

### Adding transmissions to the Public Network archive

Drop exported `.json` (or `.json.gz`) files into `public/archives/` and add an entry to `public/archives/manifest.json`:

```bash
# 1. Generate (text-only is fine for archiving)
npx tsx cli/index.ts generate \
  --theme "Flooded Jakarta, 2081" \
  --preset rust-decay \
  --no-images \
  --output /tmp/jakarta.json

# 2. Copy into the archive directory (tracked via Git LFS)
cp /tmp/jakarta.json public/archives/<id>.json

# 3. Add the manifest entry (id, title, summary, filename, createdAt)
#    then commit and push — Git LFS handles the binary payload
git add public/archives/ && git commit -m "archive: add Jakarta transmission"
git push
```

## Tech Stack

- **React 19** + TypeScript
- **Vite 6**
- **Tailwind CSS 3** (PostCSS, not CDN)
- **Google Gemini API** via `@google/genai` — text generation (`gemini-3-flash-preview`) and image generation (`gemini-2.5-flash-image`)
- **IndexedDB** for local persistence

## Project Structure

```
├── App.tsx                        # Main component — UI state and generation orchestration
├── constants.tsx                  # System prompts, style presets, category list
├── types.ts                       # TypeScript types (Transmission, Lead, StyleGuide, …)
│
├── core/
│   └── generator.ts               # Isomorphic generation pipeline (no browser APIs)
│
├── adapters/
│   ├── ApiKeyProvider.ts          # EnvKeyProvider (CLI) + LocalStorageKeyProvider (browser)
│   ├── storage/
│   │   ├── IStorage.ts            # Storage interface
│   │   ├── FileSystemStorage.ts   # Node.js: reads/writes ~/.technoir/transmissions/
│   │   └── IndexedDbStorage.ts    # Browser: IndexedDB-backed
│   └── archive/
│       ├── IArchive.ts            # Archive interface
│       ├── BrowserArchive.ts      # HTTP fetch (public network tab)
│       └── FileArchive.ts         # Local directory (CLI offline use)
│
├── services/                      # Browser shims — keep App.tsx import-compatible
│   ├── gemini.ts                  # Reads key from localStorage, delegates to core/generator
│   ├── db.ts                      # IndexedDB + DOM export/import helpers
│   └── archive.ts                 # Wraps BrowserArchive with localStorage URL config
│
├── cli/
│   ├── index.ts                   # CLI entry point (commander)
│   ├── commands/
│   │   ├── generate.ts            # technoir generate
│   │   ├── list.ts                # technoir list
│   │   └── export.ts              # technoir export
│   └── utils/
│       └── progress.ts            # stderr logging helpers
│
├── tests/
│   ├── fixtures/
│   │   ├── golden/                # Immutable reference Transmission (hand-crafted)
│   │   └── mocks/gemini-responses # Per-step Gemini response payloads
│   ├── helpers/mockGemini.ts      # vi.mock stub + stubStreamResponse / stubNoImage
│   └── unit/                      # 75 Vitest BDD tests across 9 files
│
├── public/archives/               # Public Network transmissions (Git LFS)
│   └── manifest.json              # Index file (regular git, not LFS)
│
└── render.yaml                    # Render.com static site config
```

## License

MIT — see [LICENSE](./LICENSE)
