import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../scripts/preview-daily-grounding.mjs', import.meta.url), 'utf8');
const start = script.indexOf('const sourceCacheAccess =');
const end = script.indexOf('const vars =', start);
assert.ok(start >= 0 && end > start);
const env = { SOURCE_CACHE_ACCESS: 'cloudflare-kv', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
  SOURCE_CACHE_NAMESPACE: 'b'.repeat(32), CLOUDFLARE_API_TOKEN: 'test-token' };
async function readCache(environment, fetchImpl) {
  const result = await vm.runInNewContext(`(async () => { ${script.slice(start, end)} return data; })()`, {
    process: { env: environment }, date: '2026-10-23', originalFetch: fetchImpl, AbortSignal,
  });
  return JSON.parse(JSON.stringify(result));
}

test('default preview still reads the existing Worker endpoint', async () => {
  let requested;
  const result = await readCache({}, async url => {
    requested = url;
    return Response.json({ date: '2026-10-23', news: [] });
  });
  assert.match(requested, /workers\.dev\/getContent\?date=2026-10-23$/);
  assert.deepEqual(result.news, []);
});

test('authenticated preview reads only the four current-date KV values with redirects refused', async () => {
  const requests = [];
  const result = await readCache(env, async (url, options) => {
    requests.push({ url, options });
    return Response.json([{ title: 'cached public source' }]);
  });
  assert.equal(requests.length, 4);
  for (const { url, options } of requests) {
    assert.equal(new URL(url).origin, 'https://api.cloudflare.com');
    assert.match(url, /\/values\/2026-10-23-(news|project|paper|socialMedia)$/);
    assert.equal(options.method, undefined);
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
  }
  assert.equal(result.news.length, 1);
  assert.ok(!JSON.stringify(result).includes('test-token'));
});

test('absent category is empty, but API access failures do not silently switch routes', async () => {
  const result = await readCache(env, async () => new Response('', { status: 404 }));
  assert.deepEqual(result.project, []);
  let requests = 0;
  await assert.rejects(readCache(env, async () => {
    requests++;
    return new Response('', { status: 403 });
  }), /HTTP 403/);
  assert.equal(requests, 1);
});

test('wrong KV shape and missing or invalid credentials stop before model generation', async () => {
  await assert.rejects(readCache(env, async () => Response.json({ success: true })), /Invalid cached array/);
  for (const overrides of [{ CLOUDFLARE_API_TOKEN: '' }, { SOURCE_CACHE_NAMESPACE: '../other' }, { SOURCE_CACHE_ACCESS: 'unknown' }]) {
    await assert.rejects(readCache({ ...env, ...overrides }, async () => assert.fail('Unexpected network call')),
      /configuration is missing or invalid|Unknown source cache/);
  }
});
