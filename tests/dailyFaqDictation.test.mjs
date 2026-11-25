import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDailyFaqProductLinks, loadDailyShopContext } from '../src/dailyShopFaq.js';
import { loadRecentDailyFaqs } from '../src/dailyStandaloneFaq.js';

const store = 'https://www.aivora.cn/products';
const standard = `${store}/standard-plus`;
const halfPrice = `${store}/chatgpt-plus-half-price-renewal-monthly`;
const sourceUrl = 'https://www.aibase.com/zh/news/32445';
const officialUrl = 'https://help.openai.com/en/articles/12168547-voice-dictation-faq';
const source = `News Title: AI日报：ChatGPT上线实时听写功能；谷歌主页新增AI搜索侧边栏\nUrl: ${sourceUrl}\nContent Summary: ChatGPT 语音输入升级，支持转写后即时修改。另一条报道提到了 Gemini API。`;
const issue = `## 今日焦点 TOP 10\n\n### 4. ChatGPT 语音输入取消时长限制\n\n[实时听写更新](${sourceUrl})介绍听写功能。\n\n`;
const oldFaq = '## **❓ 相关问题**\n\n**ChatGPT 语音输入升级后，怎么才能第一时间用上？**\n\n实时听写功能正在全平台陆续推送，普通账号也在推送范围内。Plus 账号通常享有更优先的功能推送节奏。\n';
const recentFaqs = [{ date: '2026-11-15', productUrls: [standard] }];

function sampleFetch(calls, { official = true, available = true, correctCanonical = true, otherInStock = false } = {}) {
  return async (url) => {
    calls.push(url);
    if (url === 'https://www.aivora.cn/sitemap.xml') return new Response(
      `<urlset>${[store, standard, halfPrice].map(x => `<url><loc>${x}</loc></url>`).join('')}</urlset>`,
    );
    if (url === store) return new Response(`<link rel="canonical" href="${store}"><a href="${standard}">ChatGPT Plus 充值续费</a>`);
    if (url === officialUrl && official) return new Response('<main>Voice Dictation - FAQ. Press the microphone icon to record. The transcription is returned as text, which you can edit before sending.</main>');
    if (url === halfPrice) return new Response(`<link rel="canonical" href="${correctCanonical ? url : standard}"><h1>ChatGPT Plus｜充值续费【半价月卡】</h1><p>先查询半价资格。</p><script type="application/ld+json">{"@type":"Product","url":"${url}","offers":{"url":"${url}","availability":"https://schema.org/${available ? 'InStock' : 'OutOfStock'}"}}</script>${
      otherInStock ? `<script type="application/ld+json">{"@type":"Product","url":"${standard}","offers":{"url":"${standard}","availability":"https://schema.org/InStock"}}</script>` : ''}`);
    return new Response(null, { status: 403 });
  };
}

test('Nov 21 unlinked dictation question recovers the actual story and a non-repeated live SKU', async () => {
  const calls = [];
  const fetchImpl = sampleFetch(calls);
  const context = { ...await loadDailyShopContext([source], { fetchImpl }), recentFaqs };
  assert.deepEqual(context.products.map(x => x.url), [standard]);
  const result = await ensureDailyFaqProductLinks(issue + oldFaq, context, { fetchImpl });
  assert.ok(result.markdown.startsWith(issue));
  assert.match(result.markdown.slice(issue.length), /官网|OpenAI/);
  assert.match(result.markdown.slice(issue.length), /先查.*半价资格/);
  assert.doesNotMatch(result.markdown, /更优先/);
  assert.deepEqual(result.links.map(x => x.url), [halfPrice]);
  assert.equal(result.requests, 2);
  assert.ok(calls.includes(officialUrl));
  assert.equal(calls.includes(standard), false);
  assert.equal((await ensureDailyFaqProductLinks(result.markdown, context, { fetchImpl })).markdown, result.markdown);
});

