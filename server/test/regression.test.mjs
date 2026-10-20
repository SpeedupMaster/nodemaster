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
const { generateRealityCredentials, getNodeXrayConfig, UNLOCK_SERVICES } = await import('../dist/services/xrayConfig.js');
const { deriveRealityPublicKey, billingPeriod, atomicWriteJson, verifyPassword } = await import('../dist/services/security.js');
const { WsHub } = await import('../dist/services/wsHub.js');
const { ingestTelemetry, maintainNodes, agentDirectives } = await import('../dist/services/telemetryService.js');
const { apiRouter } = await import('../dist/routes/index.js');
const { getTrafficAnalytics } = await import('../dist/services/trafficService.js');
const historyModule = await import('../dist/services/historyStore.js');
const { historyStore } = historyModule;
const { upgradeNodeXray, generateUpgradeScript } = await import('../dist/services/xrayVersionService.js');
const { assembleProxies, renderClashYaml, renderSingboxJson } = await import('../dist/services/subscription.js');
const YAML = (await import('yaml')).default;
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

test('fresh deployment contains no sample nodes or fixed administrator secrets, and one usable subscription', () => {
  assert.equal(db.getNodes().length, 0);
  assert.equal(db.getSubscriptions().length, 1);
  assert.match(db.getSubscriptions()[0].token, /^sub_[0-9a-f]{24}$/);
  assert.ok(db.getConfig().jwtSecret.length >= 48);
  assert.ok(db.getAdmin().sessionVersion);
  assert.equal(getTrafficAnalytics('today').totalRecordedBytes, 0);
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
test('expired subscriptions are refused and subscriptions can be created and deleted', async () => {
  db.addSubscription({ id: 'expired', name: 'Expired', token: 'expired-token', nodeIds: [], expireAt: 1, createdAt: 1 });
  assert.equal((await request('/api/sub/expired-token', 'GET', undefined, null)).status, 403);
  const created = await request('/api/subscriptions', 'POST', { name: 'Family', nodeIds: ['install'] });
  assert.equal(created.status, 200); assert.deepEqual(created.data.data.nodeIds, ['install']);
  const served = await fetch(`${base}/api/sub/${created.data.data.token}`);
  assert.equal(served.status, 200); assert.match(served.headers.get('subscription-userinfo'), /total=10000;/);
  assert.equal((await request('/api/subscriptions', 'POST', { nodeIds: ['missing'] })).status, 400);
  assert.equal((await request(`/api/subscriptions/${created.data.data.id}`, 'DELETE')).status, 200);
  assert.equal((await request(`/api/subscriptions/${created.data.data.id}`, 'DELETE')).status, 404);
});
test('relay mutations propagate and inactive relays are excluded', async () => {
  makeNode('main'); makeNode('unlock', { type: 'unlock', protocol: 'shadowsocks', reality: undefined, shadowsocks: { method: '2022-blake3-aes-128-gcm', password: 'AAAAAAAAAAAAAAAAAAAAAA==' } });
  const response = await request('/api/relays', 'POST', { mainNodeId: 'main', unlockNodeId: 'unlock', mode: 'all' });
  assert.equal(response.status, 200); assert.ok(db.getNodeById('main').configVersion > 1);
  assert.ok(getNodeXrayConfig(db.getNodeById('main')).outbounds.some(o => o.tag === 'UNLOCK_OUT'));
  await request(`/api/relays/${response.data.data.id}`, 'PUT', { status: 'inactive' });
  assert.ok(!getNodeXrayConfig(db.getNodeById('main')).outbounds.some(o => o.tag === 'UNLOCK_OUT'));
});
test('node configs are never generated with invented credentials', () => {
  const node = makeNode('no-keys', { reality: undefined });
  assert.throws(() => getNodeXrayConfig(node));
});
test('upgrade remains pending until the actual installed version is reported', async () => {
  makeNode('upgrade', { xrayVersion: 'v1.0.0', status: 'offline' });
  await upgradeNodeXray('upgrade', 'v2.0.0');
  assert.equal(db.getNodeById('upgrade').xrayVersion, 'v1.0.0'); assert.equal(agentDirectives(db.getNodeById('upgrade')).upgrade.version, 'v2.0.0');
  ingestTelemetry('upgrade', { xrayVersion: 'v2.0.0' });
  assert.equal(db.getNodeById('upgrade').upgradeStatus, 'succeeded');
  assert.throws(() => generateUpgradeScript('v1;echo bad'));
});
test('analytics aggregate only measured values and latency starts empty', () => {
  const rows = historyStore.samples('today'); const expected = rows.reduce((sum, p) => sum + p.tx + p.rx, 0);
  const analytics = getTrafficAnalytics('today');
  assert.equal(analytics.totalRecordedBytes, expected);
  assert.equal(analytics.timeSeries.reduce((sum, p) => sum + p.totalBytes, 0), expected);
  for (const p of analytics.timeSeries) assert.equal(new Date(p.timestamp).getMinutes(), 0);
  assert.deepEqual(historyStore.latencyHistory('main', '1h', db.getLatencyTasksFor('main')), []);
});
test('corrupt database is not overwritten', () => {
  db.flush(); const file = path.join(directory, 'nodemaster_db.json'); const valid = fs.readFileSync(file, 'utf8');
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
  // Shapes from schema v2: legacy relay ids, subscription quota, editable routing rules
  legacy.configSchemaVersion = 2;
  legacy.relays.push({ id: 'legacy-relay', name: 'Legacy', transitNodeId: 'main', exitNodeId: 'unlock', status: 'inactive', createdAt: 1 });
  legacy.subscriptions[0].trafficLimitBytes = 10; legacy.subscriptions[0].trafficUsedBytes = 10;
  legacy.routingRules = [{ id: 'r', name: 'r' }];
  fs.writeFileSync(file, JSON.stringify(legacy));
  const migrated = new Database();
  assert.deepEqual(migrated.getNodes().map(n => n.id), legacy.nodes.map(n => n.id));
  assert.deepEqual(migrated.getSubscriptions().map(s => s.id), legacy.subscriptions.map(s => s.id));
  assert.equal(migrated.getSubscriptions()[0].trafficLimitBytes, undefined);
  const relay = migrated.getRelays().find(r => r.id === 'legacy-relay');
  assert.equal(relay.mainNodeId, 'main'); assert.equal(relay.unlockNodeId, 'unlock'); assert.equal(relay.transitNodeId, undefined); assert.ok(relay.chainUuid);
  assert.notEqual(migrated.getConfig().jwtSecret, legacy.config.jwtSecret);
  assert.notEqual(migrated.getAdmin().passwordHash, legacy.admin.passwordHash);
  assert.equal(migrated.getNodeById(keyed.id).reality.publicKey, deriveRealityPublicKey(keyed.reality.privateKey));
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
test('websocket accepts only admin sessions and disconnects revoked ones', async () => {
  makeNode('socket'); const hub = new WsHub(); const host = http.createServer(); hub.init(host);
  host.listen(0, '127.0.0.1'); await once(host, 'listening');
  const url = `ws://127.0.0.1:${host.address().port}/ws`;
  const agent = new WebSocket(`${url}?type=agent&token=token-socket`);
  assert.equal((await once(agent, 'close'))[0], 4001);
  const browser = new WebSocket(`${url}?token=${encodeURIComponent(token)}`); await once(browser, 'open');
  const closed = once(browser, 'close'); db.revokeSessions(); hub.closeRevokedClients();
  assert.equal((await closed)[0], 4001);
  hub.close(); await new Promise(r => host.close(r));
  token = signToken({ sub: 'admin', role: 'admin' });
});
test('history downsamples old data, keeps traffic totals and survives reload', () => {
  const { HistoryStore } = historyModule;
  const file = path.join(directory, 'history-compact.json');
  const store = new HistoryStore(file); const node = { id: 'h', cpuUsage: 10, memUsage: 20, diskUsage: 30, uplinkSpeedBytes: 1, downlinkSpeedBytes: 2 };
  const old = Math.floor((Date.now() - 10 * 86400000) / 3600000) * 3600000;
  for (let i = 0; i < 120; i++) { store.record(node, 5, 7, old + i * 60000); store.recordLatency('h', [{ taskId: 't', latencyMs: i % 2 ? 10 : 20, lossRate: 0, jitter: 1 }], old + i * 60000); }
  store.record(node, 1, 1);
  store.flush();
  const rows = store.samples('all', 'h');
  assert.equal(rows.length, 3);
  assert.equal(rows.reduce((s, p) => s + p.tx + p.rx, 0), 120 * 12 + 2);
  const reloaded = new HistoryStore(file);
  assert.deepEqual(reloaded.samples('all', 'h'), rows);
  const latency = reloaded.latencyHistory('h', 'all', [{ id: 't', name: 't', enabled: true, nodeIds: [] }]);
  assert.equal(latency[0].history.length, 2); assert.equal(latency[0].history[0].latencyMs, 15);
});
test('resetting latency presets restores original order after reorder', () => {
  db.resetLatencyTasks();
  const ids = db.getLatencyTasks().map(t => t.id);
  db.reorderLatencyTasks([...ids].reverse());
  assert.deepEqual(db.resetLatencyTasks().map(t => t.id), ids);
});
test('telegram alerts skip restart baseline, escape HTML and debounce flapping', async () => {
  const { telegramService } = await import('../dist/services/telegramService.js');
  const sent = []; const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { sent.push(JSON.parse(init.body).text); return new Response('{"ok":true}'); };
  try {
    db.updateTelegramConfig({ enabled: true, botToken: 'x', chatId: '1', trafficAlert: false, renewalAlert: false, cpuAlert: false, memAlert: false });
    const node = { id: 'tg', name: 'A<B>&C', ip: '1.1.1.1', port: 1, country: 'US', status: 'offline' };
    const check = (status) => telegramService.checkNodeAlerts([{ ...node, status }]);
    await check('offline'); await check('online');
    assert.equal(sent.length, 0, 'baseline and recovery without a preceding alert are silent');
    await check('offline');
    assert.equal(sent.length, 1); assert.ok(sent[0].includes('A&lt;B&gt;&amp;C'));
    await check('online'); assert.equal(sent.length, 2);
    await check('offline'); await check('online'); assert.equal(sent.length, 2, 'offline alerts are rate limited');
  } finally { globalThis.fetch = realFetch; db.updateTelegramConfig({ enabled: false }); }
});
test('telegram settings accept only known fields and the test endpoint does not save', async () => {
  const before = db.getTelegramConfig().botToken;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => String(url).includes('/botunsaved/') ? new Response('{"ok":true}') : realFetch(url, init);
  try {
    assert.equal((await request('/api/telegram/test', 'POST', { botToken: 'unsaved', chatId: '1' })).status, 200);
  } finally { globalThis.fetch = realFetch; }
  assert.equal(db.getTelegramConfig().botToken, before);
  const updated = await request('/api/telegram/config', 'PUT', { chatId: '42', injected: 'x' });
  assert.equal(updated.status, 200); assert.equal(db.getTelegramConfig().chatId, '42');
  assert.equal(db.getTelegramConfig().injected, undefined);
  assert.equal((await request('/api/telegram/config', 'PUT', { cpuThresholdPercent: 500 })).status, 400);
});
test('browsers receive only nodes that changed since the last push', async () => {
  const hub = new WsHub(); const host = http.createServer(); hub.init(host);
  host.listen(0, '127.0.0.1'); await once(host, 'listening');
  const browser = new WebSocket(`ws://127.0.0.1:${host.address().port}/ws?type=web&token=${encodeURIComponent(token)}`);
  const messages = []; browser.on('message', raw => messages.push(JSON.parse(raw.toString())));
  await once(browser, 'open'); await new Promise(r => setTimeout(r, 50));
  hub.broadcastChangedNodes(); await new Promise(r => setTimeout(r, 50));
  const first = messages.filter(m => m.type === 'NODES_PATCH');
  assert.equal(first.length, 1); assert.equal(first[0].nodes.length, db.getNodes().length);
  hub.broadcastChangedNodes();
  db.updateNode('main', { cpuUsage: 42 }, true); hub.broadcastChangedNodes(); await new Promise(r => setTimeout(r, 50));
  const patches = messages.filter(m => m.type === 'NODES_PATCH');
  assert.equal(patches.length, 2); assert.deepEqual(patches[1].nodes.map(n => n.id), ['main']);
  browser.close(); hub.close(); await new Promise(r => host.close(r));
});
test('custom subscription tokens must be long enough to be unguessable', async () => {
  db.addSubscription({ id: 'custom', name: 'Custom', token: 'sub_custom_token_0001', nodeIds: [], expireAt: 0, createdAt: 1 });
  assert.equal((await request('/api/subscriptions/custom', 'PUT', { token: 'abc' })).status, 400);
  assert.equal((await request('/api/subscriptions/custom', 'PUT', { token: 'my_long_custom_token_42' })).status, 200);
});
test('explicit reset variable recovers the admin password once and revokes sessions', async () => {
  db.flush();
  process.env.NODEMASTER_RESET_ADMIN_PASSWORD = 'recovered-password-789';
  try {
    const first = new Database(); const admin = first.getAdmin();
    assert.ok(verifyPassword('recovered-password-789', admin.passwordHash, admin.salt));
    assert.notEqual(admin.sessionVersion, db.getAdmin().sessionVersion);
    assert.equal(new Database().getAdmin().sessionVersion, admin.sessionVersion);
  } finally { delete process.env.NODEMASTER_RESET_ADMIN_PASSWORD; }
});
test('chained entry uses its own client and only that client is routed to the unlock node', async () => {
  makeNode('c-main', { name: 'Edge One' });
  makeNode('c-twin', { name: 'Edge One' });
  makeNode('c-unlock', { type: 'unlock', protocol: 'shadowsocks', reality: undefined, shadowsocks: { method: 'aes-256-gcm', password: 'legacy-password' } });
  const created = await request('/api/relays', 'POST', { mainNodeId: 'c-main', unlockNodeId: 'c-unlock', mode: 'ai_media' });
  assert.equal(created.status, 200);
  const relay = created.data.data;
  assert.match(relay.chainUuid, /^[0-9a-f-]{36}$/);

  const config = getNodeXrayConfig(db.getNodeById('c-main'));
  const clients = config.inbounds[0].settings.clients;
  assert.deepEqual(clients.map(c => c.id), [db.getNodeById('c-main').reality.uuid, relay.chainUuid]);
  assert.equal(config.inbounds[0].settings.flow, undefined);
  assert.equal(config.routing.domainStrategy, 'IPIfNonMatch');
  // Server-side private ranges are always blocked first, regardless of the "LAN direct" preset
  assert.deepEqual(config.routing.rules.slice(0, 2).map(r => r.outboundTag), ['BLOCK', 'BLOCK']);
  const unlockRules = config.routing.rules.filter(r => r.outboundTag === 'UNLOCK_OUT');
  assert.ok(unlockRules.length > 0);
  for (const r of unlockRules) {
    assert.deepEqual(r.user, ['nodemaster_chain@local']);
    assert.ok(r.domain || r.ip || r.protocol || r.port, 'the fallback preset must not become a catch-all to the unlock node');
  }
  // Non-2022 ciphers get no UDP-over-TCP
  assert.equal(config.outbounds.find(o => o.tag === 'UNLOCK_OUT').settings.servers[0].uot, undefined);

  const proxies = assembleProxies(db.getNodes().filter(n => n.id.startsWith('c-')), db.getRelays());
  const chain = proxies.find(p => p.chain);
  assert.equal(chain.node.reality.uuid, relay.chainUuid);
  assert.equal(db.getNodeById('c-main').reality.uuid !== relay.chainUuid, true);
  assert.equal(new Set(proxies.map(p => p.name)).size, proxies.length);
});
test('clash region groups match by country and never fall back to DIRECT', () => {
  const proxies = assembleProxies(db.getNodes().filter(n => n.id.startsWith('c-')), db.getRelays());
  const doc = YAML.parse(renderClashYaml(proxies));
  const groups = Object.fromEntries(doc['proxy-groups'].map(g => [g.name, g]));
  // "Edge One" has no region tag in its name, but its country is US
  assert.ok(groups['美国节点'].proxies.includes('Edge One'));
  assert.equal(groups['美国节点'].filter, undefined);
  for (const name of ['美国节点', '亚太节点', '欧洲节点']) assert.notDeepEqual(groups[name].proxies, ['DIRECT']);
  assert.ok(groups['解锁链路'].proxies.includes(proxies.find(p => p.chain).name));
  assert.equal(groups['GPT'].proxies[0], '解锁链路');
  assert.ok(doc.dns['respect-rules']);
});
test('sing-box output uses the 1.12 schema with DNS hijacking and no legacy geo fields', () => {
  const proxies = assembleProxies(db.getNodes().filter(n => n.id.startsWith('c-')), db.getRelays());
  const config = JSON.parse(renderSingboxJson(proxies));
  assert.ok(config.inbounds.some(i => i.type === 'tun' && i.auto_route));
  assert.ok(config.route.rules.some(r => r.protocol === 'dns' && r.action === 'hijack-dns'));
  assert.ok(!config.outbounds.some(o => o.type === 'block'));
  assert.ok(config.dns.servers.every(s => s.type && !s.address));
  for (const r of config.route.rules) { assert.equal(r.geosite, undefined); assert.equal(r.geoip, undefined); assert.notEqual(typeof r.port, 'string'); }
  const sets = new Set(config.route.rule_set.map(s => s.tag));
  for (const r of [...config.route.rules, ...config.dns.rules]) for (const tag of r.rule_set || []) assert.ok(sets.has(tag), tag);
  assert.ok(config.outbounds.find(o => o.tag === 'unlock').outbounds.includes(proxies.find(p => p.chain).name));
});
test('frontend service catalog matches the server unlock services', () => {
  const source = fs.readFileSync(new URL('../../web/src/components/topology/serviceCatalog.ts', import.meta.url), 'utf8');
  const ids = [...source.matchAll(/^\s*id:\s*["']([^"']+)["']/gm)].map(m => m[1]);
  assert.deepEqual([...ids].sort(), UNLOCK_SERVICES.map(s => s.id).sort());
});
after(async () => {
  db.flush(); server.closeAllConnections(); await new Promise(r => server.close(r)); fs.rmSync(directory, { recursive: true, force: true });
});
