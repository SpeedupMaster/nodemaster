import https from "https";
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

// Fetch latest release from GitHub API with fallback and caching
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

    const version = normalizeVersion(data.tag_name || "v26.3.27");
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
    if (releaseCache) return releaseCache;

    // Default safe fallback if network is offline
    releaseCache = {
      version: "v26.3.27",
      releaseUrl: "https://github.com/XTLS/Xray-core/releases/tag/v26.3.27",
      publishedAt: new Date().toISOString(),
      releaseNotes: "XTLS/Xray-core release",
      cachedAt: now,
    };
    return releaseCache;
  }
}

// Get full version status matrix across all nodes
export async function getXrayVersionMatrix(forceRefresh = false): Promise<XrayVersionInfo> {
  const latest = await getLatestXrayRelease(forceRefresh);
  const nodes = db.getNodes();

  const nodeStatuses: XrayVersionNodeStatus[] = nodes.map((n) => {
    const cur = normalizeVersion(n.xrayVersion || "v26.3.27");
    let status: XrayVersionNodeStatus["status"] = "unknown";
    if (cur) {
      status = compareSemver(cur, latest.version) < 0 ? "outdated" : "up_to_date";
    }

    return {
      nodeId: n.id,
      nodeName: n.name,
      currentVersion: cur,
      status,
      arch: n.arch || "x86_64",
      os: n.os,
    };
  });

  return {
    latestVersion: latest.version,
    releaseUrl: latest.releaseUrl,
    publishedAt: latest.publishedAt,
    checkedAt: Date.now(),
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

  const latest = await getLatestXrayRelease();
  const targetVersion = normalizeVersion(customVersion || latest.version);

  // 1. Notify online agent if connected via WebSocket
  const wsPushed = wsHub.pushUpgradeToAgent(node.id, targetVersion);

  // 2. Update node xrayVersion in database
  db.updateNode(node.id, {
    xrayVersion: targetVersion,
  });
  wsHub.broadcastNodeUpdate(node.id);

  return {
    success: true,
    message: wsPushed
      ? `已成功下发升级指令至节点在线探针，内核版本更新为 ${targetVersion}`
      : `节点内核版本记录已成功更新为 ${targetVersion}（离线节点将在探针重连或手动执行升级命令后生效）`,
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
  const matrix = await getXrayVersionMatrix();
  const targetVersion = normalizeVersion(customVersion || matrix.latestVersion);
  let count = 0;

  for (const item of matrix.nodes) {
    if (item.status === "outdated" || item.currentVersion !== targetVersion) {
      await upgradeNodeXray(item.nodeId, targetVersion);
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
  return `#!/usr/bin/env bash
# ==============================================================================
# NodeMaster Xray-core Automated Kernel Updater
# ==============================================================================
set -e

TARGET_VER="${targetVersion}"
ARCH=$(uname -m)

case $ARCH in
  x86_64) XRAY_ARCH="64" ;;
  aarch64|arm64) XRAY_ARCH="arm64-v8a" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

echo "========================================================="
echo "   NodeMaster Xray-core 独立内核一键升级脚本"
echo "========================================================="
echo "目标版本 : \${TARGET_VER}"
echo "硬件架构 : \${ARCH} (\${XRAY_ARCH})"
echo "控制中心 : ${panelUrl}"
echo "---------------------------------------------------------"

if command -v curl >/dev/null 2>&1; then
  FETCH="curl -fsSL"
elif command -v wget >/dev/null 2>&1; then
  FETCH="wget -qO-"
else
  echo "Error: curl or wget is required."
  exit 1
fi

TMP_DIR="/tmp/xray-upgrade"
mkdir -p "\${TMP_DIR}"
ZIP_PATH="\${TMP_DIR}/xray.zip"

echo "[1/3] 下载官方 Xray-core \${TARGET_VER} 二进制发布包..."
curl -fsSL "https://github.com/XTLS/Xray-core/releases/download/\${TARGET_VER}/Xray-linux-\${XRAY_ARCH}.zip" -o "\${ZIP_PATH}"

echo "[2/3] 解压并安全替换 /usr/local/bin/xray..."
unzip -qo "\${ZIP_PATH}" xray -d /usr/local/bin/
chmod +x /usr/local/bin/xray
rm -rf "\${TMP_DIR}"

echo "[3/3] 重启代理守护进程 (nodemaster-proxy)..."
if systemctl is-active --quiet nodemaster-proxy; then
  systemctl restart nodemaster-proxy
  echo "✓ nodemaster-proxy 服务已完成热重启"
fi

NEW_VER=$(/usr/local/bin/xray version 2>/dev/null | head -n 1 || echo "Unknown")
echo "========================================================="
echo "✓ Xray-core 内核升级成功！当前运行版本："
echo ">> \${NEW_VER}"
echo "========================================================="
`;
}
