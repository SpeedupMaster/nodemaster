import fs from "node:fs";
import { db } from "../db/index.js";
import { asset } from "../paths.js";
import { wsHub } from "./wsHub.js";
import { HttpError, InputError } from "./validation.js";
import type { ProbeVersionInfo, ProbeVersionNodeStatus } from "../types/index.js";

const DEFAULT_PROBE_VERSION = "v1.1.0";

/**
 * Returns the current probe version shipped by the panel by inspecting probe.py.
 */
export function getLatestProbeVersion(): string {
  try {
    const content = fs.readFileSync(asset("probe.py"), "utf-8");
    const match = content.match(/PROBE_VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (err) {
    console.warn("[ProbeVersionService] Failed to read probe.py version:", err);
  }
  return DEFAULT_PROBE_VERSION;
}

/**
 * Generate standalone bash script for upgrading the probe agent on a remote VPS.
 */
export function generateProbeUpgradeScript(panelUrl: string, targetVersion: string): string {
  const cleanPanel = panelUrl.replace(/\/+$/, "");
  return `#!/usr/bin/env bash
# ==============================================================================
# NodeMaster Probe Agent Online Upgrade Script (${targetVersion})
# ==============================================================================
set -euo pipefail
umask 077

PANEL_URL="${cleanPanel}"
TARGET_VER="${targetVersion}"

echo "=== [NodeMaster] Upgrading Probe Agent to \${TARGET_VER} ==="

TEMP_BIN="/usr/local/bin/nodemaster-probe.new"
curl -fsSL --connect-timeout 10 --max-time 45 "\${PANEL_URL}/api/probe.py" -o "\${TEMP_BIN}"

# Validate Python AST before overwriting active probe
python3 -c 'import ast; ast.parse(open("'\${TEMP_BIN}'").read())' || {
  echo "Downloaded probe.py syntax check failed" >&2
  rm -f "\${TEMP_BIN}"
  exit 1
}

chmod +x "\${TEMP_BIN}"
mv -f "\${TEMP_BIN}" /usr/local/bin/nodemaster-probe

if [ -f /etc/nodemaster/probe.py ]; then
  cp -p /usr/local/bin/nodemaster-probe /etc/nodemaster/probe.py
fi

echo "✓ Probe binary updated to \${TARGET_VER}"

# Restart probe service without blocking caller
if command -v systemctl >/dev/null 2>&1; then
  systemctl restart --no-block nodemaster-probe 2>/dev/null || (sleep 1 && systemctl restart nodemaster-probe) >/dev/null 2>&1 &
fi

echo "✓ Upgrade triggered successfully."
`;
}

/**
 * Get current probe version status for all nodes.
 */
export async function getProbeVersionMatrix(): Promise<ProbeVersionInfo> {
  const latestVersion = getLatestProbeVersion();
  const nodes = db.getNodes();

  const nodeStatuses: ProbeVersionNodeStatus[] = nodes.map(node => {
    const current = node.probeVersion?.trim() || "";
    let status: "up_to_date" | "outdated" | "unknown" = "unknown";
    if (!current) {
      status = "outdated"; // No version reported means old probe
    } else if (current === latestVersion) {
      status = "up_to_date";
    } else {
      status = "outdated";
    }

    return {
      nodeId: node.id,
      nodeName: node.name,
      currentVersion: current || undefined,
      desiredVersion: node.desiredProbeVersion,
      status,
      upgradeStatus: node.probeUpgradeStatus,
      upgradeError: node.probeUpgradeError,
      arch: node.arch,
      os: node.os,
    };
  });

  return {
    latestVersion,
    checkedAt: Date.now(),
    nodes: nodeStatuses,
  };
}

/**
 * Enqueue probe upgrade for a single node.
 */
export async function upgradeNodeProbe(nodeId: string, customVersion?: string): Promise<{
  success: boolean;
  message: string;
  nodeId: string;
  newVersion: string;
}> {
  const node = db.getNodeById(nodeId);
  if (!node) {
    throw new HttpError(404, `未找到节点 [${nodeId}]`);
  }

  const targetVersion = (customVersion || getLatestProbeVersion()).trim();
  if (!/^v\d+\.\d+\.\d+$/.test(targetVersion)) {
    throw new InputError("版本号格式无效，应为 vX.Y.Z");
  }

  db.updateNode(node.id, {
    desiredProbeVersion: targetVersion,
    probeUpgradeStatus: "pending",
    probeUpgradeError: undefined,
  });
  wsHub.broadcastNodeUpdate(node.id);

  return {
    success: true,
    message: `探针升级任务已排队，下一次心跳周期（3秒内）执行升级至 ${targetVersion}`,
    nodeId: node.id,
    newVersion: targetVersion,
  };
}

/**
 * Batch enqueue probe upgrade for all nodes that are not running targetVersion.
 */
export async function batchUpgradeProbe(customVersion?: string): Promise<{
  success: boolean;
  totalUpdated: number;
  newVersion: string;
}> {
  const targetVersion = (customVersion || getLatestProbeVersion()).trim();
  if (!/^v\d+\.\d+\.\d+$/.test(targetVersion)) {
    throw new InputError("版本号格式无效，应为 vX.Y.Z");
  }

  let count = 0;
  for (const node of db.getNodes()) {
    if (node.probeVersion !== targetVersion) {
      await upgradeNodeProbe(node.id, targetVersion);
      count++;
    }
  }

  return {
    success: true,
    totalUpdated: count,
    newVersion: targetVersion,
  };
}
