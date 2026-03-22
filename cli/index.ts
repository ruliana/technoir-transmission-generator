#!/usr/bin/env node
/**
 * cli/index.ts — Technoir CLI entry point
 *
 * Usage:
 *   technoir generate --theme "Neo-Tokyo 2099" --api-key <key> --output ./out.json
 *   technoir list [--dir ~/.technoir/transmissions]
 *   technoir export <id> [--dir ~/.technoir/transmissions] --output ./exported.json
 */
import { Command } from 'commander';
import { runGenerate }      from './commands/generate';
import { runList, formatTable } from './commands/list';
import { runExport }        from './commands/export';
import { DEFAULT_STORAGE_DIR } from '../adapters/storage/FileSystemStorage';

const program = new Command();

program
  .name('technoir')
  .description('Technoir Transmission Generator CLI')
  .version('1.0.0');

// ---------------------------------------------------------------------------
// generate
// ---------------------------------------------------------------------------
program
  .command('generate')
  .description('Generate a new Technoir transmission')
  .requiredOption('--theme <text>', 'Generation theme (e.g. "Neo-Tokyo 2099")')
  .option('--api-key <key>', 'Gemini API key (falls back to GEMINI_API_KEY env var)', '')
  .option('--preset <id>', 'Style preset id', 'neon-chrome')
  .option('--output <path>', 'Output JSON file path', './transmission.json')
  .option('--full', 'Generate all lead details (36 deep-dives)', false)
  // Commander's --no-<name> convention: --no-images sets opts.images=false (not opts.noImages)
  .option('--no-images', 'Skip all image generation')
  .action(async (opts) => {
    try {
      await runGenerate({
        theme:    opts.theme,
        apiKey:   opts.apiKey,
        preset:   opts.preset,
        output:   opts.output,
        full:     opts.full,
        noImages: opts.images === false,   // Commander sets opts.images, not opts.noImages
      });
    } catch (err) {
      process.stderr.write(`ERROR: ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------
program
  .command('list')
  .description('List saved transmissions')
  .option('--dir <path>', 'Storage directory', DEFAULT_STORAGE_DIR)
  .action(async (opts) => {
    try {
      const rows = await runList(opts.dir);
      process.stdout.write(formatTable(rows) + '\n');
    } catch (err) {
      process.stderr.write(`ERROR: ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// export
// ---------------------------------------------------------------------------
program
  .command('export <id>')
  .description('Export a saved transmission as JSON')
  .option('--dir <path>', 'Storage directory', DEFAULT_STORAGE_DIR)
  .requiredOption('--output <path>', 'Output file path')
  .option('--compress', 'Write gzip-compressed output (.json.gz)', false)
  .action(async (idStr, opts) => {
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      process.stderr.write('ERROR: <id> must be a number\n');
      process.exit(1);
    }
    try {
      await runExport(id, opts.dir, opts.output, opts.compress);
    } catch (err) {
      process.stderr.write(`ERROR: ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

program.parse();
