import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/handlers/scheduled.js', import.meta.url), 'utf8');
const start = source.indexOf('async function generateContentWithTransportFallback(');
const end = source.indexOf('\nfunction getStandaloneDailyFunSystemPrompt', start);
assert.ok(start >= 0 && end > start);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const run = new AsyncFunction('callChatAPIStream', 'callChatAPI',
  `${source.slice(start, end)}; return await generateContentWithTransportFallback({}, 'source', 'rules');`);

for (const code of ['ECONNRESET', 'UND_ERR_SOCKET']) {
  test(`a closed stream (${code}) restarts once without concatenating a partial draft`, async () => {
    let calls = 0;
    const stream = async function* () {
      yield 'partial output must be discarded';
      throw Object.assign(new TypeError('terminated'), { cause: { code } });
    };
    const result = await run(stream, async () => { calls++; return 'complete generated result'; });
    assert.equal(result, 'complete generated result');
    assert.equal(calls, 1);
  });
}

test('successful streaming does not add a model request', async () => {
  let calls = 0;
  const result = await run(async function* () { yield 'complete '; yield 'draft'; }, async () => { calls++; });
  assert.equal(result, 'complete draft');
  assert.equal(calls, 0);
});

test('authentication and ordinary generation errors do not trigger transport recovery', async () => {
  for (const message of ['API key is disabled', 'invalid source content']) {
    let calls = 0;
    await assert.rejects(() => run(async function* () { throw new Error(message); }, async () => { calls++; }), new RegExp(message));
    assert.equal(calls, 0);
  }
});
