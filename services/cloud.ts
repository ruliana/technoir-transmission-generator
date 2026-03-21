import { GCS_BUCKET_NAME, GCS_MANIFEST_FILE } from "../constants";
import { CloudManifestItem, Transmission } from "../types";

// --- READ-ONLY GCS OPERATIONS ---

const getPublicUrl = (filename: string) => `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${filename}`;

// Fetch the Public Manifest
export const fetchCloudManifest = async (): Promise<CloudManifestItem[]> => {
    try {
        // Hack: Append timestamp to prevent caching
        const res = await fetch(`${getPublicUrl(GCS_MANIFEST_FILE)}?t=${Date.now()}`);
        if (!res.ok) throw new Error("Manifest not found");
        return await res.json();
    } catch (e) {
        console.warn("Could not load cloud manifest", e);
        return [];
    }
};

// Fetch a specific Transmission from Cloud
export const fetchCloudTransmission = async (filename: string): Promise<Transmission> => {
    const res = await fetch(getPublicUrl(filename));
    if (!res.ok) throw new Error("Failed to load transmission");

    // Check if it's a gzip file
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
