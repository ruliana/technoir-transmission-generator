/**
 * Feature: FileSystem storage adapter
 *
 * BDD scenarios for adapters/storage/FileSystemStorage.ts
 * Uses a real temp directory (cleaned after each test) — no mocks needed.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FileSystemStorage } from '../../adapters/storage/FileSystemStorage';
import goldenTransmission from '../fixtures/golden/neon-chrome-neotokyo.json';
import type { Transmission } from '../../types';

// Cast — JSON import type is inferred as generic object
const golden = goldenTransmission as unknown as Transmission;

// Each test gets its own isolated temp directory
let tmpDir: string;
let storage: FileSystemStorage;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'technoir-test-'));
  storage = new FileSystemStorage(tmpDir);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Scenario: save writes a JSON file named by transmission id
// ---------------------------------------------------------------------------
describe('FileSystemStorage.save', () => {
  it('writes a .json file named by the transmission id', async () => {
    await storage.saveTransmission(golden);
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(tmpDir);
    expect(files).toContain(`${golden.id}.json`);
  });

  it('overwrites an existing file when saving the same id', async () => {
    await storage.saveTransmission(golden);
    const updated = { ...golden, title: 'Updated Title' };
    await storage.saveTransmission(updated);
    const all = await storage.getAllTransmissions();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Updated Title');
  });
});

// ---------------------------------------------------------------------------
// Scenario: getAll reads all files and returns them sorted newest first
// ---------------------------------------------------------------------------
describe('FileSystemStorage.getAll', () => {
  it('returns an empty array when the directory is empty', async () => {
    const result = await storage.getAllTransmissions();
    expect(result).toEqual([]);
  });

  it('returns transmissions sorted by id (newest first)', async () => {
    const older = { ...golden, id: 1000, title: 'Older' };
    const newer = { ...golden, id: 2000, title: 'Newer' };
    await storage.saveTransmission(older);
    await storage.saveTransmission(newer);
    const result = await storage.getAllTransmissions();
    expect(result[0].id).toBe(2000);
    expect(result[1].id).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// Scenario: delete removes the file; subsequent getAll omits it
// ---------------------------------------------------------------------------
describe('FileSystemStorage.delete', () => {
  it('removes the transmission by id', async () => {
    await storage.saveTransmission(golden);
    await storage.deleteTransmission(golden.id);
    const result = await storage.getAllTransmissions();
    expect(result).toHaveLength(0);
  });

  it('does not throw when deleting a non-existent id', async () => {
    await expect(storage.deleteTransmission(9999999)).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Scenario: save then getAll round-trips a golden fixture without data loss
// ---------------------------------------------------------------------------
describe('FileSystemStorage round-trip', () => {
  it('preserves all fields of the golden fixture', async () => {
    await storage.saveTransmission(golden);
    const [result] = await storage.getAllTransmissions();

    expect(result.id).toBe(golden.id);
    expect(result.title).toBe(golden.title);
    expect(result.settingSummary).toBe(golden.settingSummary);
    expect(result.leads).toHaveLength(golden.leads.length);
    expect(result.exposition.technology).toBe(golden.exposition.technology);
    expect(result.exposition.style.visualTone).toBe(golden.exposition.style.visualTone);
  });

  it('round-trips through JSON.stringify → JSON.parse identically', async () => {
    await storage.saveTransmission(golden);
    const [result] = await storage.getAllTransmissions();
    // Serialise both and compare — ensures no fields are lost or mutated
    expect(JSON.stringify(result)).toBe(JSON.stringify(golden));
  });
});
