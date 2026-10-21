export const KB = 1024;
export const MB = 1024 ** 2;
export const GB = 1024 ** 3;
export const TB = 1024 ** 4;

/** Throughput split into value and unit, so the two can be styled separately. */
export function formatSpeed(bytesPerSec: number): { val: number; unit: string } {
  return bytesPerSec > MB ? { val: bytesPerSec / MB, unit: "MB/s" } : { val: bytesPerSec / KB, unit: "KB/s" };
}

/** Human readable size, e.g. "1.5 GB". */
export function formatBytes(bytes: number | undefined, digits = 1): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : digits)} ${units[i]}`;
}

/** Bytes as GB with a fixed number of decimals, for "used / limit GB" displays. */
export const toGB = (bytes: number, digits = 1) => (bytes / GB).toFixed(digits);
export const formatPct = (val: number | undefined) => Number((val || 0).toFixed(2));
