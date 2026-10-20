import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nodemaster-version-test-'));
process.env.NODEMASTER_DATA_DIR = directory;
process.env.NODEMASTER_ADMIN_PASSWORD = 'version-test-password-123';
const { db } = await import('../dist/db/index.js');
const { getLatestXrayRelease, getXrayVersionMatrix, batchUpgradeXray } = await import('../dist/services/xrayVersionService.js');
const originalFetch = globalThis.fetch;
let fail = false, prerelease = false, requests = 0;
globalThis.fetch = async () => {
  requests++;
  if (fail) throw new Error('offline');
  return new Response(JSON.stringify({ tag_name: 'v26.3.27', published_at: '2026-03-27T17:51:11Z', prerelease }));
};

test('cached checks retain their timestamp and forced failures reject stale success', async () => {
  const release = await getLatestXrayRelease(true);
  const count = requests;
  const matrix = await getXrayVersionMatrix();
  assert.equal(matrix.checkedAt, release.cachedAt);
  assert.equal(requests, count);
  fail = true;
  await assert.rejects(getLatestXrayRelease(true), /无法获取官方版本信息/);
  const originalNow = Date.now;
  Date.now = () => release.cachedAt + 16 * 60 * 1000;
  try { await assert.rejects(getLatestXrayRelease(), /无法获取官方版本信息/); }
  finally { Date.now = originalNow; fail = false; }
});

test('prereleases are not accepted as the latest stable release', async () => {
  prerelease = true;
  try { await assert.rejects(getLatestXrayRelease(true), /无法获取官方版本信息/); }
  finally { prerelease = false; }
});

test('batch upgrade uses explicit target offline and skips newer, equal and unknown versions', async () => {
  for (const [id, version] of [['old', 'v1.8.24'], ['same', '26.3.27'], ['new', 'v26.4.1'], ['unknown', ''], ['invalid', 'garbage']]) {
    db.addNode({ id, name: id, xrayVersion: version, status: 'offline', type: 'direct' });
  }
  fail = true;
  const count = requests;
  const result = await batchUpgradeXray('v26.3.27');
  assert.equal(result.totalUpdated, 1);
  assert.equal(requests, count);
  assert.equal(db.getNodeById('old').desiredXrayVersion, 'v26.3.27');
  for (const id of ['same', 'new', 'unknown', 'invalid']) assert.equal(db.getNodeById(id).desiredXrayVersion, undefined);
  await assert.rejects(batchUpgradeXray('v1;bad'), /版本号格式无效/);
});

after(() => {
  globalThis.fetch = originalFetch;
  db.flush();
  fs.rmSync(directory, { recursive: true, force: true });
});
