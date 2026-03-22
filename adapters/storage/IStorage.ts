import type { Transmission } from '../../types';

/**
 * Storage adapter interface — implemented by both IndexedDbStorage (browser)
 * and FileSystemStorage (Node.js / CLI).
 */
export interface IStorage {
  saveTransmission(transmission: Transmission): Promise<void>;
  getAllTransmissions(): Promise<Transmission[]>;
  deleteTransmission(id: number): Promise<void>;
}
