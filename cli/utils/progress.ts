/**
 * cli/utils/progress.ts
 *
 * Terminal progress helpers. All output goes to stderr so stdout stays
 * clean and can be piped to other tools.
 */

/** Log a progress message to stderr. */
export function logProgress(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

/** Create an onLog callback that prefixes messages and writes to stderr. */
export function makeLogger(prefix = ''): (msg: string) => void {
  return (msg: string) => process.stderr.write(`${prefix}${msg}\n`);
}
