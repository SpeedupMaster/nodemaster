import path from "node:path";
import { fileURLToPath } from "node:url";

const bundledData = fileURLToPath(new URL("../data/", import.meta.url));

/** Writable runtime state (database, telemetry history, bootstrap credentials). */
export const DATA_DIR = process.env.NODEMASTER_DATA_DIR || bundledData;

/**
 * Read-only files shipped with the release (installer, probe agent, templates).
 * Kept separate from DATA_DIR so a mounted data volume cannot hide or freeze them.
 */
export const ASSETS_DIR = process.env.NODEMASTER_ASSETS_DIR || bundledData;

export const asset = (name: string) => path.join(ASSETS_DIR, name);
