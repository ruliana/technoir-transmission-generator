/**
 * Feature: ApiKeyProvider — explicit key resolution strategies
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EnvKeyProvider, LocalStorageKeyProvider } from '../../adapters/ApiKeyProvider';

// ---------------------------------------------------------------------------
// EnvKeyProvider
// ---------------------------------------------------------------------------
describe('EnvKeyProvider', () => {
  const ORIGINAL = process.env.GEMINI_API_KEY;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = ORIGINAL;
  });

  it('returns the key from GEMINI_API_KEY env var', () => {
    process.env.GEMINI_API_KEY = 'env-test-key';
    const provider = new EnvKeyProvider();
    expect(provider.getKey()).toBe('env-test-key');
  });

  it('returns key from a custom env var name', () => {
    process.env.MY_CUSTOM_KEY = 'custom-value';
    const provider = new EnvKeyProvider('MY_CUSTOM_KEY');
    expect(provider.getKey()).toBe('custom-value');
    delete process.env.MY_CUSTOM_KEY;
  });

  it('throws when the env var is absent', () => {
    delete process.env.GEMINI_API_KEY;
    const provider = new EnvKeyProvider();
    expect(() => provider.getKey()).toThrow(/GEMINI_API_KEY/);
  });
});

// ---------------------------------------------------------------------------
// LocalStorageKeyProvider — needs a localStorage stub in Node.js
// ---------------------------------------------------------------------------
describe('LocalStorageKeyProvider', () => {
  const store: Record<string, string> = {};
  const lsStub = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', lsStub);
    lsStub.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the key stored under the default key name', () => {
    store['technoir_api_key'] = 'ls-test-key';
    const provider = new LocalStorageKeyProvider();
    expect(provider.getKey()).toBe('ls-test-key');
  });

  it('returns the key stored under a custom key name', () => {
    store['my_custom_ls_key'] = 'custom-ls-value';
    const provider = new LocalStorageKeyProvider('my_custom_ls_key');
    expect(provider.getKey()).toBe('custom-ls-value');
  });

  it('throws when the localStorage key is absent', () => {
    const provider = new LocalStorageKeyProvider();
    expect(() => provider.getKey()).toThrow(/technoir_api_key/);
  });
});
