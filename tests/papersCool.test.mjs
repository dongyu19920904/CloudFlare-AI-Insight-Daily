import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import source, { PAPERS_COOL_FEED, parsePapersCoolAtom } from '../src/dataSources/papers-cool.js';
import { setFetchDate } from '../src/helpers.js';
import { getArxivPaperId, selectDailyPaperCandidates, filterRecentlyPublishedPapers,
  rememberPublishedDailyPapers, RECENT_DAILY_PAPERS_KEY, requiredDailyResearchItems } from '../src/dailyPaperPolicy.js';

const summary = 'We evaluate AI coding agents on a reproducible benchmark. Experiments compare task completion against a baseline, with a measured limitation on the test dataset.';
const entry = (id, options = {}) => `<entry><id>https://papers.cool/arxiv/${id}</id>
  <title>${options.title || `AI agents study ${id}`}</title><updated>${options.updated || '2026-11-06T12:00:00Z'}</updated>
  <author><name>Researcher ${id}</name></author><link rel="alternate" href="https://papers.cool/arxiv/${id}"/>
  <summary><![CDATA[${summary}]]></summary></entry>`;
const atom = body => `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><updated>2099-01-01T00:00:00Z</updated>${body}</feed>`;

test('Atom namespaces, CDATA, authors and entry times are parsed, not feed refresh time', () => {
  const items = parsePapersCoolAtom(atom(entry('2611.08452', { title: 'AI agents &amp; reproducible code' })), '2026-11-09');
  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://arxiv.org/abs/2611.08452');
  assert.equal(items[0].title, 'AI agents & reproducible code');
  assert.equal(items[0].description, summary);
  assert.match(items[0].authors, /Researcher/);
  assert.equal(items[0].published_date, '2026-11-06T12:00:00.000Z');
  const prefixed = atom(entry('2611.08452')).replace(/<(\/?)(feed|entry|id|title|updated|author|name|link|summary)\b/g, '<$1a:$2').replace('xmlns=', 'xmlns:a=');
  assert.equal(parsePapersCoolAtom(prefixed, '2026-11-09').length, 1);
});

test('empty, malformed, oversized and entity-bearing feeds cannot create news', () => {
  assert.deepEqual(parsePapersCoolAtom(atom(''), '2026-11-09'), []);
  assert.throws(() => parsePapersCoolAtom('<feed>'), /invalid-atom/);
  assert.throws(() => parsePapersCoolAtom('<!DOCTYPE feed [<!ENTITY x "test">]>' + atom('')), /unsafe/);
  assert.throws(() => parsePapersCoolAtom('x'.repeat(1024 * 1024 + 1)), /oversize/);
});

test('paper pool is capped and excludes stale/future/invalid entries without changing the news window', () => {
  const xml = atom(entry('2611.00001', { updated: '2026-10-01T12:00:00Z' })
    + entry('2611.00002', { updated: '2099-11-09T12:00:00Z' }) + entry('invalid')
    + Array.from({ length: 20 }, (_, i) => entry(`2611.${String(i + 10).padStart(5, '0')}`)).join(''));
  assert.equal(parsePapersCoolAtom(xml, '2026-11-09').length, 8);
});

test('arXiv IDs are canonical across PDFs, revisions, discovery links and HF', () => {
  for (const url of ['https://arxiv.org/abs/2611.08452v2', 'https://arxiv.org/pdf/2611.08452v3.pdf',
    'https://arxiv.org/html/2611.08452v1', 'https://papers.cool/arxiv/2611.08452', 'https://huggingface.co/papers/2611.08452']) {
    assert.equal(getArxivPaperId(url), '2611.08452');
  }
  assert.equal(getArxivPaperId('https://arxiv.org.evil.example/abs/2611.08452'), '');
  assert.equal(getArxivPaperId('javascript:alert(1)'), '');
  const candidates = [{ url: 'https://papers.cool/arxiv/2611.08452', title: 'First' },
    { url: 'https://arxiv.org/abs/2611.08452v2', title: 'Translated version' },
    { url: 'https://example.org/paper', title: '中文论文摘要' }];
  assert.equal(selectDailyPaperCandidates(candidates).length, 2);
});

