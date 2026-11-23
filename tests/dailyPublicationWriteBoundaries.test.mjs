import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { getISODate, parseReportDate } from '../src/helpers.js';
import { SESSION_COOKIE_NAME } from '../src/auth.js';
import { createOrUpdateGitHubFile } from '../src/github.js';

// Match Wrangler's resolution of the existing extensionless local imports.
const sourceRoot = new URL('../src/', import.meta.url).href;
const hooks = registerHooks({
    resolve(specifier, context, next) {
        try {
            return next(specifier, context);
        } catch (error) {
            if (error.code !== 'ERR_MODULE_NOT_FOUND' || !context.parentURL?.startsWith(sourceRoot) ||
                !specifier.startsWith('.') || /\.[a-z]+$/i.test(specifier)) throw error;
            return next(specifier + '.js', context);
        }
    },
});
const { default: worker } = await import('../src/index.js');
hooks.deregister();

function fixtureEnv() {
    const data = new Map([['session:fixture-session', JSON.stringify('valid')]]);
    return {
        DATA_KV: {
            get: async key => data.get(key),
            put: async (key, value) => data.set(key, value),
        },
        GITHUB_TOKEN: 'fixture-token',
        GITHUB_REPO_OWNER: 'fixture-owner',
        GITHUB_REPO_NAME: 'fixture-publication',
        GITHUB_BRANCH: 'main',
        GITHUB_API_RETRY_MAX: '0',
        OPEN_TRANSLATE: 'false',
        USE_MODEL_PLATFORM: 'ANTHROPIC',
        ANTHROPIC_API_KEY: 'fixture-model-key',
        ANTHROPIC_API_URL: 'https://model.example.test',
        DEFAULT_ANTHROPIC_MODEL: 'fixture-model',
        LOGIN_USERNAME: 'fixture-account',
        LOGIN_PASSWORD: 'fixture-password',
        PODCAST_TITLE: 'Fixture',
        PODCAST_BEGIN: 'Fixture',
        PODCAST_END: 'Fixture',
        FOLO_COOKIE_KV_KEY: 'fixture-folo',
        FOLO_DATA_API: 'https://feeds.example.test',
        FOLO_FILTER_DAYS: '1',
    };
}

function request(path, method = 'GET', { session = false, body, origin = 'https://daily.example.test' } = {}) {
    const headers = {};
    if (session) headers.Cookie = SESSION_COOKIE_NAME + '=fixture-session';
    if (method === 'POST' && origin !== null) headers.Origin = origin;
    return new Request('https://daily.example.test' + path, {
        method, headers, body,
    });
}

test('document dates accept only one real calendar day', () => {
    assert.equal(parseReportDate(['2026-11-23']), '2026-11-23');
    assert.equal(parseReportDate(['2028-02-29']), '2028-02-29');
    for (const dates of [[], ['2026-01-01', '2026-11-23'], ['2026-02-29'], ['2026-11-31'],
        ['2026-1-23'], ['announcement'], [' 2026-11-23'], ['2026-11-23\n']]) {
        assert.equal(parseReportDate(dates), null);
    }
});

test('RSS writes require login and POST without affecting the public feed', async t => {
    const env = fixtureEnv();
    const network = t.mock.method(globalThis, 'fetch', async () => { throw Error('No requests expected'); });
    for (const path of ['/generateRssContent', '/writeRssData']) {
        const legacyGet = await worker.fetch(request(path + '?date=2026-11-23'), env, {});
        assert.equal(legacyGet.status, 405);
        assert.equal(legacyGet.headers.get('Allow'), 'POST');
        const anonymous = await worker.fetch(request(path + '?date=2026-11-23', 'POST'), env, {});
        assert.equal(anonymous.status, 302);
        assert.equal(new URL(anonymous.headers.get('Location')).pathname, '/login');
        const invalidDate = await worker.fetch(request(path + '?date=announcement', 'POST', { session: true }), env, {});
        assert.equal(invalidDate.status, 400);
        for (const origin of ['https://other.example.test', 'null', null]) {
            const wrongOrigin = request(path + '?date=2026-11-23', 'POST', { session: true, origin });
            assert.equal((await worker.fetch(wrongOrigin, env, {})).status, 403);
        }
    }
    await env.DATA_KV.put(getISODate() + '-report', JSON.stringify({
        report_date: getISODate(), published_date: '2026-11-23T01:00:00Z',
        title: 'Existing public article', link: '/release-notes/', content_html: '<p>Release notes.</p>',
    }));
    const feed = await worker.fetch(request('/rss?days=1'), env, {});
    assert.equal(feed.status, 200);
    assert.match(await feed.text(), /<rss version="2\.0"[\s\S]*Existing public article/);
    assert.equal(network.mock.callCount(), 0);
});

