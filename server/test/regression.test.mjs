import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import WebSocket from 'ws';
import { once } from 'node:events';
import http from 'node:http';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nodemaster-test-'));
process.env.NODEMASTER_DATA_DIR = directory;
process.env.NODEMASTER_ADMIN_PASSWORD = 'test-initial-password-123';
const { db, Database } = await import('../dist/db/index.js');
const { signToken, verifyToken } = await import('../dist/services/authService.js');
const { generateRealityCredentials } = await import('../dist/services/xrayConfig.js');
const { deriveRealityPublicKey, billingPeriod, atomicWriteJson } = await import('../dist/services/security.js');
const { WsHub } = await import('../dist/services/wsHub.js');
const { ingestTelemetry, maintainNodes, agentDirectives } = await import('../dist/services/telemetryService.js');
const { apiRouter, getNodeXrayConfig } = await import('../dist/routes/api.js');
const { trafficService } = await import('../dist/services/trafficService.js');
const { historyStore } = await import('../dist/services/historyStore.js');
const { upgradeNodeXray, generateUpgradeScript } = await import('../dist/services/xrayVersionService.js');
const { assembleProxies } = await import('../dist/services/subscription.js');
const app = express(); app.use(express.json()); app.use('/api', apiRouter);
const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
let token = signToken({ sub: 'admin', role: 'admin' });
const request = async (url, method = 'GET', body, auth = token) => {
  const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data };
};
const makeNode = (id, overrides = {}) => db.addNode({ id, name: id, ip: '127.0.0.1', port: 443, type: 'direct', protocol: 'vless-reality', status: 'online', country: 'US', countryName: 'Test', token: `token-${id}`, trafficUsedBytes: 0, trafficLimitBytes: 10000, uplinkSpeedBytes: 0, downlinkSpeedBytes: 0, cpuUsage: 0, memUsage: 0, diskUsage: 0, latencyMs: 0, lastSeen: Date.now(), createdAt: Date.now(), tags: [], reality: generateRealityCredentials(), configVersion: 1, appliedConfigVersion: 1, trafficPeriodStart: billingPeriod(Date.now(), 1), ...overrides });
const report = (id, seq, rx, tx, overrides = {}) => ingestTelemetry(id, { bootId: 'boot-test', sequence: seq, networkRxBytes: rx, networkTxBytes: tx, cpuUsage: 20, ...overrides });

