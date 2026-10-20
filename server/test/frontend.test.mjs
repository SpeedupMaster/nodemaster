import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadApiModule() {
  const calls = [], events = [], storage = new Map([['nodemaster_auth_token', 'test-session']]);
  const state = { status: 200, body: { success: true, data: { ok: 1 } } };
  const context = vm.createContext({
    exports: {}, Headers, console, CustomEvent: class { constructor(type) { this.type = type; } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window: { dispatchEvent: e => events.push(e.type) },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return { status: state.status, ok: state.status < 400, json: async () => state.body };
    },
  });
  const source = fs.readFileSync(new URL('../../web/src/services/api.ts', import.meta.url), 'utf8');
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { api: context.exports, calls, events, storage, state };
}

test('apiFetch sends the session token only to the panel API', async () => {
  const { api, calls } = loadApiModule();
  await api.apiFetch('/api/nodes');
  assert.equal(calls[0].init.headers.get('Authorization'), 'Bearer test-session');
  await assert.rejects(api.apiFetch('https://external.example/api/nodes'), /only accepts \/api\//);
  await assert.rejects(api.apiFetch('//external.example/api/nodes'), /only accepts \/api\//);
  assert.equal(calls.length, 1);
});

test('a 401 ends the session, but a failed login without a session does not', async () => {
  const { api, events, storage, state } = loadApiModule();
  state.status = 401; state.body = { success: false, message: '账号或密码错误' };
  storage.delete('nodemaster_auth_token');
  await assert.rejects(api.api('POST', '/api/auth/login', {}), /账号或密码错误/);
  assert.deepEqual(events, []);

  storage.set('nodemaster_auth_token', 'test-session');
  await assert.rejects(api.api('GET', '/api/nodes'), err => err.status === 401);
  assert.equal(storage.has('nodemaster_auth_token'), false);
  assert.deepEqual(events, ['nodemaster:unauthorized']);
});

test('api() unwraps data and reports failures with the server message or HTTP status', async () => {
  const { api, calls, state } = loadApiModule();
  assert.deepEqual({ ...(await api.api('PUT', '/api/nodes/1', { name: 'x' })) }, { ok: 1 });
  assert.equal(calls[0].init.method, 'PUT');
  assert.equal(calls[0].init.body, '{"name":"x"}');
  assert.equal(calls[0].init.headers.get('Content-Type'), 'application/json');

  state.status = 400; state.body = { success: false, message: '参数无效' };
  await assert.rejects(api.api('GET', '/api/nodes'), /参数无效/);
  state.status = 502; state.body = null;
  await assert.rejects(api.api('GET', '/api/nodes'), /HTTP 502/);
});
