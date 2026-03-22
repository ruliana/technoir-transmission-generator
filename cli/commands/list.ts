/**
 * cli/commands/list.ts
 *
 * Implements `technoir list` — reads the local storage directory and returns
 * a summary table of saved transmissions.
 */
import { FileSystemStorage, DEFAULT_STORAGE_DIR } from '../../adapters/storage/FileSystemStorage';

export interface TransmissionSummary {
  id: number;
  title: string;
  createdAt: string;
  leadCount: number;
}

/**
 * Returns summaries for all transmissions in `storageDir`, sorted newest first.
 * Exported as a pure function for easy testing.
 */
export async function runList(
  storageDir: string = DEFAULT_STORAGE_DIR,
): Promise<TransmissionSummary[]> {
  const storage = new FileSystemStorage(storageDir);
  const transmissions = await storage.getAllTransmissions();
  return transmissions.map((t) => ({
    id:        t.id,
    title:     t.title,
    createdAt: t.createdAt,
    leadCount: t.leads.length,
  }));
}

/**
 * Formats summaries as a human-readable table string (for CLI output).
 */
export function formatTable(rows: TransmissionSummary[]): string {
  if (rows.length === 0) {
    return 'No transmissions found. Run `technoir generate` to create one.';
  }
  const header = `${'ID'.padEnd(16)} ${'Created'.padEnd(12)} ${'Leads'.padEnd(6)} Title`;
  const divider = '─'.repeat(80);
  const lines = rows.map(
    (r) =>
      `${String(r.id).padEnd(16)} ${r.createdAt.padEnd(12)} ${String(r.leadCount).padEnd(6)} ${r.title}`,
  );
  return [header, divider, ...lines].join('\n');
}
