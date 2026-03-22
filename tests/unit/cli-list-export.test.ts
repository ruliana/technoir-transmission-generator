/**
 * Feature: CLI list command
 * Feature: CLI export command
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FileSystemStorage } from '../../adapters/storage/FileSystemStorage';
import { runList, formatTable }   from '../../cli/commands/list';
import { runExport } from '../../cli/commands/export';
import goldenTransmission from '../fixtures/golden/neon-chrome-neotokyo.json';
import type { Transmission } from '../../types';

const golden = goldenTransmission as unknown as Transmission;

let tmpDir: string;
let storage: FileSystemStorage;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'technoir-cli-le-'));
  storage = new FileSystemStorage(tmpDir);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Feature: CLI list command
// ---------------------------------------------------------------------------
describe('runList', () => {
  it('returns an array of transmission summaries', async () => {
    await storage.saveTransmission(golden);
    const rows = await runList(tmpDir);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(golden.id);
    expect(rows[0].title).toBe(golden.title);
  });

  it('returns empty array for an empty directory', async () => {
    const rows = await runList(tmpDir);
    expect(rows).toEqual([]);
  });

  it('sorts newest first', async () => {
    const older = { ...golden, id: 1000, title: 'Older' };
    const newer = { ...golden, id: 2000, title: 'Newer' };
    await storage.saveTransmission(older);
    await storage.saveTransmission(newer);
    const rows = await runList(tmpDir);
    expect(rows[0].id).toBe(2000);
    expect(rows[1].id).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// Feature: formatTable output
// ---------------------------------------------------------------------------
describe('formatTable', () => {
  it('prints a "no transmissions" message for an empty array', () => {
    const output = formatTable([]);
    expect(output).toMatch(/no transmissions/i);
  });

  it('includes id, title, createdAt, and lead count for each row', () => {
    const rows = [{ id: 1703001600000, title: 'Ghost Protocol Zero', createdAt: '12/19/2023', leadCount: 36 }];
    const output = formatTable(rows);
    expect(output).toContain('Ghost Protocol Zero');
    expect(output).toContain('1703001600000');
    expect(output).toContain('12/19/2023');
    expect(output).toContain('36');
  });

  it('includes a header row', () => {
    const rows = [{ id: 1, title: 'T', createdAt: '1/1/2024', leadCount: 0 }];
    const output = formatTable(rows);
    expect(output).toMatch(/id/i);
    expect(output).toMatch(/title/i);
  });
});

// ---------------------------------------------------------------------------
// Feature: CLI export command
// ---------------------------------------------------------------------------
describe('runExport', () => {
  it('writes JSON identical to the stored fixture', async () => {
    await storage.saveTransmission(golden);
    const outputPath = join(tmpDir, 'exported.json');
    await runExport(golden.id, tmpDir, outputPath);

    const raw = await readFile(outputPath, 'utf8');
    const parsed = JSON.parse(raw) as Transmission;
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(golden));
  });

  it('throws when the transmission id is not found', async () => {
    await expect(
      runExport(9999999, tmpDir, join(tmpDir, 'out.json')),
    ).rejects.toThrow(/not found/i);
  });

  // -------------------------------------------------------------------------
  // Scenario: export --compress writes a .json.gz readable by decompression
  // -------------------------------------------------------------------------
  it('writes a valid gzip file when compress:true', async () => {
    await storage.saveTransmission(golden);
    const outputPath = join(tmpDir, 'exported.json.gz');
    await runExport(golden.id, tmpDir, outputPath, true);

    // Decompress and parse
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      createReadStream(outputPath)
        .pipe(createGunzip())
        .on('data', (chunk: Buffer) => chunks.push(chunk))
        .on('end', resolve)
        .on('error', reject);
    });
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Transmission;
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(golden));
  });
});
