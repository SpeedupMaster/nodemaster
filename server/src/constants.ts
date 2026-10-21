// Single source for defaults and limits that used to be repeated across routes and generators.

export const GB = 1024 ** 3;
export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

export const DEFAULT_REALITY_PORT = 443;
export const DEFAULT_SS_PORT = 8388;
export const DEFAULT_SNI = "www.microsoft.com";
export const REALITY_FLOW = "xtls-rprx-vision";
export const REALITY_FINGERPRINT = "chrome";

export const SS_CIPHERS = [
  "2022-blake3-aes-128-gcm",
  "2022-blake3-aes-256-gcm",
  "2022-blake3-chacha20-poly1305",
  "aes-128-gcm",
  "aes-256-gcm",
  "chacha20-ietf-poly1305",
] as const;
export const DEFAULT_SS_CIPHER = SS_CIPHERS[0];
/** Key length in bytes required by the SS-2022 ciphers (and used for generated AEAD passwords). */
export const ssKeyLength = (cipher: string) => (cipher === "2022-blake3-aes-128-gcm" ? 16 : 32);

export const DEFAULT_TRAFFIC_LIMIT = { direct: 1000 * GB, unlock: 2000 * GB };
export const DEFAULT_BANDWIDTH_MBPS = 1000;
export const DEFAULT_TAGS = { direct: ["Xray", "Reality", "主力直连"], unlock: ["住宅IP", "Shadowsocks", "流媒体解锁"] };

/** A node without telemetry for this long is considered offline. */
export const OFFLINE_AFTER_MS = 30_000;
export const HEARTBEAT_MS = 3_000;

export const PASSWORD_MIN_LENGTH = 8;
export const LEGACY_DEFAULT_PASSWORD = "admin123456";

const XRAY_VERSION = /^v?\d+\.\d+\.\d+$/;
export const isXrayVersion = (v: unknown): v is string => typeof v === "string" && XRAY_VERSION.test(v);
