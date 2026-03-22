import type { CloudManifestItem, Transmission } from '../../types';

/**
 * Archive adapter interface — implemented by BrowserArchive (HTTP fetch) and
 * FileArchive (local directory read).
 */
export interface IArchive {
  fetchManifest(): Promise<CloudManifestItem[]>;
  fetchTransmission(filename: string): Promise<Transmission>;
}