test('fresh deployment contains no sample nodes or fixed administrator secrets', () => {
  assert.equal(db.getNodes().length, 0);
  assert.equal(db.getSubscriptions().length, 0);
  assert.ok(db.getConfig().jwtSecret.length >= 48);
  assert.ok(db.getAdmin().sessionVersion);
  assert.equal(trafficService.getTrafficAnalytics('today').totalRecordedBytes, 0);
});
test('generated Reality keys are a valid X25519 pair', () => {
  const keys = generateRealityCredentials();
  assert.equal(deriveRealityPublicKey(keys.privateKey), keys.publicKey);
});
test('forged, malformed-role, missing-expiry and expired JWTs are rejected', async () => {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ sub: 'admin', role: 'admin' })).toString('base64url');
  const sig = crypto.createHmac('sha256', 'nm_secret_key_8848_secure').update(`${h}.${p}`).digest('base64url');
  assert.equal((await request('/api/nodes', 'GET', undefined, `${h}.${p}.${sig}`)).status, 401);
  assert.equal(verifyToken(signToken({ sub: 'admin', role: 'viewer' })).valid, false);
  assert.equal(verifyToken(signToken({ sub: 'admin', role: 'admin' }, -1)).valid, false);
});
test('password change and logout revoke old sessions', async () => {
  const old = token;
  const changed = await request('/api/auth/change-password', 'POST', { oldPassword: 'test-initial-password-123', newPassword: 'test-new-password-456' });
  assert.equal(changed.status, 200); token = changed.data.data.token;
  assert.equal((await request('/api/nodes', 'GET', undefined, old)).status, 401);
  assert.equal((await request('/api/auth/logout', 'POST', {})).status, 200);
  assert.equal((await request('/api/nodes')).status, 401);
  token = signToken({ sub: 'admin', role: 'admin' });
});
test('malformed payloads return 400 and valid zero quota is preserved', async () => {
  assert.equal((await request('/api/nodes', 'POST', { name: {}, ip: '1.2.3.4' })).status, 400);
  assert.equal((await request('/api/nodes', 'POST', { name: 'test', ip: '1.2.3.4', port: -1 })).status, 400);
  const response = await request('/api/nodes', 'POST', { name: 'zero', ip: '1.2.3.4', trafficLimitBytes: 0 });
  assert.equal(response.status, 200); assert.equal(response.data.data.trafficLimitBytes, 0); assert.equal(response.data.data.status, 'offline');
});
test('installer uses the permitted token endpoint and serves a valid Python agent', async () => {
  makeNode('install');
  assert.equal((await request('/api/nodes/install/xray-config', 'GET', undefined, null)).status, 401);
  assert.equal((await request('/api/nodes/by-token/token-install/xray-config', 'GET', undefined, null)).status, 200);
  const script = (await request('/api/install.sh', 'GET', undefined, null)).data;
  assert.ok(script.includes('/api/nodes/by-token/${TOKEN}/xray-config'));
  assert.ok(!script.includes('/api/nodes/${NODE_ID}/xray-config'));
  assert.equal((await request('/api/probe.py', 'GET', undefined, null)).status, 200);
});
test('SNI changes update destination and clearing nullable fields persists', async () => {
  makeNode('sni', { costAmount: 10, expiresAt: '2027-01-01' });
  const response = await request('/api/nodes/sni', 'PUT', { sni: 'example.org', costAmount: null, expiresAt: null });
  assert.equal(response.status, 200);
  const n = db.getNodeById('sni'); assert.equal(n.reality.dest, 'example.org:443'); assert.equal(n.costAmount, undefined); assert.equal(n.expiresAt, undefined);
});
test('stale nodes go offline without synthetic counters or heartbeat updates', () => {
  makeNode('stale', { lastSeen: 1, uplinkSpeedBytes: 200 });
  maintainNodes(); const n = db.getNodeById('stale');
  assert.equal(n.lastSeen, 1); assert.equal(n.trafficUsedBytes, 0); assert.equal(n.status, 'offline'); assert.equal(n.uplinkSpeedBytes, 0);
});
test('real counters bill deltas once and handle reboot without fabricated traffic', () => {
  makeNode('counter'); report('counter', 1, 100, 200); report('counter', 2, 150, 250); report('counter', 2, 150, 250);
  assert.equal(db.getNodeById('counter').trafficUsedBytes, 100);
  report('counter', 1, 10, 20, { bootId: 'new-boot' }); assert.equal(db.getNodeById('counter').trafficUsedBytes, 100);
  report('counter', 2, 20, 30, { bootId: 'new-boot' }); assert.equal(db.getNodeById('counter').trafficUsedBytes, 120);
});
test('quota breaker persists across telemetry and removes inbounds and subscription entries', () => {
  makeNode('breaker', { trafficLimitBytes: 100 }); report('breaker', 1, 0, 0); report('breaker', 2, 60, 40);
  const n = report('breaker', 3, 60, 40);
  assert.equal(n.status, 'circuit_broken'); assert.equal(agentDirectives(n).proxyAction, 'STOP');
  assert.equal(getNodeXrayConfig(n).inbounds.length, 0); assert.equal(assembleProxies([n], []).length, 0);
});
test('monthly reset handles short months and invalidates stopped configuration', () => {
  const january = new Date(2026, 0, 31).getTime(), february = new Date(2026, 1, 28, 12).getTime();
  makeNode('monthly', { trafficResetDay: 31, trafficPeriodStart: january, status: 'circuit_broken', trafficUsedBytes: 100 });
  maintainNodes(february); const n = db.getNodeById('monthly');
  assert.equal(n.trafficUsedBytes, 0); assert.equal(n.trafficPeriodStart, new Date(2026, 1, 28).getTime()); assert.ok(n.configVersion > 1);
  maintainNodes(february); assert.equal(n.trafficUsedBytes, 0);
});
test('expired and over-quota subscriptions are refused', async () => {
  db.addSubscription({ id: 'expired', name: 'Expired', token: 'expired-token', nodeIds: [], trafficLimitBytes: 0, trafficUsedBytes: 0, expireAt: 1, createdAt: 1 });
  db.addSubscription({ id: 'quota', name: 'Quota', token: 'quota-token', nodeIds: [], trafficLimitBytes: 10, trafficUsedBytes: 10, expireAt: 0, createdAt: 1 });
  assert.equal((await request('/api/sub/expired-token', 'GET', undefined, null)).status, 403);
  assert.equal((await request('/api/sub/quota-token', 'GET', undefined, null)).status, 403);
});
test('relay mutations propagate and inactive relays are excluded', async () => {
  makeNode('main'); makeNode('unlock', { type: 'unlock', protocol: 'shadowsocks', reality: undefined, shadowsocks: { method: '2022-blake3-aes-128-gcm', password: 'AAAAAAAAAAAAAAAAAAAAAA==' } });
  const response = await request('/api/relays', 'POST', { mainNodeId: 'main', unlockNodeId: 'unlock', mode: 'all' });
  assert.equal(response.status, 200); assert.ok(db.getNodeById('main').configVersion > 1);
  assert.ok(getNodeXrayConfig(db.getNodeById('main')).outbounds.some(o => o.tag === 'UNLOCK_OUT'));
  await request(`/api/relays/${response.data.data.id}`, 'PUT', { status: 'inactive' });
  assert.ok(!getNodeXrayConfig(db.getNodeById('main')).outbounds.some(o => o.tag === 'UNLOCK_OUT'));
});
test('empty routing rules remain empty and changes invalidate configurations', () => {
  const previous = db.getNodeById('main').configVersion;
  for (const rule of db.getRoutingRules()) db.deleteRoutingRule(rule.id);
  assert.equal(db.getRoutingRules().length, 0); assert.ok(db.getNodeById('main').configVersion > previous);
});
test('upgrade remains pending until the actual installed version is reported', async () => {
  makeNode('upgrade', { xrayVersion: 'v1.0.0', status: 'offline' });
  await upgradeNodeXray('upgrade', 'v2.0.0');
  assert.equal(db.getNodeById('upgrade').xrayVersion, 'v1.0.0'); assert.equal(agentDirectives(db.getNodeById('upgrade')).upgrade.version, 'v2.0.0');
  ingestTelemetry('upgrade', { xrayVersion: 'v2.0.0' });
  assert.equal(db.getNodeById('upgrade').upgradeStatus, 'succeeded');
  assert.throws(() => generateUpgradeScript('', 'v1;echo bad'));
});
test('analytics aggregate only measured values and latency starts empty', () => {
  const rows = historyStore.samples('today'); const expected = rows.reduce((sum, p) => sum + p.tx + p.rx, 0);
  const analytics = trafficService.getTrafficAnalytics('today');
  assert.equal(analytics.totalRecordedBytes, expected); assert.equal(analytics.services.length, 0);
  assert.equal(analytics.timeSeries.reduce((sum, p) => sum + p.totalBytes, 0), expected);
  assert.deepEqual(db.getNodeLatencyHistory('main'), []);
});
test('corrupt database is not overwritten and empty rules survive restart', () => {
  db.flush(); const file = path.join(directory, 'nodemaster_db.json'); const valid = fs.readFileSync(file, 'utf8');
  assert.equal(new Database().getRoutingRules().length, 0);
  fs.writeFileSync(file, '{broken'); assert.throws(() => new Database(), /original retained/); assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
  fs.writeFileSync(file, valid);
});
test('legacy migration retains nodes and subscriptions while rotating compromised defaults', () => {
  db.flush(); const file = path.join(directory, 'nodemaster_db.json'); const original = fs.readFileSync(file, 'utf8');
  const legacy = JSON.parse(original);
  legacy.config.jwtSecret = 'nm_secret_key_8848_secure';
  delete legacy.admin.sessionVersion;
  legacy.admin.passwordHash = crypto.pbkdf2Sync('admin123456', legacy.admin.salt, 100000, 64, 'sha512').toString('hex');
  const keyed = legacy.nodes.find(n => n.reality);
  keyed.reality.publicKey = 'incorrect'; delete keyed.agentSchemaVersion;
  fs.writeFileSync(file, JSON.stringify(legacy));
  const migrated = new Database();
  assert.deepEqual(migrated.getNodes().map(n => n.id), legacy.nodes.map(n => n.id));
  assert.deepEqual(migrated.getSubscriptions(), legacy.subscriptions);
  assert.notEqual(migrated.getConfig().jwtSecret, legacy.config.jwtSecret);
  assert.notEqual(migrated.getAdmin().passwordHash, legacy.admin.passwordHash);
  assert.equal(migrated.getNodeById(keyed.id).reality.publicKey, deriveRealityPublicKey(keyed.reality.privateKey));
  assert.equal(migrated.getRoutingRules().length, 0);
  fs.writeFileSync(file, original);
});
test('failed atomic replacement leaves live file intact', () => {
  const file = path.join(directory, 'atomic-test.json'); fs.writeFileSync(file, '{"original":true}');
  const rename = fs.renameSync;
  fs.renameSync = () => { throw new Error('simulated rename failure'); };
  try { assert.throws(() => atomicWriteJson(file, { replacement: true }, true)); }
  finally { fs.renameSync = rename; }
  assert.equal(fs.readFileSync(file, 'utf8'), '{"original":true}');
});
test('websocket replacement preserves live agent and revoked admin is disconnected', async () => {
  makeNode('socket'); const hub = new WsHub(); const host = http.createServer(); hub.init(host);
  host.listen(0, '127.0.0.1'); await once(host, 'listening');
  const url = `ws://127.0.0.1:${host.address().port}/ws`;
  const first = new WebSocket(`${url}?type=agent&token=token-socket`); await once(first, 'open');
  const firstClosed = once(first, 'close');
  const second = new WebSocket(`${url}?type=agent&token=token-socket`); await once(second, 'open'); await firstClosed;
  assert.equal(db.getNodeById('socket').status, 'online');
  const instruction = once(second, 'message'); assert.equal(hub.pushUpgradeToAgent('socket', 'v1.2.3'), true); await instruction;
  const browser = new WebSocket(`${url}?type=web&token=${encodeURIComponent(token)}`); await once(browser, 'open');
  const closed = once(browser, 'close'); db.revokeSessions(); hub.closeRevokedClients();
  assert.equal((await closed)[0], 4001);
  const secondClosed = once(second, 'close'); second.close(); await secondClosed;
  hub.close(); await new Promise(r => host.close(r));
  token = signToken({ sub: 'admin', role: 'admin' });
});
after(async () => {
  db.flush(); server.closeAllConnections(); await new Promise(r => server.close(r)); fs.rmSync(directory, { recursive: true, force: true });
});
