import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('frontend interceptor sends credentials only to own API and clears on real 401', async () => {
  const calls = [], events = [], storage = new Map([['nodemaster_auth_token', 'test-session']]);
  let status = 200;
  const context = vm.createContext({
    exports: {}, Headers, Request, URL, console, CustomEvent: class { constructor(type) { this.type = type; } },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window: { location: { href: 'https://panel.example/', origin: 'https://panel.example' }, dispatchEvent: e => events.push(e.type), fetch: async (url, init) => { calls.push({ url, headers: init.headers }); return { status }; } },
  });
  const source = fs.readFileSync(new URL('../../web/src/services/api.ts', import.meta.url), 'utf8');
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  context.exports.initAuthInterceptor();
  await context.window.fetch('/api/nodes');
  await context.window.fetch('https://external.example/api/nodes');
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer test-session');
  assert.equal(calls[1].headers.has('Authorization'), false);
  status = 401;
  await context.window.fetch('https://external.example/api/nodes');
  assert.equal(storage.get('nodemaster_auth_token'), 'test-session');
  await context.window.fetch('/api/auth/login');
  assert.equal(storage.get('nodemaster_auth_token'), 'test-session');
  await context.window.fetch('/api/nodes');
  assert.equal(storage.has('nodemaster_auth_token'), false);
  assert.deepEqual(events, ['nodemaster:unauthorized']);
});
