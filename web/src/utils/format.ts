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

/** Human readable system uptime using 秒, 分, 小时, 天, 月, 年 */
export function formatUptime(uptime: string | number | undefined): string {
  if (!uptime && uptime !== 0) return "未知";
  let totalSec = typeof uptime === "number" ? uptime : NaN;
  if (typeof uptime === "string") {
    if (/^\d+(\.\d+)?\s*秒?$/.test(uptime.trim())) {
      totalSec = parseFloat(uptime);
    } else {
      return uptime;
    }
  }
  if (!Number.isFinite(totalSec) || totalSec < 0) return typeof uptime === "string" ? uptime : "未知";

  const sec = Math.floor(totalSec);
  const MINUTE = 60;
  const HOUR = 3600;
  const DAY = 86400;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  if (sec >= YEAR) {
    const y = Math.floor(sec / YEAR);
    const m = Math.floor((sec % YEAR) / MONTH);
    return m > 0 ? `${y}年 ${m}月` : `${y}年`;
  }
  if (sec >= MONTH) {
    const m = Math.floor(sec / MONTH);
    const d = Math.floor((sec % MONTH) / DAY);
    return d > 0 ? `${m}月 ${d}天` : `${m}月`;
  }
  if (sec >= DAY) {
    const d = Math.floor(sec / DAY);
    const h = Math.floor((sec % DAY) / HOUR);
    return h > 0 ? `${d}天 ${h}小时` : `${d}天`;
  }
  if (sec >= HOUR) {
    const h = Math.floor(sec / HOUR);
    const m = Math.floor((sec % HOUR) / MINUTE);
    return m > 0 ? `${h}小时 ${m}分` : `${h}小时`;
  }
  if (sec >= MINUTE) {
    const m = Math.floor(sec / MINUTE);
    const s = sec % MINUTE;
    return s > 0 ? `${m}分 ${s}秒` : `${m}分`;
  }
  return `${Math.max(1, sec)}秒`;
}
