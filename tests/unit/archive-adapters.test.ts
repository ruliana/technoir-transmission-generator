/**
 * Feature: Archive adapters
 *
 * BrowserArchive uses fetch (mocked via vi.stubGlobal).
 * FileArchive uses the real filesystem via a temp directory.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BrowserArchive } from '../../adapters/archive/BrowserArchive';
import { FileArchive }    from '../../adapters/archive/FileArchive';
import goldenTransmission from '../fixtures/golden/neon-chrome-neotokyo.json';
import type { Transmission, CloudManifestItem } from '../../types';

const golden = goldenTransmission as unknown as Transmission;

const manifestItems: CloudManifestItem[] = [
  { id: golden.id, title: golden.title, summary: golden.settingSummary, createdAt: golden.createdAt, filename: `${golden.id}.json` },
];

// ---------------------------------------------------------------------------
// BrowserArchive — fetch mocked
// ---------------------------------------------------------------------------
describe('BrowserArchive', () => {
  let archive: BrowserArchive;

  beforeEach(() => {
    archive = new BrowserArchive('https://example.com/archives');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchManifest returns parsed manifest items', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => manifestItems,
    }));
    const result = await archive.fetchManifest();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe(golden.title);
  });

  it('fetchManifest returns [] when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 404 }));
    const result = await archive.fetchManifest();
    expect(result).toEqual([]);
  });

  it('fetchTransmission returns parsed transmission JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => golden,
    }));
    const result = await archive.fetchTransmission(`${golden.id}.json`);
    expect(result.title).toBe(golden.title);
  });

  it('fetchTransmission throws when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 403 }));
    await expect(archive.fetchTransmission('missing.json')).rejects.toThrow(/403/);
  });
});

// ---------------------------------------------------------------------------
// FileArchive — real temp directory
// ---------------------------------------------------------------------------
describe('FileArchive', () => {
  let tmpDir: string;
  let archive: FileArchive;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'technoir-archive-'));
    archive = new FileArchive(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('fetchManifest reads manifest.json from the directory', async () => {
    await writeFile(join(tmpDir, 'manifest.json'), JSON.stringify(manifestItems), 'utf8');
    const result = await archive.fetchManifest();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(golden.id);
  });

  it('fetchManifest returns [] when manifest.json is absent', async () => {
    const result = await archive.fetchManifest();
    expect(result).toEqual([]);
  });

  it('fetchTransmission reads a transmission JSON file from the directory', async () => {
    const filename = `${golden.id}.json`;
    await writeFile(join(tmpDir, filename), JSON.stringify(golden), 'utf8');
    const result = await archive.fetchTransmission(filename);
    expect(result.title).toBe(golden.title);
    expect(result.leads).toHaveLength(golden.leads.length);
  });

  it('fetchTransmission throws when the file does not exist', async () => {
    await expect(archive.fetchTransmission('missing.json')).rejects.toThrow();
  });
});
