/**
 * cli/commands/generate.ts
 *
 * Implements the `technoir generate` command. Reads the API key from
 * --api-key or the GEMINI_API_KEY environment variable, runs the full
 * generation pipeline, and writes the resulting Transmission JSON to disk.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { generateFullTransmission } from '../../core/generator';
import { DEFAULT_STYLE_PRESETS } from '../../constants';
import { makeLogger } from '../utils/progress';
import type { StyleGuide } from '../../types';

export interface GenerateOptions {
  /** Generation theme (required). */
  theme: string;
  /** Gemini API key. Falls back to GEMINI_API_KEY env var. */
  apiKey: string;
  /** Path to write the output JSON. */
  output: string;
  /** If true, generate all lead details (text + images). */
  full: boolean;
  /** If true, skip all image generation steps. */
  noImages: boolean;
  /** Style preset id (defaults to 'neon-chrome'). */
  preset?: string;
}

/**
 * Main handler for `technoir generate`.
 * Exported as a pure async function so it can be tested without spawning
 * a subprocess.
 */
export async function runGenerate(opts: GenerateOptions): Promise<void> {
  // Resolve API key
  const apiKey = opts.apiKey || process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error(
      'No API key found. Provide --api-key <key> or set the GEMINI_API_KEY environment variable.',
    );
  }

  // Resolve style preset
  const presetId = opts.preset ?? 'neon-chrome';
  const preset = DEFAULT_STYLE_PRESETS.find((p) => p.id === presetId)
    ?? DEFAULT_STYLE_PRESETS[0];
  const style: StyleGuide = preset.guide;

  const onLog = makeLogger();

  // Run the generation pipeline
  const transmission = await generateFullTransmission(apiKey, opts.theme, style, onLog, {
    noImages: opts.noImages,
  });

  // Ensure output directory exists
  await mkdir(dirname(opts.output), { recursive: true });

  // Write JSON
  await writeFile(opts.output, JSON.stringify(transmission, null, 2), 'utf8');
  onLog(`>> Written to ${opts.output}`);
}
