/**
 * Feature: IndexedDB storage adapter satisfies the same IStorage contract
 *
 * Uses fake-indexeddb to run IndexedDB tests in Node.js without a browser.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';           // Installs globalThis.indexedDB, IDBKeyRange, etc.

import { IndexedDbStorage } from '../../adapters/storage/IndexedDbStorage';
import goldenTransmission from '../fixtures/golden/neon-chrome-neotokyo.json';
import type { Transmission } from '../../types';

const golden = goldenTransmission as unknown as Transmission;

// Each test gets a fresh DB instance with a unique name to avoid cross-test bleed
let storage: IndexedDbStorage;
let dbSeq = 0;

beforeEach(() => {
  storage = new IndexedDbStorage(`TechnoirTestDB-${++dbSeq}`);
});

// ---------------------------------------------------------------------------
// Scenario: save and getAll round-trips a golden fixture (fake-indexeddb)
// ---------------------------------------------------------------------------
describe('IndexedDbStorage round-trip', () => {
  it('preserves all fields of the golden fixture', async () => {
    await storage.saveTransmission(golden);
    const [result] = await storage.getAllTransmissions();

    expect(result.id).toBe(golden.id);
    expect(result.title).toBe(golden.title);
    expect(result.settingSummary).toBe(golden.settingSummary);
    expect(result.leads).toHaveLength(golden.leads.length);
    expect(result.exposition.technology).toBe(golden.exposition.technology);
  });

  it('serialises and deserialises identically via JSON', async () => {
    await storage.saveTransmission(golden);
    const [result] = await storage.getAllTransmissions();
    expect(JSON.stringify(result)).toBe(JSON.stringify(golden));
  });
});

// ---------------------------------------------------------------------------
// Scenario: delete removes a transmission by id
// ---------------------------------------------------------------------------
describe('IndexedDbStorage.delete', () => {
  it('removes a transmission so it no longer appears in getAll', async () => {
    await storage.saveTransmission(golden);
    await storage.deleteTransmission(golden.id);
    const result = await storage.getAllTransmissions();
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario: getAll returns results sorted newest first
// ---------------------------------------------------------------------------
describe('IndexedDbStorage.getAll ordering', () => {
  it('returns transmissions sorted by id descending', async () => {
    const older = { ...golden, id: 1000, title: 'Older' };
    const newer = { ...golden, id: 2000, title: 'Newer' };
    await storage.saveTransmission(older);
    await storage.saveTransmission(newer);
    const result = await storage.getAllTransmissions();
    expect(result[0].id).toBe(2000);
    expect(result[1].id).toBe(1000);
  });
});
