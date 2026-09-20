import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { probeModelConnection, handleModelConnectionProbe } from '../src/modelConnectionProbe.js';
import { callChatAPI } from '../src/chatapi.js';

const env = {
    DEFAULT_ANTHROPIC_MODEL: 'claude-sonnet-5',
    DEFAULT_ANTHROPIC_BACKUP_MODEL: 'claude-opus-4-8',
    ACCOUNT_MERCHANT_EDITORIAL_MODEL: 'claude-sonnet-5',
    ANTHROPIC_API_URL: 'https://example.test',
    ANTHROPIC_API_KEY: 'test-key',
    TEST_TRIGGER_SECRET: 'test-only-trigger',
};

test('all probes use a fixed prompt, a small budget and no fallback providers', async () => {
    for (const route of ['primary', 'backup']) {
        const result = await probeModelConnection(env, route, async (scoped, prompt) => {
            assert.equal(prompt, 'Reply with exactly OK.');
            assert.equal(scoped.ANTHROPIC_MAX_TOKENS, '256');
            assert.equal(scoped.ANTHROPIC_RETRY_MAX, '0');
            assert.equal(scoped.DEFAULT_ANTHROPIC_MODEL, route === 'backup' ? 'claude-opus-4-8' : 'claude-sonnet-5');
            assert.equal(scoped.DEFAULT_ANTHROPIC_BACKUP_MODEL, scoped.DEFAULT_ANTHROPIC_MODEL);
            assert.equal(scoped.OPENAI_FALLBACK_ENABLED, 'false');
            assert.equal(scoped.GEMINI_FALLBACK_ENABLED, 'false');
            assert.equal(scoped.ANTHROPIC_BACKUP_API_KEY, '');
            assert.equal(scoped.OPENAI_API_KEY, '');
            assert.equal(scoped.GEMINI_API_KEY, '');
            return 'OK.';
        });
        assert.equal(result.ok, true);
        assert.equal(JSON.stringify(result).includes(env.ANTHROPIC_API_KEY), false);
    }
});

test('stream probes collect the actual client stream without switching models', async () => {
    for (const route of ['primary-stream', 'backup-stream']) {
        const result = await probeModelConnection(env, route, () => assert.fail('not a non-stream probe'), async function* (scoped, prompt) {
            assert.equal(prompt, 'Reply with exactly OK.');
            assert.equal(scoped.DEFAULT_ANTHROPIC_MODEL, route === 'backup-stream' ? 'claude-opus-4-8' : 'claude-sonnet-5');
            assert.equal(scoped.ANTHROPIC_MAX_TOKENS, '256');
            yield 'O';
            yield 'K';
        });
        assert.equal(result.ok, true);
    }
});

test('invalid route never calls a model; failures and unexpected content are not exposed', async () => {
    assert.equal((await probeModelConnection(env, 'arbitrary', () => assert.fail('not allowed'))).error, 'invalid_route');
    const result = await probeModelConnection(env, 'primary', () => { throw new Error(env.ANTHROPIC_API_KEY); });
    assert.equal(result.error, 'model_call_failed');
    assert.equal(JSON.stringify(result).includes(env.ANTHROPIC_API_KEY), false);
    const unexpected = await probeModelConnection(env, 'primary', async () => {
        return env.ANTHROPIC_API_KEY;
    });
    assert.equal(unexpected.ok, false);
    assert.equal(JSON.stringify(unexpected).includes(env.ANTHROPIC_API_KEY), false);
});

test('probe requires POST and the existing secret, and disables response caching', async () => {
    const url = 'https://worker.test/testModelConnection?route=unknown';
    assert.equal((await handleModelConnectionProbe(new Request(url), env)).status, 405);
    for (const secret of ['', 'wrong']) {
        assert.equal((await handleModelConnectionProbe(new Request(url, { method: 'POST', headers: { 'x-test-trigger-secret': secret } }), env)).status, 401);
    }
    const request = new Request(url, { method: 'POST', headers: { 'x-test-trigger-secret': env.TEST_TRIGGER_SECRET } });
    assert.equal((await handleModelConnectionProbe(request, { ...env, TEST_TRIGGER_SECRET: '' })).status, 401);
    const result = await handleModelConnectionProbe(request, env);
    assert.equal(result.status, 400);
    assert.equal(result.headers.get('Cache-Control'), 'no-store');
});

test('explicitly disabled OpenAI fallback skips a stored legacy key and uses the requested backup', async t => {
    const originalFetch = globalThis.fetch;
    t.after(() => { globalThis.fetch = originalFetch; });
    const models = [];
    globalThis.fetch = async (url, options) => {
        assert.equal(String(url), 'https://example.test/v1/messages');
        const { model } = JSON.parse(options.body);
        models.push(model);
        return new Response(JSON.stringify(model === 'claude-sonnet-5'
            ? { error: { message: 'unavailable' } }
            : { content: [{ type: 'text', text: 'OK' }] }), { status: model === 'claude-sonnet-5' ? 429 : 200 });
    };
    assert.equal(await callChatAPI({ ...env, USE_MODEL_PLATFORM: 'ANTHROPIC', ANTHROPIC_RETRY_MAX: '0', OPENAI_API_KEY: 'legacy-key', OPENAI_BASE_URL: 'https://legacy.test', OPENAI_FALLBACK_ENABLED: 'false' }, 'Reply only OK'), 'OK');
    assert.deepEqual(models, ['claude-sonnet-5', 'claude-opus-4-8']);
});

test('deployment config uses the enterprise endpoint for both Claude routes and merchant editorial', () => {
    const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
    for (const setting of ['ANTHROPIC_API_URL', 'ANTHROPIC_BASE_URL']) assert.match(config, new RegExp(`^${setting} = "https://www\\.runtoken\\.ai"$`, 'm'));
    assert.match(config, /^DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5"$/m);
    assert.match(config, /^DEFAULT_ANTHROPIC_BACKUP_MODEL = "claude-opus-4-8"$/m);
    assert.match(config, /^ACCOUNT_MERCHANT_EDITORIAL_MODEL = "claude-sonnet-5"$/m);
    assert.match(config, /^OPENAI_FALLBACK_ENABLED = "false"$/m);
    assert.doesNotMatch(config, /^ANTHROPIC_(?:API_URL|BASE_URL) = ".*newcli\.com"$/m);
});