test('dictation fallback never forces a recommendation without a unique grounded event, official proof or unused live product', async () => {
  for (const options of [{ official: false }, { available: false }, { correctCanonical: false }, { available: false, otherInStock: true }]) {
    const fetchImpl = sampleFetch([], options);
    const context = { ...await loadDailyShopContext([source], { fetchImpl }), recentFaqs };
    const result = await ensureDailyFaqProductLinks(issue + oldFaq, context, { fetchImpl });
    assert.equal(result.links.length, 0);
    assert.ok(result.markdown.startsWith(issue));
    assert.doesNotMatch(result.markdown, /更优先|chatgpt-plus-half-price-renewal-monthly/);
  }
  const calls = [];
  const fetchImpl = sampleFetch(calls);
  const context = { ...await loadDailyShopContext([source], { fetchImpl }),
    recentFaqs: [...recentFaqs, { productUrls: [halfPrice] }] };
  const result = await ensureDailyFaqProductLinks(issue + oldFaq, context, { fetchImpl });
  assert.equal(result.links.length, 0);
  assert.ok(!calls.includes(halfPrice));
  assert.doesNotMatch(result.markdown, /更优先/);
  calls.length = 0;
  const secondUrl = 'https://www.aibase.com/zh/news/another-dictation';
  const second = source.replace(sourceUrl, secondUrl);
  const withNewSource = issue + `[另一场发布](${secondUrl})\n\n`;
  const ambiguous = await ensureDailyFaqProductLinks(withNewSource + oldFaq,
    { ...context, sourceItems: [source, second], sourceText: `${source}\n${second}` }, { fetchImpl });
  assert.ok(ambiguous.markdown.startsWith(withNewSource));
  assert.doesNotMatch(ambiguous.markdown.slice(withNewSource.length), /更优先|https?:\/\//);
  assert.deepEqual(calls, []);
});

test('one seven-date GitHub read uses the published merchandise, including manual patches and bold questions', async () => {
  const env = { GITHUB_TOKEN: 'fixture-token', GITHUB_REPO_OWNER: 'owner', GITHUB_REPO_NAME: 'front', GITHUB_BRANCH: 'main' };
  let requests = 0;
  const faq = oldFaq.replace('Plus 账号通常享有更优先的功能推送节奏。', `[验证商品](${halfPrice}?ref=news\n "Offer")。`);
  const history = await loadRecentDailyFaqs(null, '2026-11-22', { env, fetchImpl: async (url, options) => {
    requests++;
    assert.equal(options.redirect, 'manual');
    if (url === 'https://news.aivora.cn/ai-daily-release-state.json') return Response.json({
      version: 1, latest: '2026-11-21', source: 'a'.repeat(40), articles: Array.from({ length: 7 }, (_, i) =>
        `2026-11/2026-11-${21 - i}/index.html`),
    });
    assert.equal(url, 'https://api.github.com/graphql');
    const { query, variables } = JSON.parse(options.body);
    assert.deepEqual(variables, { owner: 'owner', name: 'front' });
    assert.equal((query.match(/content\/cn\/2026-11\/2026-11-\d{2}\.md/g) || []).length, 7);
    assert.match(query, /content\/cn\/2026-11\/2026-11-21\.md/);
    assert.match(query, /content\/cn\/2026-11\/2026-11-15\.md/);
    return Response.json({ data: { repository: Object.fromEntries(Array.from({ length: 7 }, (_, index) =>
      [`d${index}`, { text: '---\ntitle: edition\n---\n' + (index === 0 ? faq : '# Published issue without a FAQ'), isTruncated: false }])) } });
  } });
  assert.equal(requests, 2);
  assert.deepEqual(history.map(x => [x.date, x.productUrls]), [['2026-11-21', [halfPrice]]]);
  assert.equal(await loadRecentDailyFaqs(undefined, '2026-11-22', { env,
    fetchImpl: async () => Response.json({ data: { repository: { d0: null } } }),
  }), null);
});

test('published history follows the manifest source and the pinned Nov 23 archive, not mutable main', async () => {
  const env = { GITHUB_TOKEN: 'fixture-token', GITHUB_REPO_OWNER: 'owner', GITHUB_REPO_NAME: 'front', GITHUB_BRANCH: 'main' };
  const revision = 'a'.repeat(40);
  const pinned = '18e64db6b1ccaa141e9610442def2da1c34fbb5c';
  const reads = [];
  const entry = (date, product) => `---\ntitle: edition\n---\n## \u76f8\u5173\u95ee\u9898\n\n### ChatGPT ${date}?\n\n[Offer](${product})\n`;
  const history = await loadRecentDailyFaqs(null, '2026-11-25', { env, fetchImpl: async (url, options) => {
    assert.equal(options.redirect, 'manual');
    if (url === 'https://news.aivora.cn/ai-daily-release-state.json') return Response.json({
      version: 1, latest: '2026-11-24', source: revision,
      articles: ['2026-11/2026-11-24/index.html', '2026-11/2026-11-23/index.html'],
    });
    if (url === 'https://api.github.com/graphql') {
      const { query } = JSON.parse(options.body);
      assert.ok(query.includes(`${revision}:content/cn/2026-11/2026-11-24.md`));
      assert.ok(query.includes(`${pinned}:content/cn/2026-11/2026-11-23.md`));
      assert.doesNotMatch(query, /main:|2026-11-22/);
      return new Response(null, { status: 503 });
    }
    const [, date, ref] = /\/(2026-11-2[34])\.md\?ref=([0-9a-f]{40})$/.exec(url);
    assert.equal(ref, date === '2026-11-23' ? pinned : revision);
    reads.push(date);
    return new Response(entry(date, date === '2026-11-23' ? halfPrice : 'https://www.aivora.cn/products/other'));
  } });
  assert.deepEqual(reads, ['2026-11-24', '2026-11-23']);
  assert.deepEqual(history.map(({ date, productUrls }) => [date, productUrls[0]]), [
    ['2026-11-23', halfPrice], ['2026-11-24', 'https://www.aivora.cn/products/other'],
  ]);
});

test('FAQ history does not use a redirect as publication evidence or follow it with credentials', async () => {
  const env = { GITHUB_TOKEN: 'fixture-token', GITHUB_REPO_OWNER: 'owner', GITHUB_REPO_NAME: 'front' };
  const calls = [];
  const location = 'https://other.example/redirect-target';
  const redirect = () => new Response(null, { status: 302, headers: { Location: location } });
  const verify = async serveManifest => loadRecentDailyFaqs(null, '2026-11-25', { env, fetchImpl: async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, 'manual');
    assert.notEqual(url, location);
    if (serveManifest && url === 'https://news.aivora.cn/ai-daily-release-state.json') return Response.json({
      version: 1, latest: '2026-11-24', source: 'a'.repeat(40), articles: ['2026-11/2026-11-24/index.html'],
    });
    return redirect();
  } });
  assert.equal(await verify(false), null);
  assert.equal(calls.length, 1);
  calls.length = 0;
  assert.equal(await verify(true), null);
  assert.equal(calls.length, 3);
  assert.ok(calls[1].startsWith('https://api.github.com/graphql'));
  assert.ok(calls[2].startsWith('https://api.github.com/repos/'));
});

test('unverifiable history still permits a factual answer, not a paid-priority claim or store request', async () => {
  const calls = [];
  const fetchImpl = sampleFetch(calls);
  const ctx = { ...await loadDailyShopContext([source], { fetchImpl }), faqHistoryUnavailable: true };
  const result = await ensureDailyFaqProductLinks(issue + oldFaq, ctx, { fetchImpl });
  assert.equal(result.requests, 0);
  assert.equal(result.links.length, 0);
  assert.ok(result.markdown.startsWith(issue));
  assert.doesNotMatch(result.markdown, /更优先|aivora\.cn/);
});
