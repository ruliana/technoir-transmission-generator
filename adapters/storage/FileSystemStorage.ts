/**
 * adapters/storage/FileSystemStorage.ts
 *
 * Node.js implementation of IStorage. Transmissions are persisted as plain
 * JSON files in a configurable directory (default: ~/.technoir/transmissions/).
 * Each file is named `<id>.json`.
 */
import { readdir, readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { IStorage } from './IStorage';
import type { Transmission } from '../../types';

export const DEFAULT_STORAGE_DIR = join(homedir(), '.technoir', 'transmissions');

export class FileSystemStorage implements IStorage {
  private readonly dir: string;

  constructor(dir: string = DEFAULT_STORAGE_DIR) {
    this.dir = dir;
  }

  /** Ensure the storage directory exists (idempotent). */
  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  private filePath(id: number): string {
    return join(this.dir, `${id}.json`);
  }

  async saveTransmission(transmission: Transmission): Promise<void> {
    await this.ensureDir();
    await writeFile(this.filePath(transmission.id), JSON.stringify(transmission), 'utf8');
  }

  async getAllTransmissions(): Promise<Transmission[]> {
    await this.ensureDir();
    const entries = await readdir(this.dir);
    const jsonFiles = entries.filter((f) => f.endsWith('.json'));

    const results: Transmission[] = [];
    for (const file of jsonFiles) {
      try {
        const raw = await readFile(join(this.dir, file), 'utf8');
        results.push(JSON.parse(raw) as Transmission);
      } catch {
        // Skip corrupt files silently
      }
    }

    // Sort newest first (id is a timestamp-based number)
    results.sort((a, b) => b.id - a.id);
    return results;
  }

  async deleteTransmission(id: number): Promise<void> {
    try {
      await unlink(this.filePath(id));
    } catch (err: unknown) {
      // ENOENT → file never existed, silently ignore
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
}
