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

## Tech Stack

- **React 19** + TypeScript
- **Vite 6**
- **Tailwind CSS 3** (PostCSS, not CDN)
- **Google Gemini API** via `@google/genai` — text generation (`gemini-3-flash-preview`) and image generation (`gemini-2.5-flash-image`)
- **IndexedDB** for local persistence

## Project Structure

```
├── App.tsx              # Main component — all UI state and generation orchestration
├── ErrorBoundary.tsx    # Top-level React error boundary
├── constants.tsx        # System prompts, style presets, category list
├── types.ts             # TypeScript types (Transmission, Lead, StyleGuide, …)
├── index.css            # Tailwind entry point
├── index.html           # Shell — custom cyberpunk CSS, fonts
├── services/
│   ├── gemini.ts        # All Gemini API calls (text + image)
│   ├── db.ts            # IndexedDB via TechnoirDB
│   └── cloud.ts         # Read-only Google Cloud Storage fetch
└── render.yaml          # Render.com static site config
```

## License

MIT — see [LICENSE](./LICENSE)
