/**
 * cli/commands/export.ts
 *
 * Implements `technoir export <id>` — reads a stored transmission by id and
 * writes it as JSON (or gzip-compressed JSON) to the specified output path.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname } from 'node:path';
import { createGzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { FileSystemStorage, DEFAULT_STORAGE_DIR } from '../../adapters/storage/FileSystemStorage';
import { makeLogger } from '../utils/progress';

/**
 * Exported as a pure function for easy testing.
 *
 * @param id           Transmission numeric id.
 * @param storageDir   Directory containing stored transmissions.
 * @param outputPath   Where to write the exported file.
 * @param compress     When true, gzip the output (recommended for .json.gz paths).
 */
export async function runExport(
  id: number,
  storageDir: string = DEFAULT_STORAGE_DIR,
  outputPath: string,
  compress = false,
): Promise<void> {
  const storage = new FileSystemStorage(storageDir);
  const all = await storage.getAllTransmissions();
  const transmission = all.find((t) => t.id === id);

  if (!transmission) {
    throw new Error(`Transmission ${id} not found in ${storageDir}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });

  const json = JSON.stringify(transmission, null, 2);

  if (compress) {
    const source = Readable.from([Buffer.from(json, 'utf8')]);
    const gzip   = createGzip();
    const dest   = createWriteStream(outputPath);
    await pipeline(source, gzip, dest);
  } else {
    await writeFile(outputPath, json, 'utf8');
  }

  const onLog = makeLogger();
  onLog(`>> Exported transmission "${transmission.title}" to ${outputPath}`);
}
