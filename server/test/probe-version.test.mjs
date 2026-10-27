import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nodemaster-probe-version-test-'));
process.env.NODEMASTER_DATA_DIR = directory;
process.env.NODEMASTER_ADMIN_PASSWORD = 'probe-test-password-123';

const { db } = await import('../dist/db/index.js');
const {
  getLatestProbeVersion,
  generateProbeUpgradeScript,
  getProbeVersionMatrix,
  upgradeNodeProbe,
  batchUpgradeProbe,
} = await import('../dist/services/probeVersionService.js');

test('getLatestProbeVersion returns valid semver probe version', () => {
  const ver = getLatestProbeVersion();
  assert.match(ver, /^v\d+\.\d+\.\d+$/);
});

test('generateProbeUpgradeScript includes required commands and target version', () => {
  const script = generateProbeUpgradeScript('http://127.0.0.1:3000', 'v1.1.0');
  assert.ok(script.includes('TARGET_VER="v1.1.0"'));
  assert.ok(script.includes('PANEL_URL="http://127.0.0.1:3000"'));
  assert.ok(script.includes('/api/probe.py'));
  assert.ok(script.includes('ast.parse'));
  assert.ok(script.includes('nodemaster-probe'));
});

test('probe version matrix and batch upgrade manage node status correctly', async () => {
  const latestVer = getLatestProbeVersion();
  db.addNode({ id: 'probe-node-old', name: 'Old Node', probeVersion: 'v1.0.0', status: 'online', type: 'direct' });
  db.addNode({ id: 'probe-node-latest', name: 'Latest Node', probeVersion: latestVer, status: 'online', type: 'direct' });
  db.addNode({ id: 'probe-node-legacy', name: 'Legacy Node', status: 'online', type: 'direct' });

  const matrix = await getProbeVersionMatrix();
  assert.equal(matrix.latestVersion, latestVer);
  const oldNode = matrix.nodes.find(n => n.nodeId === 'probe-node-old');
  const latestNode = matrix.nodes.find(n => n.nodeId === 'probe-node-latest');
  const legacyNode = matrix.nodes.find(n => n.nodeId === 'probe-node-legacy');

  assert.equal(oldNode?.status, 'outdated');
  assert.equal(latestNode?.status, 'up_to_date');
  assert.equal(legacyNode?.status, 'outdated');

  // Single upgrade
  const singleRes = await upgradeNodeProbe('probe-node-old');
  assert.equal(singleRes.success, true);
  assert.equal(db.getNodeById('probe-node-old')?.desiredProbeVersion, latestVer);
  assert.equal(db.getNodeById('probe-node-old')?.probeUpgradeStatus, 'pending');

  // Batch upgrade
  const batchRes = await batchUpgradeProbe(latestVer);
  assert.equal(batchRes.success, true);
  // Both old and legacy needed upgrade
  assert.equal(batchRes.totalUpdated, 2);
  assert.equal(db.getNodeById('probe-node-legacy')?.desiredProbeVersion, latestVer);
  assert.equal(db.getNodeById('probe-node-legacy')?.probeUpgradeStatus, 'pending');
});