test('same-origin authorized RSS generation writes the date file using mocked upstreams', async t => {
    const env = fixtureEnv();
    const raw = 'https://api.github.com/repos/fixture-owner/fixture-publication/contents/daily/2026-11-23.md?ref=main';
    const rss = 'https://api.github.com/repos/fixture-owner/fixture-publication/contents/rss/2026-11-23.md';
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push([options.method, url]);
        if (url === raw) return Response.json({ content: btoa('### A daily item\nFixture article.') });
        if (url === 'https://model.example.test/v1/messages') {
            return Response.json({ content: [{ type: 'text', text: 'Fixture RSS text.' }] });
        }
        if (url === rss + '?ref=main') return Response.json({ sha: 'existing-sha' });
        assert.equal(url, rss);
        assert.equal(options.method, 'PUT');
        assert.equal(JSON.parse(options.body).sha, 'existing-sha');
        return Response.json({ content: { sha: 'updated-sha' } });
    });
    const result = await worker.fetch(request('/generateRssContent?date=2026-11-23', 'POST', { session: true }), env, {});
    assert.equal(result.status, 200, await result.clone().text());
    assert.equal((await result.json()).github_path, 'rss/2026-11-23.md');
    assert.equal(calls.length, 4);
});

test('authenticated RSS write reads one date file and saves report data', async t => {
    const env = fixtureEnv();
    const network = t.mock.method(globalThis, 'fetch', (url, options) => {
        assert.equal(url, 'https://api.github.com/repos/fixture-owner/fixture-publication/contents/rss/2026-11-23.md?ref=main');
        assert.equal(options.method, 'GET');
        return Promise.resolve(Response.json({ content: btoa('### Release notes\nAn RSS item.') }));
    });
    const response = await worker.fetch(request('/writeRssData?date=2026-11-23', 'POST', { session: true }), env, {});
    assert.equal(response.status, 200);
    assert.equal((await response.json()).link, '/2026-11/2026-11-23/');
    assert.equal(JSON.parse(await env.DATA_KV.get('2026-11-23-report')).report_date, '2026-11-23');
    assert.equal(network.mock.callCount(), 1);
});

test('manual daily and podcast write rejects an invalid date before repository access', async t => {
    const env = fixtureEnv();
    const network = t.mock.method(globalThis, 'fetch', async () => { throw Error('No requests expected'); });
    const form = new URLSearchParams({ date: 'announcement', daily_summary_markdown: 'Daily', podcast_script_markdown: 'Podcast' });
    const result = await worker.fetch(request('/commitToGitHub', 'POST', { session: true, body: form }), env, {});
    assert.equal(result.status, 400);
    assert.equal(network.mock.callCount(), 0);
});

test('authorized manual daily and podcast commit keeps the empty-date default', async t => {
    const env = fixtureEnv();
    const writes = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        if (options.method === 'GET') return Response.json({ sha: 'existing-sha' });
        assert.equal(options.method, 'PUT');
        writes.push(new URL(url).pathname.split('/contents/')[1]);
        return Response.json({ content: { sha: 'updated-sha' } });
    });
    const form = new URLSearchParams({ date: '', daily_summary_markdown: 'Daily', podcast_script_markdown: 'Podcast' });
    const result = await worker.fetch(request('/commitToGitHub', 'POST', { session: true, body: form }), env, {});
    assert.equal(result.status, 200);
    assert.ok((await result.json()).results.every(x => x.status === 'Success'));
    assert.deepEqual(writes, ['daily/' + getISODate() + '.md', 'podcast/' + getISODate() + '.md']);
});

test('document writer rejects non-content destinations and non-Markdown files before fetch', async t => {
    const network = t.mock.method(globalThis, 'fetch', async () => { throw Error('No requests expected'); });
    for (const path of ['hugo.yaml', 'package.json', '.github/README.md', 'content/settings.json', 'daily//notes.md']) {
        await assert.rejects(createOrUpdateGitHubFile(fixtureEnv(), path, 'fixture', 'Update fixture'), /not allowed|Invalid GitHub document path/);
    }
    assert.equal(network.mock.callCount(), 0);
});

test('daily, podcast, RSS and opportunity publication still use the original Markdown destinations', async t => {
    const requested = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requested.push(new URL(url).pathname);
        assert.equal(options.method, 'PUT');
        assert.equal(JSON.parse(options.body).branch, 'main');
        return Response.json({ content: { sha: 'fixture-sha' } });
    });
    const paths = [
        'daily/2026-11-23.md', 'podcast/2026-11-23.md', 'rss/2026-11-23.md',
        'content/cn/2026-11/2026-11-23.md', 'content/cn/_index.md',
        'content/cn/opportunity/2026-11/2026-11-23.md',
        'content/cn/account-opportunity/_index.md',
        'content/cn/Archive note.md',
    ];
    for (const path of paths) await createOrUpdateGitHubFile(fixtureEnv(), path, 'fixture', 'Update fixture');
    assert.deepEqual(requested, paths.map(path => '/repos/fixture-owner/fixture-publication/contents/' +
        path.split('/').map(encodeURIComponent).join('/')));
});
