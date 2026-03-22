/**
 * adapters/storage/IndexedDbStorage.ts
 *
 * Browser implementation of IStorage backed by IndexedDB.
 * The DOM-specific helpers (exportTransmission, importTransmission, file pickers)
 * remain in services/db.ts — this adapter is pure storage.
 */
import type { IStorage } from './IStorage';
import type { Transmission } from '../../types';

const STORE_NAME     = 'transmissions';
const DB_VERSION     = 2;

export class IndexedDbStorage implements IStorage {
  private readonly dbName: string;

  constructor(dbName: string = 'TechnoirDB') {
    this.dbName = dbName;
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('stylePresets')) {
          db.createObjectStore('stylePresets', { keyPath: 'id' });
        }
      };
    });
  }

  async saveTransmission(transmission: Transmission): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(transmission);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllTransmissions(): Promise<Transmission[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result as Transmission[];
        results.sort((a, b) => b.id - a.id);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTransmission(id: number): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
