/**
 * adapters/archive/FileArchive.ts
 *
 * Node.js implementation of IArchive. Reads manifest.json and transmission
 * files from a local directory — useful for CLI offline use or testing
 * without a running HTTP server.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { IArchive } from './IArchive';
import type { CloudManifestItem, Transmission } from '../../types';

export class FileArchive implements IArchive {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  async fetchManifest(): Promise<CloudManifestItem[]> {
    try {
      const raw = await readFile(join(this.dir, 'manifest.json'), 'utf8');
      return JSON.parse(raw) as CloudManifestItem[];
    } catch {
      return [];
    }
  }

  async fetchTransmission(filename: string): Promise<Transmission> {
    const raw = await readFile(join(this.dir, filename), 'utf8');
    return JSON.parse(raw) as Transmission;
  }
}