test('seven-day published history excludes revisions but allows same-day preview and expires old records', async () => {
  const paper = { url: 'https://arxiv.org/abs/2611.08452v2' };
  assert.equal(filterRecentlyPublishedPapers([paper], [{ paperId: '2611.08452', date: '2026-11-02' }], '2026-11-09').length, 0);
  assert.equal(filterRecentlyPublishedPapers([paper], [{ paperId: '2611.08452', date: '2026-11-01' }], '2026-11-09').length, 1);
  assert.equal(filterRecentlyPublishedPapers([paper], [{ paperId: '2611.08452', date: '2026-11-09' }], '2026-11-09').length, 1);
  const map = new Map();
  const kv = { get: async key => map.get(key), put: async (key, value) => map.set(key, value) };
  await rememberPublishedDailyPapers(kv, '2026-11-09', '[research](https://arxiv.org/abs/2611.08452)');
  assert.deepEqual(JSON.parse(map.get(RECENT_DAILY_PAPERS_KEY)), [{ paperId: '2611.08452', date: '2026-11-09' }]);
  await rememberPublishedDailyPapers({ get() { throw new Error('unavailable'); }, put() { throw new Error('unavailable'); } }, '2026-11-09', '[paper](https://arxiv.org/abs/2611.08452)');
});

test('network failure returns an optional empty source and does not pass Folo cookies', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, PAPERS_COOL_FEED);
      assert.equal(options.headers.Cookie, undefined);
      assert.equal(options.redirect, 'error');
      return new Response('unavailable', { status: 503 });
    };
    assert.deepEqual(await source.fetch({}, 'private-folo-cookie'), { items: [] });
    setFetchDate('2026-11-09');
    globalThis.fetch = async () => new Response(atom(entry('2611.08452')));
    assert.equal((await source.fetch()).items.length, 1);
  } finally { globalThis.fetch = original; }
});

test('optional source deadline also covers a stalled response body', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(new ReadableStream({ start() {} }));
    const start = Date.now();
    assert.deepEqual(await source.fetch(), { items: [] });
    assert.ok(Date.now() - start < 6500);
  } finally { globalThis.fetch = original; }
});

test('paper history is read only for daily and written only after the successful publish boundary', async () => {
  const code = await readFile(new URL('../src/handlers/scheduled.js', import.meta.url), 'utf8');
  const start = code.indexOf('export async function handleScheduledDaily');
  const end = code.indexOf('export async function handleScheduledOpportunity', start);
  const daily = code.slice(start, end);
  assert.match(daily, /applyDailyPaperDedupe: true/);
  assert.ok(daily.indexOf('await rememberPublishedDailyPapers') > daily.indexOf('await commitDailyOutputs'));
  assert.ok(daily.indexOf('await rememberPublishedDailyPapers') > daily.indexOf('Dry-run completed successfully'));
  assert.doesNotMatch(code.slice(end), /applyDailyPaperDedupe: true|rememberPublishedDailyPapers\(/);
});

test('new optional papers cannot introduce a main-daily publication gate', () => {
  const paper = 'Papers Title: Agent benchmark\nSource: arXiv via papers.cool\nUrl: https://arxiv.org/abs/2611.08452';
  assert.equal(requiredDailyResearchItems([paper, paper], 2), 0);
  assert.equal(requiredDailyResearchItems(['News Title: Ordinary AI news'], 0), 0);
  assert.equal(requiredDailyResearchItems([paper, 'Papers Title: Existing HF paper\nSource: huggingface-papers'], 2), 1);
});

test('optional research does not increase the existing topic-section publication gate', async () => {
  const code = await readFile(new URL('../src/handlers/scheduled.js', import.meta.url), 'utf8');
  assert.match(code, /minimumResearchItems = requiredDailyResearchItems/);
  const potential = code.slice(code.indexOf('const potentialTopicSections ='), code.indexOf('const minimumTopicSections ='));
  assert.match(potential, /minimumResearchItems > 0/);
  assert.doesNotMatch(potential, /reservedPaperItems > 0/);
});

test('practical reproduction research outranks a generic frontier claim without fabricated popularity', () => {
  const base = { description: 'The authors evaluate AI agents on a reproducible experiment benchmark.', published_date: '2026-11-05' };
  const generic = { ...base, title: 'Scientist World for AI scientists', url: 'https://arxiv.org/abs/2611.00001' };
  const practical = { ...base, title: 'ReproBridge: reproducibility of software experiments', url: 'https://arxiv.org/abs/2611.00002' };
  assert.equal(selectDailyPaperCandidates([generic, practical], 1)[0].url, practical.url);
});
