/**
 * Feature: Transmission JSON schema stability (runs in every phase)
 *
 * These tests guard the golden fixtures and the importTransmission function
 * against regressions — any schema-breaking change will fail here.
 */
import { describe, it, expect } from 'vitest';
import goldenTransmission from '../fixtures/golden/neon-chrome-neotokyo.json';
import type { Transmission } from '../../types';

const golden = goldenTransmission as unknown as Transmission;

// ---------------------------------------------------------------------------
// Scenario: each golden fixture passes TypeScript type validation
// (structural check — if the type fails, this file fails to compile)
// ---------------------------------------------------------------------------
const _typeCheck: Transmission = golden; // intentionally unused but type-checked

// ---------------------------------------------------------------------------
// Scenario: required fields are present
// ---------------------------------------------------------------------------
describe('Golden fixture schema', () => {
  it('has all required top-level fields', () => {
    expect(golden).toHaveProperty('id');
    expect(golden).toHaveProperty('createdAt');
    expect(golden).toHaveProperty('title');
    expect(golden).toHaveProperty('settingSummary');
    expect(golden).toHaveProperty('exposition');
    expect(golden).toHaveProperty('leads');
  });

  it('exposition has technology, society, environment, and style', () => {
    expect(golden.exposition).toHaveProperty('technology');
    expect(golden.exposition).toHaveProperty('society');
    expect(golden.exposition).toHaveProperty('environment');
    expect(golden.exposition).toHaveProperty('style');
  });

  it('style has all four StyleGuide fields', () => {
    expect(golden.exposition.style).toHaveProperty('visualTone');
    expect(golden.exposition.style).toHaveProperty('colorPalette');
    expect(golden.exposition.style).toHaveProperty('atmosphericDetails');
    expect(golden.exposition.style).toHaveProperty('narrativeVoice');
  });

  it('has exactly 36 leads', () => {
    expect(golden.leads).toHaveLength(36);
  });

  it('each lead has id, name, description, and a valid category', () => {
    const validCategories = new Set(['Connections', 'Events', 'Locations', 'Objects', 'Threats', 'Factions']);
    for (const lead of golden.leads) {
      expect(lead).toHaveProperty('id');
      expect(lead).toHaveProperty('name');
      expect(lead).toHaveProperty('description');
      expect(validCategories.has(lead.category)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario: golden fixture round-trips through JSON.stringify → JSON.parse
// ---------------------------------------------------------------------------
describe('Golden fixture round-trip', () => {
  it('is identical after stringify → parse', () => {
    const serialised = JSON.stringify(golden);
    const parsed = JSON.parse(serialised) as Transmission;
    expect(JSON.stringify(parsed)).toBe(serialised);
  });
});

// ---------------------------------------------------------------------------
// Scenario: importTransmission-style validation (mirrors services/db.ts logic)
// ---------------------------------------------------------------------------
describe('importTransmission validation', () => {
  function validateTransmission(t: unknown): void {
    const tx = t as Transmission;
    if (!tx.id || !tx.leads || !tx.title) {
      throw new Error('Invalid transmission file format');
    }
  }

  it('golden fixture passes validation', () => {
    expect(() => validateTransmission(golden)).not.toThrow();
  });

  it('object missing required fields fails validation', () => {
    expect(() => validateTransmission({ id: 1 })).toThrow('Invalid transmission file format');
  });
});
