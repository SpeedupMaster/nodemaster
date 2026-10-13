import https from "https";
import fs from "node:fs";
import { db } from "../db/index.js";
import { wsHub } from "./wsHub.js";
import { XrayVersionInfo, XrayVersionNodeStatus } from "../types/index.js";

interface GitHubReleaseCache {
  version: string;
  releaseUrl: string;
  publishedAt: string;
  releaseNotes: string;
  cachedAt: number;
}

let releaseCache: GitHubReleaseCache | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Normalize version string: e.g. "1.8.24" -> "v1.8.24", "v26.3.27" -> "v26.3.27"
export function normalizeVersion(v?: string): string {
  if (!v) return "";
  const trimmed = v.trim();
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

// Compare two version strings (e.g. "v1.8.24" vs "v26.3.27")
// Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
export function compareSemver(v1: string, v2: string): number {
  const clean1 = normalizeVersion(v1).replace(/^v/, "");
  const clean2 = normalizeVersion(v2).replace(/^v/, "");

  const parts1 = clean1.split(".").map((n) => parseInt(n, 10) || 0);
  const parts2 = clean2.split(".").map((n) => parseInt(n, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }
  return 0;
}

// Cache successful checks briefly; never present an expired check as current.
export async function getLatestXrayRelease(forceRefresh = false): Promise<GitHubReleaseCache> {
  const now = Date.now();
  if (!forceRefresh && releaseCache && now - releaseCache.cachedAt < CACHE_TTL_MS) {
    return releaseCache;
  }

  try {
    const data = await new Promise<any>((resolve, reject) => {
      const options = {
        hostname: "api.github.com",
        path: "/repos/XTLS/Xray-core/releases/latest",
        headers: {
          "User-Agent": "NodeMaster-Server/1.0",
          Accept: "application/vnd.github.v3+json",
        },
        timeout: 6000,
      };

      const req = https.get(options, (res) => {
        let body = "";
        res.on("error", reject);
        res.on("aborted", () => reject(new Error("GitHub API response aborted")));
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`GitHub API returned status ${res.statusCode}`));
          }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("GitHub API request timed out"));
      });
    });

    const version = normalizeVersion(data.tag_name);
    if (!/^v\d+\.\d+\.\d+$/.test(version) || data.draft || data.prerelease) throw new Error("Release response has no valid stable version");
    releaseCache = {
      version,
      releaseUrl: data.html_url || `https://github.com/XTLS/Xray-core/releases/tag/${version}`,
      publishedAt: data.published_at || new Date().toISOString(),
      releaseNotes: data.body ? data.body.slice(0, 500) : "Official Xray-core latest release",
      cachedAt: now,
    };
    return releaseCache;
  } catch (err: any) {
    console.warn("[XrayVersionService] Failed to query GitHub releases:", err.message);
    throw new Error("无法获取官方版本信息，请重试或指定明确的版本号");
  }
}

// Get full version status matrix across all nodes
export async function getXrayVersionMatrix(forceRefresh = false): Promise<XrayVersionInfo> {
  const latest = await getLatestXrayRelease(forceRefresh);
  const nodes = db.getNodes();

  const nodeStatuses: XrayVersionNodeStatus[] = nodes.map((n) => {
    const cur = normalizeVersion(n.xrayVersion);
    let status: XrayVersionNodeStatus["status"] = "unknown";
    if (cur) {
      status = compareSemver(cur, latest.version) < 0 ? "outdated" : "up_to_date";
    }

    return {
      nodeId: n.id,
      nodeName: n.name,
      currentVersion: cur,
      desiredVersion: n.desiredXrayVersion,
      upgradeStatus: n.upgradeStatus,
      upgradeError: n.upgradeError,
      status,
      arch: n.arch || "x86_64",
      os: n.os,
    };
  });

  return {
    latestVersion: latest.version,
    releaseUrl: latest.releaseUrl,
    publishedAt: latest.publishedAt,
    checkedAt: latest.cachedAt,
    nodes: nodeStatuses,
  };
}

// Upgrade a single node
export async function upgradeNodeXray(nodeId: string, customVersion?: string): Promise<{
  success: boolean;
  message: string;
  nodeId: string;
  newVersion: string;
}> {
  const node = db.getNodeById(nodeId);
  if (!node) {
    throw new Error(`未找到节点 [${nodeId}]`);
  }

  const targetVersion = normalizeVersion(customVersion || (await getLatestXrayRelease()).version);
  if (!/^v\d+\.\d+\.\d+$/.test(targetVersion)) throw new Error("Invalid release version");

  // Persist the desired state before dispatch; installed version comes only from telemetry.
  db.updateNode(node.id, {
    desiredXrayVersion: targetVersion,
    upgradeStatus: "pending",
    upgradeError: undefined,
  });
  const wsPushed = wsHub.pushUpgradeToAgent(node.id, targetVersion);
  wsHub.broadcastNodeUpdate(node.id);

  return {
    success: true,
    message: wsPushed
      ? `升级任务已下发，等待探针确认 ${targetVersion}`
      : `升级任务已排队，探针下一次上报时执行 ${targetVersion}`,
    nodeId: node.id,
    newVersion: targetVersion,
  };
}

// Batch upgrade all outdated nodes
export async function batchUpgradeXray(customVersion?: string): Promise<{
  success: boolean;
  totalUpdated: number;
  newVersion: string;
}> {
  const targetVersion = normalizeVersion(customVersion || (await getLatestXrayRelease()).version);
  if (!/^v\d+\.\d+\.\d+$/.test(targetVersion)) throw new Error("Invalid release version");
  let count = 0;

  for (const node of db.getNodes()) {
    const current = normalizeVersion(node.xrayVersion);
    // Unknown versions may be probe-only hosts; do not enqueue installs or downgrades.
    if (/^v\d+\.\d+\.\d+$/.test(current) && compareSemver(current, targetVersion) < 0) {
      await upgradeNodeXray(node.id, targetVersion);
      count++;
    }
  }

  return {
    success: true,
    totalUpdated: count,
    newVersion: targetVersion,
  };
}

// Generate standalone Linux one-click upgrade script
export function generateUpgradeScript(panelUrl: string, targetVersion: string): string {
  const version = normalizeVersion(targetVersion);
  if (!/^v[0-9]+[.][0-9]+[.][0-9]+$/.test(version)) throw new Error("Invalid version");
  return fs.readFileSync(new URL("../../data/xray-upgrade.sh", import.meta.url), "utf8").replaceAll("{{VERSION}}", version);
}
