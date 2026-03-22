/**
 * adapters/archive/BrowserArchive.ts
 *
 * Browser implementation of IArchive. Fetches manifest and transmissions
 * over HTTP. Class-wraps the logic that previously lived in services/archive.ts.
 */
import type { IArchive } from './IArchive';
import type { CloudManifestItem, Transmission } from '../../types';

export class BrowserArchive implements IArchive {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async fetchManifest(): Promise<CloudManifestItem[]> {
    try {
      const res = await fetch(`${this.baseUrl}/manifest.json?t=${Date.now()}`);
      if (!res.ok) throw new Error(`Manifest not found (HTTP ${res.status})`);
      return await res.json() as CloudManifestItem[];
    } catch (e) {
      console.warn('Could not load archive manifest', e);
      return [];
    }
  }

  async fetchTransmission(filename: string): Promise<Transmission> {
    const res = await fetch(`${this.baseUrl}/${filename}`);
    if (!res.ok) throw new Error(`Failed to load transmission (HTTP ${res.status})`);
    return await res.json() as Transmission;
  }
}
