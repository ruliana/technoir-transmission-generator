/**
 * adapters/ApiKeyProvider.ts
 *
 * Explicit API key resolution strategies. Using an interface means callers
 * (core/generator, CLI, tests) can swap the provider without coupling to
 * localStorage or process.env directly.
 */

export interface IApiKeyProvider {
  /** Returns the API key, or throws if none is available. */
  getKey(): string;
}

// ---------------------------------------------------------------------------
// EnvKeyProvider — reads from a process.env variable (CLI / server-side)
// ---------------------------------------------------------------------------
export class EnvKeyProvider implements IApiKeyProvider {
  private readonly varName: string;

  constructor(varName = 'GEMINI_API_KEY') {
    this.varName = varName;
  }

  getKey(): string {
    const key = process.env[this.varName];
    if (!key) throw new Error(`Missing environment variable: ${this.varName}`);
    return key;
  }
}

// ---------------------------------------------------------------------------
// LocalStorageKeyProvider — reads from localStorage (browser / BYOK)
// ---------------------------------------------------------------------------
export class LocalStorageKeyProvider implements IApiKeyProvider {
  private readonly storageKey: string;

  constructor(storageKey = 'technoir_api_key') {
    this.storageKey = storageKey;
  }

  getKey(): string {
    const key = localStorage.getItem(this.storageKey);
    if (!key) throw new Error(`No API key found in localStorage under "${this.storageKey}"`);
    return key;
  }
}
