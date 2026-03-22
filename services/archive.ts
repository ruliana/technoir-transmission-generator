import { ARCHIVE_URL_STORAGE_KEY, DEFAULT_ARCHIVE_URL } from "../constants";
import { CloudManifestItem, Transmission } from "../types";

/** Returns the configured archive base URL, stripping any trailing slash. */
export const getArchiveBaseUrl = (): string => {
    const stored = localStorage.getItem(ARCHIVE_URL_STORAGE_KEY);
    return (stored ?? DEFAULT_ARCHIVE_URL).replace(/\/+$/, '');
};

/** Fetch the archive manifest from the given base URL (or the configured default). */
export const fetchArchiveManifest = async (baseUrl?: string): Promise<CloudManifestItem[]> => {
    const base = (baseUrl ?? getArchiveBaseUrl()).replace(/\/+$/, '');
    try {
        const res = await fetch(`${base}/manifest.json?t=${Date.now()}`);
        if (!res.ok) throw new Error(`Manifest not found (HTTP ${res.status})`);
        return await res.json();
    } catch (e) {
        console.warn("Could not load archive manifest", e);
        return [];
    }
};

/** Fetch a specific transmission JSON (or .json.gz) from the given base URL. */
export const fetchArchiveTransmission = async (filename: string, baseUrl?: string): Promise<Transmission> => {
    const base = (baseUrl ?? getArchiveBaseUrl()).replace(/\/+$/, '');
    const res = await fetch(`${base}/${filename}`);
    if (!res.ok) throw new Error(`Failed to load transmission (HTTP ${res.status})`);

    if (filename.endsWith('.gz') || filename.endsWith('.json.gz')) {
        if (!('DecompressionStream' in window)) {
            throw new Error("Browser doesn't support decompression");
        }
        const ds = new DecompressionStream('gzip');
        const stream = res.body!.pipeThrough(ds);
        const response = new Response(stream);
        return await response.json();
    }

    return await res.json();
};
