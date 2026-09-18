import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { WORKER_CONFIG_DEFAULTS, withWorkerConfigDefaults } from '../src/workerConfig.js';
import { resolveScheduledModeFromEvent } from '../src/scheduleRouting.js';

test('fixed settings preserve legacy string values including disabled features', () => {
    assert.equal(Object.keys(WORKER_CONFIG_DEFAULTS).length, 32);
    assert.ok(Object.isFrozen(WORKER_CONFIG_DEFAULTS));
    assert.ok(Object.values(WORKER_CONFIG_DEFAULTS).every(value => typeof value === 'string'));
    assert.equal(WORKER_CONFIG_DEFAULTS.OPEN_TRANSLATE, 'true');
    assert.equal(WORKER_CONFIG_DEFAULTS.DAILY_ANTHROPIC_MAX_TOKENS, '4096');
    assert.equal(WORKER_CONFIG_DEFAULTS.GEMINI_RETRY_MAX, '3');
    assert.equal(WORKER_CONFIG_DEFAULTS.GEMINI_RETRY_BASE_MS, '2000');
    assert.equal(WORKER_CONFIG_DEFAULTS.GEMINI_FALLBACK_ENABLED, 'false');
    assert.equal(WORKER_CONFIG_DEFAULTS.TWITTER_FETCH_PAGES, '0');
    assert.equal(WORKER_CONFIG_DEFAULTS.IMG_PROXY, '');
    assert.deepEqual(withWorkerConfigDefaults(), WORKER_CONFIG_DEFAULTS);
});

test('every explicit value wins, including empty and false-like overrides', () => {
    for (const key of Object.keys(WORKER_CONFIG_DEFAULTS)) {
        for (const value of ['', '0', 'false', false, 0, null, undefined, 'custom']) {
            const env = Object.freeze({ [key]: value });
            assert.equal(withWorkerConfigDefaults(env)[key], value, key);
            assert.deepEqual(env, { [key]: value });
        }
    }
});

test('bindings and secrets keep identity and caller object is not mutated', () => {
    const kv = { get() {}, put() {} };
    const secret = 'test-only-secret';
    const env = Object.freeze({ DATA_KV: kv, ANTHROPIC_API_KEY: secret, FOLO_FILTER_DAYS: 2 });
    const resolved = withWorkerConfigDefaults(env);
    assert.notEqual(resolved, env);
    assert.equal(resolved.DATA_KV, kv);
    assert.equal(resolved.ANTHROPIC_API_KEY, secret);
    assert.equal(resolved.FOLO_FILTER_DAYS, 2);
    assert.equal(Object.hasOwn(env, 'OPEN_TRANSLATE'), false);
    assert.ok(!Object.keys(WORKER_CONFIG_DEFAULTS).some(key => /API_KEY|PASSWORD|SECRET|GITHUB_TOKEN|REPO_NAME|CRON_SCHEDULE/.test(key)));
});

// Run the actual exported entrypoint bodies with downstream handlers stubbed out.
// This exercises configuration timing without fetching sources or publishing.
const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
function entrypoints(stubs = {}) {
    assert.match(source, /import \{ withWorkerConfigDefaults \} from '\.\/workerConfig\.js'/);
    return vm.runInNewContext(`(${source.slice(source.indexOf('export default ') + 15).trim().replace(/;$/, '')})`, {
        withWorkerConfigDefaults, URL, Response,
        console: { error() {}, log() {} }, ...stubs,
    });
}

test('scheduled entry supplies original settings to all cron modes', async () => {
    const env = Object.freeze({ DATA_KV: {}, DAILY_CRON_SCHEDULE: '0 1 * * *' });
    let received;
    const worker = entrypoints({ runScheduledEventWithStatus: async (event, resolved, ctx) => { received = { event, resolved, ctx }; } });
    for (const minute of [0, 12, 20, 50]) {
        const event = { cron: '0,12,20,50 1 * * *', scheduledTime: Date.parse(`2026-09-11T01:${String(minute).padStart(2, '0')}:00Z`) };
        const ctx = {};
        await worker.scheduled(event, env, ctx);
        assert.equal(received.event, event);
        assert.equal(received.ctx, ctx);
        assert.equal(received.resolved.DATA_KV, env.DATA_KV);
        assert.deepEqual(received.resolved, withWorkerConfigDefaults(env));
        assert.equal(resolveScheduledModeFromEvent(event, received.resolved), resolveScheduledModeFromEvent(event, env));
    }
});

test('HTTP required config check sees migrated OPEN_TRANSLATE before validation', async () => {
    const worker = entrypoints();
    const response = await worker.fetch(new Request('https://worker.example/login'), {}, {});
    const body = await response.text();
    assert.equal(response.status, 503);
    assert.match(body, /DATA_KV/);
    assert.doesNotMatch(body, /OPEN_TRANSLATE/);
    const disabled = await worker.fetch(new Request('https://worker.example/login'), { OPEN_TRANSLATE: '' }, {});
    assert.match(await disabled.text(), /OPEN_TRANSLATE/);
});

test('HTTP handler receives defaults plus unchanged publishing targets and secrets', async () => {
    const env = Object.freeze({
        DATA_KV: {}, USE_MODEL_PLATFORM: 'ANTHROPIC', GITHUB_TOKEN: 'test',
        GITHUB_REPO_OWNER: 'owner', GITHUB_REPO_NAME: 'daily', GITHUB_BRANCH: 'main',
        ACCOUNT_OPPORTUNITY_GITHUB_REPO_NAME: 'merchant',
        LOGIN_USERNAME: 'test', LOGIN_PASSWORD: 'test', PODCAST_TITLE: 'test',
        PODCAST_BEGIN: 'test', PODCAST_END: 'test', FOLO_COOKIE_KV_KEY: 'test',
        FOLO_DATA_API: 'https://folo.example', FOLO_FILTER_DAYS: 2,
        DEFAULT_ANTHROPIC_MODEL: 'test-model', ANTHROPIC_API_KEY: 'test',
        ANTHROPIC_API_URL: 'https://api.example',
    });
    let received;
    const worker = entrypoints({ handleLogin: async (_request, resolved) => { received = resolved; return new Response('ok'); } });
    const response = await worker.fetch(new Request('https://worker.example/login'), env, {});
    assert.equal(response.status, 200);
    assert.deepEqual(received, withWorkerConfigDefaults(env));
    assert.equal(received.ACCOUNT_OPPORTUNITY_GITHUB_REPO_NAME, 'merchant');
    assert.equal(received.GITHUB_REPO_NAME, 'daily');
});
