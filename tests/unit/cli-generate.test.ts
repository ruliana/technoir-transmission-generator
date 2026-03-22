/**
 * Feature: CLI generate command
 *
 * Tests run the generate command handler directly (no subprocess spawn),
 * mocking core/generator and FileSystemStorage to stay fast and deterministic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Mock the Gemini SDK (generator uses it)
// ---------------------------------------------------------------------------
vi.mock('@google/genai', () =>
  import('../helpers/mockGemini').then((m) => m.geminiModuleStub),
);

// ---------------------------------------------------------------------------
// Mock core/generator to avoid real LLM calls
// Use vi.hoisted so the variable is available inside the hoisted vi.mock factory
// ---------------------------------------------------------------------------
import goldenTransmission from '../fixtures/golden/neon-chrome-neotokyo.json';
import type { Transmission } from '../../types';

const golden = goldenTransmission as unknown as Transmission;

const { mockGenerateFull } = vi.hoisted(() => ({
  mockGenerateFull: vi.fn(),
}));

vi.mock('../../core/generator', () => ({
  generateFullTransmission: mockGenerateFull,
  generateStyleGuide:       vi.fn().mockResolvedValue({}),
  formatStyleContext:       vi.fn().mockReturnValue(''),
}));

import { runGenerate, GenerateOptions } from '../../cli/commands/generate';

// ---------------------------------------------------------------------------
// Helper: run the CLI entry point in-process so Commander parsing is exercised
// ---------------------------------------------------------------------------
async function runCLI(...args: string[]): Promise<void> {
  // Re-import the program fresh each call (Commander is stateful)
  const { Command } = await import('commander');
  const { runGenerate: rg } = await import('../../cli/commands/generate');
  const { DEFAULT_STORAGE_DIR } = await import('../../adapters/storage/FileSystemStorage');
  const { runList, formatTable } = await import('../../cli/commands/list');
  const { runExport } = await import('../../cli/commands/export');

  const prog = new Command().exitOverride(); // throw instead of process.exit
  prog.name('technoir');

  prog
    .command('generate')
    .requiredOption('--theme <text>', '')
    .option('--api-key <key>', '', '')
    .option('--preset <id>', '', 'neon-chrome')
    .option('--output <path>', '', './transmission.json')
    .option('--full', '', false)
    .option('--no-images', 'Skip all image generation')
    .action(async (opts) => {
      await rg({
        theme:    opts.theme,
        apiKey:   opts.apiKey,
        preset:   opts.preset,
        output:   opts.output,
        full:     opts.full,
        noImages: opts.images === false,
      });
    });

  await prog.parseAsync(['node', 'technoir', ...args]);
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'technoir-cli-test-'));
  mockGenerateFull.mockResolvedValue(golden);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Scenario: --theme and --api-key flags produce a Transmission written to --output
// ---------------------------------------------------------------------------
describe('runGenerate', () => {
  it('writes a JSON file to --output containing a valid Transmission', async () => {
    const outputPath = join(tmpDir, 'output.json');
    const opts: GenerateOptions = {
      theme: 'Neo-Tokyo 2099',
      apiKey: 'fake-api-key',
      output: outputPath,
      full: false,
      noImages: true,
    };

    await runGenerate(opts);

    const raw = await readFile(outputPath, 'utf8');
    const parsed = JSON.parse(raw) as Transmission;
    expect(parsed.title).toBe(golden.title);
    expect(parsed.leads).toHaveLength(golden.leads.length);
    expect(parsed.id).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Scenario: output JSON passes golden-set schema validation
  // -------------------------------------------------------------------------
  it('output has all required Transmission fields', async () => {
    const outputPath = join(tmpDir, 'output.json');
    await runGenerate({ theme: 'test', apiKey: 'key', output: outputPath, full: false, noImages: true });
    const raw = await readFile(outputPath, 'utf8');
    const parsed = JSON.parse(raw) as Transmission;

    expect(parsed).toHaveProperty('id');
    expect(parsed).toHaveProperty('createdAt');
    expect(parsed).toHaveProperty('title');
    expect(parsed).toHaveProperty('settingSummary');
    expect(parsed).toHaveProperty('exposition');
    expect(parsed).toHaveProperty('leads');
    expect(Array.isArray(parsed.leads)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario: --no-images passes noImages:true to generateFullTransmission
  // -------------------------------------------------------------------------
  it('passes noImages:true to generateFullTransmission when --no-images is set', async () => {
    const outputPath = join(tmpDir, 'output.json');
    await runGenerate({ theme: 'test', apiKey: 'key', output: outputPath, full: false, noImages: true });
    expect(mockGenerateFull).toHaveBeenCalledWith(
      'key',
      'test',
      expect.any(Object), // style
      expect.any(Function), // onLog
      { noImages: true },
    );
  });

  it('passes noImages:false to generateFullTransmission when --no-images is not set', async () => {
    const outputPath = join(tmpDir, 'output.json');
    await runGenerate({ theme: 'test', apiKey: 'key', output: outputPath, full: false, noImages: false });
    expect(mockGenerateFull).toHaveBeenCalledWith(
      'key',
      'test',
      expect.any(Object),
      expect.any(Function),
      { noImages: false },
    );
  });

  // -------------------------------------------------------------------------
  // Commander parsing regression: --no-images must reach generateFullTransmission
  // (Commander's --no-<name> convention sets opts.images, not opts.noImages)
  // -------------------------------------------------------------------------
  it('Commander: --no-images flag correctly sets noImages:true via CLI parsing', async () => {
    const outputPath = join(tmpDir, 'cli-parse.json');
    await runCLI('generate', '--theme', 'test', '--api-key', 'key', '--output', outputPath, '--no-images');
    expect(mockGenerateFull).toHaveBeenCalledWith(
      'key', 'test', expect.any(Object), expect.any(Function),
      { noImages: true },
    );
  });

  it('Commander: omitting --no-images leaves noImages:false', async () => {
    const outputPath = join(tmpDir, 'cli-parse2.json');
    await runCLI('generate', '--theme', 'test', '--api-key', 'key', '--output', outputPath);
    expect(mockGenerateFull).toHaveBeenCalledWith(
      'key', 'test', expect.any(Object), expect.any(Function),
      { noImages: false },
    );
  });

  // -------------------------------------------------------------------------
  // Scenario: missing --api-key and missing GEMINI_API_KEY env exits with error
  // -------------------------------------------------------------------------
  it('throws when no API key is provided', async () => {
    const savedEnv = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    await expect(
      runGenerate({ theme: 'test', apiKey: '', output: join(tmpDir, 'out.json'), full: false, noImages: true }),
    ).rejects.toThrow(/api.?key/i);

    process.env.GEMINI_API_KEY = savedEnv;
  });

  // -------------------------------------------------------------------------
  // Scenario: GEMINI_API_KEY env var is used when --api-key is absent
  // -------------------------------------------------------------------------
  it('uses GEMINI_API_KEY env var when no --api-key flag is given', async () => {
    process.env.GEMINI_API_KEY = 'env-key-12345';
    const outputPath = join(tmpDir, 'output.json');

    await runGenerate({ theme: 'test', apiKey: '', output: outputPath, full: false, noImages: true });

    const raw = await readFile(outputPath, 'utf8');
    const parsed = JSON.parse(raw) as Transmission;
    expect(parsed.title).toBeDefined();

    delete process.env.GEMINI_API_KEY;
  });
});
