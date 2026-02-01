# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Technoir Transmission Generator** is a React web application that generates detailed cyberpunk settings and narratives ("Transmissions") for the Technoir tabletop RPG using Google's Gemini API. It's built as an AI Studio app with support for local development and Google Cloud deployment.

## Commands

### Development
```bash
npm install              # Install dependencies
npm run dev            # Start local dev server (http://localhost:3000)
npm run build          # Build for production
npm run preview        # Preview production build locally
```

### Environment Setup
The app requires a Gemini API key:
1. Create `.env.local` in the project root
2. Add: `GEMINI_API_KEY=your-api-key-here`
3. Alternatively, set via Google AI Studio fallback or guest input in UI

## Architecture

### High-Level Design
The app follows a **service-oriented component architecture** with a single root component (App.tsx) orchestrating state and delegating to specialized service modules:

- **App.tsx** (~654 lines): Main React component managing UI state, generation workflows, and user interactions
- **services/gemini.ts**: Gemini API integration for content generation (titles, exposition, leads, images)
- **services/cloud.ts**: Google Cloud Storage operations and OAuth authentication
- **services/db.ts**: IndexedDB (`TechnoirDB`) for local data persistence
- **types.ts**: Centralized TypeScript type definitions
- **constants.tsx**: Configuration (API keys, system prompts, master email, generation parameters)

### Data Model
```typescript
Transmission {
  id: string
  createdAt: number
  title: string
  settingSummary: string
  exposition: {
    technology: string
    society: string
    environment: string
  }
  headerImageUrl: string
  leads: Lead[]
}

Lead {
  id: string
  name: string
  description: string
  category: string
  details?: {
    sensory: { sight, sound, smell, vibe }
    expandedDescription: string
    imageUrl: string
  }
}
```

### Generation Pipeline
Transmissions are generated in stages:
1. **Title & Setting** (1 request): Cyberpunk setting + title
2. **Exposition** (1 request): Technology, Society, Environment paragraphs
3. **Leads** (6 requests): 6 categories × 6 leads = 36 plot nodes
4. **Header Image** (async): Cover image for the transmission
5. **Lead Details** (sequential): Deep-dive text + images per lead (respects rate limits)

Two modes:
- **Interactive**: Step-by-step generation with streaming feedback
- **Full_Gen**: Complete generation including all lead details

### State Management
- **Local Storage**: IndexedDB for transmissions (TechnoirDB)
- **Cloud Storage**: Google Cloud Storage bucket (technoir-transmission-hub)
- **Manifest System**: JSON manifest file tracks cloud-uploaded transmissions
- **Auth**: Dual mode - Google OAuth2 for master users, manual key input for guests

### UI/Styling
- Tailwind CSS (CDN) with custom cyberpunk theme
- Cyan glows (#00f2ff), dark backgrounds (#050505), typewriter animations
- Custom CSS animations: scanlines, shimmer skeleton loading, glitch effects
- Responsive flexbox layout, mobile-first approach

## Key Technical Patterns

### API Integration
- `gemini.ts` wraps all LLM calls with JSON parsing and markdown cleanup
- Streaming responses for text generation
- Image generation uses async fallbacks (header images don't block UI)
- Lead details generation is sequential to avoid rate limiting

### Error Handling
- JSON parsing includes fallback cleanup (removes markdown code blocks)
- Try-catch blocks around all API/storage operations
- Graceful degradation when image generation fails
- User-facing error messages in modal dialogs

### Authentication
- Master users (email matches MASTER_EMAIL constant): Full access via OAuth
- Guest users: Manual API key input, limited to localStorage
- OAuth token stored in localStorage for Cloud Storage access

### Deployment
Built as Google AI Studio app with environment variables injected at build time. `.env.local` used for local development only (not in CI/production).

## Development Notes

### No Testing Framework
This codebase currently has no automated tests, linting, or code formatting tools. When adding tests or tooling, consider:
- Vitest for unit tests (integrates well with Vite)
- ESLint + Prettier for code quality if needed

### File Export/Compression
The app uses `CompressionStream` API (with JSON fallback) to compress transmissions for download. This is modern browser API, no external dependency needed.

### Image Generation
- Header images generate asynchronously (doesn't block transmission creation)
- Lead images generate sequentially (one at a time) to respect Gemini rate limits
- Missing images don't prevent transmission from being saved

### Constants Configuration
Edit `constants.tsx` to customize:
- System prompts for each generation stage
- Gemini model selection
- Generation parameters (temperature, token limits)
- Master user email
- Cloud storage bucket name

## Common Tasks

### Modify Generation Logic
All LLM prompts and generation orchestration live in `App.tsx` (the generation methods) and the system prompts in `constants.tsx`. The actual API calls are abstracted in `services/gemini.ts`.

### Add New Generation Stages
1. Add new method in `App.tsx` calling `gemini.generateContent()` or `gemini.generateImage()`
2. Add system prompt to `constants.tsx`
3. Update UI state and UI rendering
4. Update Transmission type if storing new data

### Persist New Data
All transmission data is stored in IndexedDB via `db.ts`. Edit the Transmission type in `types.ts`, then `db.ts` handles serialization automatically.

### Debug Gemini API Issues
- Check `.env.local` has valid `GEMINI_API_KEY`
- Verify API key has Generative AI API enabled
- Check browser console for JSON parsing errors or API response issues
- `gemini.ts` logs API responses (use browser DevTools)
