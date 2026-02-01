
import { Transmission, StylePreset } from '../types';
import { DEFAULT_STYLE_PRESETS } from '../constants';

const DB_NAME = 'TechnoirDB';
const STORE_NAME = 'transmissions';
const STYLE_PRESETS_STORE = 'stylePresets';
const DB_VERSION = 2;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STYLE_PRESETS_STORE)) {
        db.createObjectStore(STYLE_PRESETS_STORE, { keyPath: 'id' });
      }
    };
  });
};

export const saveTransmission = async (transmission: Transmission): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(transmission);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteTransmission = async (id: number): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllTransmissions = async (): Promise<Transmission[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
        // Sort by newest first
        const results = request.result as Transmission[];
        results.sort((a, b) => b.id - a.id);
        resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

export const exportTransmission = async (transmission: Transmission) => {
    const filenameBase = `technoir_transmission_${transmission.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
    const filename = `${filenameBase}.json.gz`;
    const jsonStr = JSON.stringify(transmission);

    try {
        // Check if CompressionStream is available
        if ('CompressionStream' in window) {
            // Create a stream from the JSON string
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(jsonStr));
                    controller.close();
                }
            });

            const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));

            // Try File System Access API
            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await (window as any).showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'Technoir Transmission (Compressed)',
                            accept: { 'application/gzip': ['.json.gz', '.gz'] },
                        }],
                    });
                    const writable = await handle.createWritable();
                    await compressedStream.pipeTo(writable);
                    return;
                } catch (err: any) {
                    if (err.name === 'AbortError') return;
                    console.warn("File System Access API failed or unsupported, falling back to download", err);
                }
            }

            // Fallback: Download via Blob
            // Re-create stream since the previous one might be locked/used if FS API failed mid-way or to be safe
            const stream2 = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(jsonStr));
                    controller.close();
                }
            });
            const compressedStream2 = stream2.pipeThrough(new CompressionStream('gzip'));
            
            const response = new Response(compressedStream2);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            // Legacy/Fallback for no compression support
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement("a");
            link.href = url;
            link.download = `${filenameBase}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    } catch (e) {
        console.error("Export failed", e);
        alert("Export failed: " + (e as Error).message);
    }
};

export const importTransmission = async (file: File): Promise<void> => {
    let transmission: Transmission;

    try {
        if (file.name.endsWith('.gz') || file.name.endsWith('.json.gz')) {
             if (!('DecompressionStream' in window)) {
                 throw new Error("This browser does not support decompression.");
             }
             const ds = new DecompressionStream('gzip');
             const stream = file.stream().pipeThrough(ds);
             const response = new Response(stream);
             transmission = await response.json();
        } else {
            // Backward compatibility: Standard JSON
            const text = await file.text();
            transmission = JSON.parse(text);
        }

        // Validate
        if (!transmission.id || !transmission.leads || !transmission.title) {
            throw new Error("Invalid transmission file format");
        }

        await saveTransmission(transmission);
    } catch (err) {
        throw err;
    }
};

// Style Preset Functions
export const saveStylePreset = async (preset: StylePreset): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STYLE_PRESETS_STORE, 'readwrite');
    const store = tx.objectStore(STYLE_PRESETS_STORE);
    const request = store.put(preset);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteStylePreset = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STYLE_PRESETS_STORE, 'readwrite');
    const store = tx.objectStore(STYLE_PRESETS_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllStylePresets = async (): Promise<StylePreset[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STYLE_PRESETS_STORE, 'readonly');
    const store = tx.objectStore(STYLE_PRESETS_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result as StylePreset[];
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

export const initializeDefaultPresets = async (): Promise<void> => {
  try {
    const existing = await getAllStylePresets();
    if (existing.length > 0) {
      return; // Already initialized
    }

    // Save all default presets
    for (const preset of DEFAULT_STYLE_PRESETS) {
      await saveStylePreset(preset);
    }
  } catch (err) {
    console.error("Failed to initialize default presets", err);
  }
};
