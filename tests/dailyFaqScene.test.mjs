import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildStandaloneDailyFaqPromptInput, normalizeStandaloneDailyFaqSection,
  insertStandaloneDailyFaq, withDailyFaqDeadline, getStandaloneDailyFaqSystemPrompt,
  loadRecentDailyFaqs, rememberPublishedDailyFaq, isRepeatedDailyFaq, DAILY_FAQ_SECTION } from '../src/dailyStandaloneFaq.js';
import { finalizeDailyShopFaq, ensureDailyFaqProductLinks, loadDailyFaqSceneContext, loadDailyShopContext } from '../src/dailyShopFaq.js';

const sourceUrl = 'https://github.com/example/skills';
const sourceText = `Project Name: skills\nUrl: ${sourceUrl}\nDescription: Claude Code 工作流技能库`;
const context = {
  catalogUrl: 'https://www.aivora.cn/products', topics: ['Claude'], sourceText,
  scene: { topic: 'Claude', sourceUrl, sourceText,
    product: { name: 'Claude Pro 充值续费', url: 'https://www.aivora.cn/products/verified-sku' },
    official: { url: 'https://support.claude.com/help', text: 'Pro subscribers can use Claude Code.' },
  },
};
const article = `## 新闻\r\n\r\n[Claude Code 技能库](${sourceUrl})\r\n\r\n![图片](https://example.org/image.png)\r\n\r\n`;
const oldFaq = '## **❓ 相关问题**\n\n### 项目是什么？\n\n旧问答。\n\n';
const footer = '## 页脚\r\n\r\n不能改变。\r\n';
const raw = `## **❓ 相关问题**\n\n### 买了 Claude 会员，为什么改代码还得重新交代？\n\n**缺的可能是流程，不是更贵的会员。** 今天的[技能库](${sourceUrl})把重复交代的工作步骤写成了说明。先装一个合适的 Skill，再拿小任务试跑，看看流程是否适合自己。已有账号，可以看看[爱窝啦·AI账号店的 Claude Pro 续费](AIVORA_PRODUCT_URL)，会员只是工具入口，技能需要另行安装。`;

test('scene FAQ can replace a generic FAQ and uses distinct news, official and delivery evidence', () => {
  const input = buildStandaloneDailyFaqPromptInput('2026-10-03', article + oldFaq, [sourceText], context);
  assert.equal(input.topic, 'Claude');
  assert.match(input.prompt, /B 场景型/);
  assert.match(input.prompt, /80-110/);
  assert.match(input.prompt, /不重写新闻正文/);
  assert.match(input.prompt, /同一自然段里顺接/);
  assert.match(input.prompt, /不得生成商品 URL/);
  assert.match(input.prompt, /登录不通先排查原登录方式/);
  assert.match(getStandaloneDailyFaqSystemPrompt(), /只输出/);
  assert.match(getStandaloneDailyFaqSystemPrompt(), /80-110 个可见字符/);
  assert.match(getStandaloneDailyFaqSystemPrompt(), /商品名和链接文字也计入/);
  assert.match(input.prompt, /不问某套餐是否够用/);
  assert.match(getStandaloneDailyFaqSystemPrompt(), /新闻摘要不是安装文档/);
  assert.match(getStandaloneDailyFaqSystemPrompt(), /不把购买说成修复故障/);
});

test('normalization fills only a verified product URL and replacement preserves all non-FAQ bytes', () => {
  const section = normalizeStandaloneDailyFaqSection(raw, sourceUrl, sourceText, 'Claude', context);
  assert.ok(section);
  const result = finalizeDailyShopFaq(insertStandaloneDailyFaq(article + oldFaq + footer, section), context);
  assert.ok(result.startsWith(article));
  assert.ok(result.endsWith(footer));
  assert.equal((result.match(/^## .*相关问题/gm) || []).length, 1);
  assert.match(result, /verified-sku/);
  assert.doesNotMatch(result, /旧问答|AIVORA_PRODUCT_URL|准备比较当前公开/);
});

test('scene FAQ rejects refusal, invented URLs, duplicate brand, unsupported prices and empty answers', () => {
  for (const bad of ['', '我需要你确认后再写日报', raw.replace(sourceUrl, 'https://example.org/invented'),
    raw.replace('会员只是工具入口', '售价 99 元'), raw.replace('更贵的会员', '无限使用'),
    raw.replace('会员只是工具入口', '国内不限地区都可用'),
    raw.replace('会员只是工具入口', '数据本身没有加密'),
    raw.replace('会员只是工具入口', '提供稳定账号'),
    raw.replace('会员只是工具入口', '可以直接开始使用这项功能'),
    raw.replace('会员只是工具入口', '这是一段过长的重复说明'.repeat(25)),
    raw.replace('已有账号', '爱窝啦·AI账号店已有账号'), raw.replace('AIVORA_PRODUCT_URL', context.scene.product.url)]) {
    assert.equal(normalizeStandaloneDailyFaqSection(bad, sourceUrl, sourceText, 'Claude', context), '');
  }
});

test('a useful usage question may recommend the verified product without forcing membership into its title', () => {
  const draft = raw.replace('买了 Claude 会员，为什么改代码还得重新交代？', 'Claude 改代码为什么还得重新交代？');
  assert.ok(normalizeStandaloneDailyFaqSection(draft, sourceUrl, sourceText, 'Claude', context));
});

test('a finished account is not presented as a renewal for an existing account', () => {
  const finished = { ...context, scene: { ...context.scene,
    product: { ...context.scene.product, name: 'Claude Pro 成品号' } } };
  assert.equal(normalizeStandaloneDailyFaqSection(raw, sourceUrl, sourceText, 'Claude', finished), '');
  const valid = raw.replace('已有账号', '还没有账号').replace('Claude Pro 续费', 'Claude Pro 成品号');
  assert.ok(normalizeStandaloneDailyFaqSection(valid, sourceUrl, sourceText, 'Claude', finished));
});

// Exercise the actual optional block with external operations stubbed, not a second publishing path.
const scheduled = readFileSync(new URL('../src/handlers/scheduled.js', import.meta.url), 'utf8');
const start = scheduled.indexOf('    if (validation.ok) {', scheduled.indexOf('const funStatsBeforeStandaloneGeneration'));
const end = scheduled.indexOf('    dailySummaryMarkdownContent = normalizeMarkdownImageSyntax', start);
assert.ok(start >= 0 && end > start);
function runOptional(overrides = {}) {
  return vm.runInNewContext(`(async function(markdown, shopContext = {}, input = {}) {
    let dailySummaryMarkdownContent = markdown; let validation = {ok:true}; const debugInfo = {};
    const env = input.env || {}; const dateStr = input.date || '2026-10-03'; const faqSourceItems = input.items || [];
    const dailyShopContext = shopContext; const outputOfCall3 = ''; const options = {dryRun:true};
    ${scheduled.slice(start, end)}
    return {markdown:dailySummaryMarkdownContent, debug:debugInfo};
  })`, {
    console: {warn() {}}, buildStandaloneDailyFaqPromptInput, normalizeStandaloneDailyFaqSection,
    insertStandaloneDailyFaq, withDailyFaqDeadline, getStandaloneDailyFaqSystemPrompt, finalizeDailyShopFaq, ensureDailyFaqProductLinks,
    removeMarkdownCodeBlock: (text) => text, loadRecentDailyFaqs: async () => [], loadDailyFaqSceneContext: async () => context,
    generateContentWithTransportFallback: async () => raw,
    validateGeneratedDaily: () => ({ok:true}), ...overrides,
  });
}

const nov22Dictation = 'https://www.aibase.com/zh/news/32445';
const nov22Flow = 'https://x.com/Gorden_Sun/status/2124124404208804306';
const nov22Catalog = 'https://www.aivora.cn/products';
const nov22Product = nov22Catalog + '/nian-ka-han-fan-zhong-li-bian-ji-qi-zhi-bao-yi-yue';
const nov22ProductName = 'Gemini Pro｜成品号【3-12个月 随机发】含反重力';
const nov22OldProduct = nov22Catalog + '/chatgpt-plus-half-price-renewal-monthly';
const nov22Items = [
  'News Title: AI日报：ChatGPT上线实时听写功能；谷歌主页新增AI搜索侧边栏；微信12月起强制要求AI短剧提交生成证明\n' +
    'Url: ' + nov22Dictation + '\nContent Summary: ChatGPT 语音输入升级，实现边说边转写并支持即时修改。',
  'News Title: Antigravity Flow：让Antigravity直接在浏览器里操作Google Flow制作视频\n' +
    'Url: ' + nov22Flow + '\nContent Summary: 插件将 Google Flow 接入 Antigravity，扣积分前提示用量，额度不足会暂停。',
];
const nov22Body = '## 今日焦点 TOP 10\n\n### 5. ChatGPT 语音输入取消时长限制\n\n[实时听写更新](' + nov22Dictation + ')\n\n' +
  '## AI 趣闻\n\n### 一键拍片，但积分不够时它会乖乖停下来等你\n\n[插件跑完整流程的演示](' + nov22Flow + ')\n\n';
const nov22OldFaq = '## **❓ 相关问题**\n\n### ChatGPT 实时听写，要买 Plus 才能用吗？\n\n' +
  '**先看输入框里的麦克风。** 具体变化看[当天的听写报道](' + nov22Dictation + ')。 能不能用，以账号实际显示和官方说明为准。 开会员不等于能提前收到推送。\n\n';
const nov22Env = { GITHUB_REPO_OWNER: 'owner', GITHUB_REPO_NAME: 'front', GITHUB_TOKEN: 'fixture-token' };
const nov22Input = { env: nov22Env, date: '2026-11-22', items: nov22Items };
function nov22Fetch(calls, opts = {}) {
  return async (url, options) => {
    calls.push(url);
    if (url === 'https://api.github.com/graphql') return new Response(null, { status: 403 });
    if (url.startsWith('https://api.github.com/repos/owner/front/contents/')) {
      assert.equal(options.headers.Accept, 'application/vnd.github.raw+json');
      if (url.includes('/2026-11-19.md') && opts.historyFails) return new Response(null, { status: 503 });
      if (url.includes('/2026-11-19.md') && opts.missingHistory) return new Response(null, { status: 404 });
      if (!url.includes('/2026-11-21.md')) return new Response('---\ntitle: 已发布日报\n---\n没有 FAQ');
      if (opts.otherTopicYesterday) return new Response('---\ntitle: 已发布日报\n---\n## 相关问题\n\n### Claude 能帮我推导物理公式吗？\n\n研究来自 Anthropic。');
      const other = opts.productUsed ? ' [店铺商品](' + nov22Product + '?ref=daily)。' : '';
      return new Response('---\ntitle: 已发布日报\n---\n' + nov22OldFaq.replace(nov22Dictation, nov22Dictation + '?utm_source=rss') +
        '[去店铺前核对资格](' + nov22OldProduct + ')。' + other);
    }
    if (url === 'https://news.aivora.cn/ai-daily-release-state.json') return Response.json({
      version: 1, latest: opts.staleArchive ? '2026-11-20' : '2026-11-21', source: 'a'.repeat(40),
      articles: Array.from({ length: 7 }, (_, i) => 21 - i).filter(day => day !== 19 || !opts.unpublished)
        .map(day => `2026-11/2026-11-${day}/index.html`),
    });
    if (url === 'https://www.aivora.cn/sitemap.xml')
      return new Response('<urlset>' + [nov22Catalog, nov22OldProduct, nov22Product].map(x => '<url><loc>' + x + '</loc></url>').join('') + '</urlset>');
    if (url === nov22Catalog && opts.catalogOffline) return new Response(null, { status: 503 });
    if (url === nov22Catalog) return new Response('<link rel="canonical" href="' + url + '">' + (opts.sitemapOnly ? '' :
      '<a href="' + nov22OldProduct + '">ChatGPT Plus 充值续费</a>') + (opts.publicListOnly ? '' : '<a href="' + nov22Product + '">' + nov22ProductName + '</a>'));
    if (opts.publicListOnly && url === 'https://www.aivora.cn/api/v1/public/products?page=1&page_size=50')
      return Response.json({ data: [{ slug: nov22Product.split('/').at(-1), title: { 'zh-CN': nov22ProductName }, is_sold_out: false }] });
    if (opts.sitemapOnly && url === nov22OldProduct) return stockPage(url, 'ChatGPT Plus 充值续费【半价月卡】', '先查半价资格。');
    if (opts.sitemapOnly && url === nov22OldProduct.replace('/products/', '/api/v1/public/products/'))
      return detailPage(nov22OldProduct, 'ChatGPT Plus 充值续费【半价月卡】');
    if (opts.sitemapOnly && url.includes('voice-dictation-faq')) return new Response(
      '<main>Tap the microphone icon. The transcription can be edited: edit before sending.</main>');
    if (url === nov22Product) return stockPage(url, nov22ProductName);
    if (url === nov22Product.replace('/products/', '/api/v1/public/products/')) return Response.json({ data: {
      slug: url.split('/').at(-1), title: { 'zh-CN': nov22ProductName }, is_sold_out: opts.soldOut === true,
      skus: [{ is_active: true, is_sold_out: opts.soldOut === true, stock_status: opts.soldOut ? 'out_of_stock' : 'in_stock' }],
    } });
    if (url.includes('16287445')) return new Response('<main>在 Google Flow 中使用 AI 点数。</main>');
    return new Response(null, { status: 503 });
  };
}

function stockPage(url, name, extra = '') {
  return new Response('<link rel="canonical" href="' + url + '"><h1>' + name + '</h1>' + extra +
    '<script type="application/ld+json">' + JSON.stringify({
      '@type': 'Product', url, offers: { url, availability: 'https://schema.org/InStock' },
    }) + '</script>');
}

function detailPage(productUrl, name) {
  return Response.json({ data: { slug: productUrl.split('/').at(-1), title: { 'zh-CN': name }, is_sold_out: false,
    skus: [{ is_active: true, is_sold_out: false, stock_status: 'in_stock' }] } });
}

async function replayNov22({ fetchImpl, generateContentWithTransportFallback, body = nov22Body, items = nov22Items }) {
  const shop = await loadDailyShopContext(items, { fetchImpl });
  return runOptional({
    loadRecentDailyFaqs: (kv, date, opts) => loadRecentDailyFaqs(kv, date, { ...opts, fetchImpl }),
    loadDailyFaqSceneContext: (markdown, items, ctx, opts) => loadDailyFaqSceneContext(markdown, items, ctx, { ...opts, fetchImpl }),
    generateContentWithTransportFallback,
    withDailyFaqDeadline: task => withDailyFaqDeadline(task, 80),
  })(body + nov22OldFaq + footer, shop, { ...nov22Input, items });
}

test('Nov 22 scheduled replay: GraphQL unavailable and yesterday’s topic used, selects today’s verified Antigravity account', async () => {
  const calls = [];
  let generated = 0;
  const result = await replayNov22({ fetchImpl: nov22Fetch(calls),
    generateContentWithTransportFallback: async () => { generated++; return 'not used'; } });
  assert.equal(result.debug.dailyFaqHistoryVerified, true);
  assert.equal(result.debug.dailyFaqSceneTopic, 'Gemini');
  assert.equal(result.debug.dailyFaqUsedVerifiedFallback, true);
  assert.equal(result.debug.dailyFaqProductLinks[0].url, nov22Product);
  assert.ok(result.markdown.startsWith(nov22Body));
  assert.ok(result.markdown.endsWith(footer));
  assert.doesNotMatch(result.markdown.slice(nov22Body.length), /ChatGPT 实时听写|半价|买了就能/);
  assert.match(result.markdown, /别把它当 Flow 点数包买/);
  assert.equal(calls.filter(url => url.includes('/contents/')).length, 7);
  assert.equal(calls.includes(nov22OldProduct), false);
  assert.equal(generated, 0);
});

test('the verified scene survives a failed, invalid or timed out optional rewrite', async () => {
  const items = [nov22Items[0], 'News Title: Gemini 图片编辑示例\nUrl: ' + nov22Flow + '\nContent Summary: 演示如何改一张商品图。'];
  for (const generate of [async () => { throw Error('model unavailable'); }, async () => 'not a FAQ', () => new Promise(() => {})]) {
    const result = await replayNov22({ items, fetchImpl: nov22Fetch([]), generateContentWithTransportFallback: generate });
    assert.equal(result.debug.dailyFaqSeparateGenerationAttempted, true);
    assert.equal(result.debug.dailyFaqUsedVerifiedFallback, true);
    assert.equal(result.debug.dailyFaqProductLinks[0].url, nov22Product);
    assert.ok(result.markdown.startsWith(nov22Body));
    assert.ok(result.markdown.endsWith(footer));
  }
});

test('Nov 22 scheduled replay: incomplete history, no stock, used SKU or FAQ-only evidence never invents an offer', async () => {
  for (const opts of [{ historyFails: true }, { missingHistory: true }, { staleArchive: true }, { soldOut: true }, { productUsed: true }, { onlyFaq: true }]) {
    const calls = [];
    const body = opts.onlyFaq ? nov22Body.replace(nov22Flow, nov22Dictation) : nov22Body;
    let modelCalls = 0;
    const result = await replayNov22({ body, fetchImpl: nov22Fetch(calls, opts),
      generateContentWithTransportFallback: async () => { modelCalls++; return ''; } });
    assert.ok(result.markdown.startsWith(body));
    assert.ok(result.markdown.endsWith(footer));
    assert.equal(result.debug.dailyFaqProductLinks.length, 0, JSON.stringify({ opts, debug: result.debug }));
    assert.equal(modelCalls, 0);
    assert.doesNotMatch(result.markdown.slice(body.length), /www\.aivora\.cn\/products/);
    if (opts.productUsed) assert.doesNotMatch(result.markdown.slice(body.length), /ChatGPT 实时听写/);
    if (opts.historyFails || opts.productUsed || opts.onlyFaq) assert.equal(calls.includes(nov22Product), false);
  }
});

test('a genuinely unpublished day is verified by the live archive, and the public catalog covers a hidden item', async () => {
  const calls = [];
  const result = await replayNov22({ fetchImpl: nov22Fetch(calls, { missingHistory: true, unpublished: true, publicListOnly: true }),
    generateContentWithTransportFallback: async () => assert.fail('No model needed for this verified scene') });
  assert.equal(result.debug.dailyFaqHistoryVerified, true);
  assert.equal(result.debug.dailyFaqProductLinks[0].url, nov22Product);
  assert.ok(calls.includes('https://news.aivora.cn/ai-daily-release-state.json'));
  assert.ok(calls.includes(nov22Product.replace('/products/', '/api/v1/public/products/')));
});

test('a missing HTML listing still uses public product data when the sitemap and individual SKU can be verified', async () => {
  const calls = [];
  const result = await replayNov22({ fetchImpl: nov22Fetch(calls, { catalogOffline: true, publicListOnly: true }),
    generateContentWithTransportFallback: async () => assert.fail('No model needed for this verified scene') });
  assert.equal(result.debug.dailyFaqHistoryStatus, 'verified');
  assert.equal(result.debug.dailyFaqProductLinks[0].url, nov22Product);
  assert.ok(calls.includes('https://www.aivora.cn/api/v1/public/products?page=1&page_size=50'));
  assert.ok(calls.includes(nov22Product.replace('/products/', '/api/v1/public/products/')));
});

test('the optional stage distinguishes unverified history and leaves time for both rounds of product checks', async () => {
  const budgets = [];
  let reads = 0;
  let now = 0;
  const replay = runOptional({
    Date: { now: () => now },
    withDailyFaqDeadline: async (task, budget) => { budgets.push(budget); return task(); },
    loadRecentDailyFaqs: async () => { reads++; now += 7400; return null; },
    loadDailyFaqSceneContext: async (_markdown, _items, ctx) => ({ ...ctx, delivery: { reason: 'fixture' } }),
    ensureDailyFaqProductLinks: async markdown => ({ markdown, links: [], requests: 0, skipped: [] }),
  });
  const notChecked = await replay(article + oldFaq);
  assert.equal(notChecked.debug.dailyFaqHistoryStatus, 'not-checked');
  assert.equal(notChecked.debug.dailyFaqHistoryVerified, false);
  assert.equal(reads, 0);
  budgets.length = 0;
  const unavailable = await replay(article + oldFaq, { catalogVerified: true });
  assert.equal(unavailable.debug.dailyFaqHistoryStatus, 'unavailable');
  assert.equal(unavailable.debug.dailyFaqHistoryVerified, false);
  assert.equal(reads, 1);
  assert.equal(budgets[0], 8000);
  assert.equal(budgets[1], 12600);
  assert.equal(unavailable.markdown, article + oldFaq);
});

test('higher-ranked fresh source with a failed official or stock check falls through to a second scene', async () => {
  const calls = [];
  const result = await replayNov22({
    fetchImpl: nov22Fetch(calls, { otherTopicYesterday: true }),
    generateContentWithTransportFallback: async () => '',
  });
  assert.equal(result.debug.dailyFaqOfferCandidatesChecked, 2);
  assert.ok(calls.includes(nov22OldProduct));
  assert.equal(result.debug.dailyFaqProductLinks[0].url, nov22Product);
});

test('a sitemap-only renewal can serve fresh dictation with proof without another model call', async () => {
  let modelCalls = 0;
  const result = await replayNov22({
    fetchImpl: nov22Fetch([], { otherTopicYesterday: true, sitemapOnly: true }),
    generateContentWithTransportFallback: async () => { modelCalls++; return ''; },
  });
  assert.equal(result.debug.dailyFaqProductLinks[0].url, nov22OldProduct);
  assert.match(result.markdown, /先查半价资格/);
  assert.equal(modelCalls, 0);
});

test('an inline FAQ in a news title and the footer divider are not part of the real FAQ', async () => {
  const body = nov22Body.replace('### 5. ChatGPT 语音输入取消时长限制', '### 5. ChatGPT 发布听写 FAQ');
  const result = await replayNov22({
    body, fetchImpl: nov22Fetch([]), generateContentWithTransportFallback: async () => 'invalid',
  });
  assert.ok(result.markdown.startsWith(body));
  assert.equal((result.markdown.match(/^## \*\*❓ 相关问题\*\*$/gm) || []).length, 1);
  assert.equal(insertStandaloneDailyFaq(body + nov22OldFaq + '---\n' + footer, '## 相关问题\n\n新答案').slice(-(footer.length + 4)), '---\n' + footer);
});

test('a valid URL cannot label an API relay as official membership or a native account', () => {
  const relay = { ...context, scene: {
    ...context.scene, topic: 'Claude', product: { name: 'Claude API 中转', url: nov22Catalog + '/current-relay' },
  } };
  const mistaken = raw.replace('Claude Pro 续费', 'Claude 成品号');
  assert.equal(normalizeStandaloneDailyFaqSection(mistaken, sourceUrl, sourceText, 'Claude', relay), '');
  const falseClaim = raw.replace('Claude Pro 续费', 'Claude API 中转').replace('已有账号', '想买官网会员');
  assert.equal(normalizeStandaloneDailyFaqSection(falseClaim, sourceUrl, sourceText, 'Claude', relay), '');
  const wrongBrand = raw.replace('Claude Pro 续费', 'Gemini Pro 续费');
  assert.equal(normalizeStandaloneDailyFaqSection(wrongBrand, sourceUrl, sourceText, 'Claude', { ...context, delivery: {} }), '');
});

async function selectGeminiDelivery(text, products, fetchImpl) {
  const item = 'News Title: Gemini 编程工作流\nUrl: ' + nov22Flow + '\nContent Summary: ' + text;
  return loadDailyFaqSceneContext('[Gemini 编程工作流](' + nov22Flow + ')', [item],
    { catalogUrl: nov22Catalog, topics: ['Gemini'], products, productUrls: products.map(x => x.url) },
    { verifyDelivery: true, fetchImpl });
}

test('explicitly denied Antigravity does not match an editor account or block the real relay use', async () => {
  const relay = { name: 'Gemini API 中转', url: nov22Catalog + '/gemini-api-relay' };
  const account = { name: nov22ProductName, url: nov22Product };
  for (const name of [
    'Gemini Pro 成品号（不含反重力）', 'Gemini Pro account (Antigravity not included)',
    'Gemini Pro｜成品号【3-12个月 随机发】不包含反重力', 'Gemini Pro account does not come with Antigravity',
  ]) {
    const native = await selectGeminiDelivery('用 Antigravity 操作 Google Flow。', [account], async url =>
      url === account.url ? stockPage(url, name) : new Response('Flow'));
    assert.equal(native.scene, undefined);
  }
  for (const scene of ['调用 Gemini API，不使用 Antigravity。', 'Use Gemini API. Antigravity is not used.']) {
    const api = await selectGeminiDelivery(scene, [account, relay], async url => {
      if (url === relay.url) return stockPage(url, relay.name);
      if (url === relay.url.replace('/products/', '/api/v1/public/products/')) return detailPage(relay.url, relay.name);
      return new Response(null, { status: 404 });
    });
    assert.equal(api.scene.product.url, relay.url);
    assert.equal(api.scene.useVerifiedCopy, true);
    const result = await runOptional({ loadDailyFaqSceneContext: async () => api,
      generateContentWithTransportFallback: async () => '中转可开通 Gemini 手机 App Pro 和 Antigravity' })(nov22Body + nov22OldFaq);
    assert.equal(result.debug.dailyFaqSeparateGenerationAttempted, false);
    assert.match(result.markdown, /中转不是官网会员/);
    assert.doesNotMatch(result.markdown, /手机 App Pro/);
  }
});

test('an eligible third available SKU can recover the only verified topic after two failures', async () => {
  const offers = [1, 2, 3].map(n => ({ name: 'Gemini Pro 成品号 含反重力', url: nov22Catalog + '/gemini-editor-' + n }));
  const result = await selectGeminiDelivery('用 Antigravity 操作 Google Flow。', offers, async url => {
    if (url === offers[2].url) return stockPage(url, offers[2].name);
    if (url === offers[2].url.replace('/products/', '/api/v1/public/products/')) return detailPage(offers[2].url, offers[2].name);
    return new Response(null, { status: 404 });
  });
  assert.equal(result.scene.product.url, offers[2].url);
  assert.equal(result.delivery.checkedOffers, 3);
});

test('a sold-out first Gemini offer leaves a slot for another SKU for the same cited question', async () => {
  const sources = ['Gemini GIF 工具', 'ChatGPT 语音工具', 'Claude 写作功能'].map((title, i) => ({
    title, url: `https://news.example/daily-${i}`, text: `News Title: ${title}\nUrl: https://news.example/daily-${i}\nContent Summary: 功能开始推出。`,
  }));
  const body = sources.map(({ title, url }) => `[${title}](${url})`).join('\n\n') +
    `\n\n## 相关问题\n\n### Gemini 的 GIF 生成功能，免费用户能用吗？\n\n[这次开放的范围](${sources[0].url})取决于地区。`;
  const products = [
    ['Gemini Pro 成品号', 'gemini-sold-out'], ['Gemini Pro 充值续费', 'gemini-renewal'],
    ['ChatGPT Plus 成品号', 'chatgpt-account'], ['Claude Pro 续费', 'claude-renewal'],
  ].map(([name, slug]) => ({ name, url: `${nov22Catalog}/${slug}` }));
  const result = await loadDailyFaqSceneContext(body, sources.map(x => x.text), {
    catalogUrl: nov22Catalog, topics: ['ChatGPT', 'Gemini', 'Claude'], products, productUrls: products.map(x => x.url),
  }, { verifyDelivery: true, fetchImpl: async url => {
    const html = products.find(x => x.url === url);
    if (html) return stockPage(url, html.name);
    const detail = products.find(x => x.url.replace('/products/', '/api/v1/public/products/') === url);
    if (detail) return detail === products[0] ? Response.json({ data: { is_sold_out: true } }) : detailPage(detail.url, detail.name);
    return new Response('<main>Official feature details</main>');
  } });
  assert.equal(result.scene.topic, 'Gemini');
  assert.equal(result.scene.sourceUrl, sources[0].url);
  assert.equal(result.scene.product.url, products[1].url);
  assert.equal(result.delivery.checkedOffers, 3);
});

test('the source URL is not evidence for an API relay', async () => {
  const url = 'https://news.example/api/story';
  const item = `News Title: Claude 网页端读长文\nUrl: ${url}\nContent Summary: 读原文，不使用 API。`;
  const native = { name: 'Claude Pro 续费', url: nov22Catalog + '/claude-native' };
  const relay = { name: 'Claude API 中转', url: nov22Catalog + '/claude-relay' };
  const result = await loadDailyFaqSceneContext(`[Claude 读长文](${url})`, [item], {
    catalogUrl: nov22Catalog, topics: ['Claude'], products: [relay, native], productUrls: [relay.url, native.url],
  }, { verifyDelivery: true, fetchImpl: async where => {
    if (where === native.url) return stockPage(native.url, native.name);
    if (where === native.url.replace('/products/', '/api/v1/public/products/')) return detailPage(native.url, native.name);
    return new Response(null, { status: 404 });
  }});
  assert.equal(result.scene.product.url, native.url);
});

test('a multi-news summary does not transfer another product’s coding or enterprise terms into a cited Gemini FAQ', async () => {
  const url = 'https://news.example/nov24';
  const item = `News Title: Gemini 提供 GIF；另一家上线 Coding Plan\nUrl: ${url}\nContent Summary: Gemini 新增 GIF。另一家发布 Enterprise API。`;
  const heading = '**Gemini 的 GIF 生成功能，免费用户能用吗？**';
  const markdown = `## 今日焦点\n\n[报道的 GIF 功能](${url})。\n\n## 相关问题\n\n${heading}\n\n[这条报道](${url})提到各地逐步开放，不能拿购买会员替代地区条件。`;
  const native = { name: 'Gemini Pro 成品号', url: nov22Catalog + '/gemini-native' };
  const relay = { name: 'Gemini API 中转', url: nov22Catalog + '/gemini-relay' };
  const result = await loadDailyFaqSceneContext(markdown, [item], {
    catalogUrl: nov22Catalog, topics: ['Gemini'], products: [relay, native], productUrls: [relay.url, native.url],
  }, { verifyDelivery: true, fetchImpl: async where => {
    if (where === native.url) return stockPage(native.url, native.name);
    if (where === native.url.replace('/products/', '/api/v1/public/products/')) return detailPage(native.url, native.name);
    return new Response(null, { status: 404 });
  }});
  assert.equal(result.scene.product.url, native.url);
  assert.ok(result.delivery.fallback.includes(heading));
  assert.match(result.delivery.fallback, /购买不改变地区限制或开放进度/);
});

test('optional fetch, model, invalid-output and deadline failures leave the ready article unchanged', async () => {
  const ready = article + oldFaq + footer;
  for (const overrides of [
    {loadDailyFaqSceneContext: async () => {throw new Error('offline');}},
    {generateContentWithTransportFallback: async () => {throw new Error('model offline');}},
    {generateContentWithTransportFallback: async () => '请确认之后再写'},
    {generateContentWithTransportFallback: () => new Promise(() => {}),
      withDailyFaqDeadline: (task) => withDailyFaqDeadline(task, 5)},
  ]) assert.equal((await runOptional(overrides)(ready)).markdown, ready);
});

test('answer-only generation is accepted and deterministic delivery adds the product afterward', async () => {
  const answer = `## **❓ 相关问题**\n\n### Claude 改代码为什么还要重新交代？\n\n**会员和工作方法是两回事。** 今天的[技能库](${sourceUrl})把反复交代的步骤整理成文件。先拿一个小任务跑通，再保留适合自己的规则，不需要每次把项目要求重新说一遍。用之前确认文件确实来自原项目，并把不适合自己的规则删掉。`;
  const normalized = normalizeStandaloneDailyFaqSection(answer, sourceUrl, sourceText, 'Claude', context);
  assert.equal(normalized, answer);
  const shop = { ...context, products: [context.scene.product] };
  const linked = await ensureDailyFaqProductLinks(article + normalized + '\n\n' + footer, shop);
  assert.equal(linked.links.length, 1);
  assert.ok(linked.markdown.includes(context.scene.product.url));
});

test('the actual final FAQ step adds the matching delivery even when optional model rewriting fails', async () => {
  const ready = article + raw.replace(/\[爱窝啦·AI账号店[^\]]+\]\(AIVORA_PRODUCT_URL\)/, '续费入口') + '\n\n' + footer;
  const shop = { ...context, products: [context.scene.product] };
  for (const generateContentWithTransportFallback of [
    async () => { throw Error('model offline'); },
    async () => '不合格的模型结果',
    () => new Promise(() => {}),
  ]) {
    const result = await runOptional({ generateContentWithTransportFallback, loadDailyFaqSceneContext: async () => shop,
      withDailyFaqDeadline: task => withDailyFaqDeadline(task, 20),
      ensureDailyFaqProductLinks: (markdown, ctx) => ensureDailyFaqProductLinks(markdown, ctx, { fetchImpl: async url => ({ok:true,
        text: async () => `<link rel="canonical" href="${url}"><h1>Claude Pro 充值续费</h1>`}) }),
    })(ready, shop);
    assert.ok(result.markdown.startsWith(article));
    assert.equal(result.markdown.slice(-footer.length), footer);
    assert.ok(result.markdown.includes(context.scene.product.url), JSON.stringify(result));
    assert.equal(result.debug.dailyFaqProductLinks.length, 1);
  }
});

test('optional model failure preserves the already-read product history for final FAQ delivery', async () => {
  const ready = article + raw.replace(/\[爱窝啦·AI账号店[^\]]+\]\(AIVORA_PRODUCT_URL\)/, '续费入口') + '\n\n' + footer;
  const shop = { ...context, products: [context.scene.product] };
  const used = [{ productUrls: [context.scene.product.url] }];
  for (const generateContentWithTransportFallback of [
    async () => { throw Error('model offline'); },
    () => new Promise(() => {}),
  ]) {
    const result = await runOptional({ generateContentWithTransportFallback,
      loadRecentDailyFaqs: async () => used,
      loadDailyFaqSceneContext: async (_markdown, _items, ctx) => ({ ...shop, recentFaqs: ctx.recentFaqs }),
      withDailyFaqDeadline: task => withDailyFaqDeadline(task, 20),
      ensureDailyFaqProductLinks: (markdown, ctx) => {
        assert.equal(ctx.recentFaqs, used);
        return ensureDailyFaqProductLinks(markdown, ctx, { fetchImpl: async () => { throw Error('Used product must not be fetched'); } });
      },
    })(ready, shop);
    assert.equal(result.markdown, ready);
    assert.equal(result.debug.dailyFaqProductLinks?.length, 0);
  }
});

test('offer-check timeout still de-duplicates a repeated original FAQ using the verified history', async () => {
  const repeated = `## 相关问题\n\n### Claude Code 怎么配置技能？\n\n[开始使用](${sourceUrl})。\n\n`;
  const result = await runOptional({
    loadRecentDailyFaqs: async () => [{ question: 'Claude Code 技能能用吗？', sourceUrls: [sourceUrl] }],
    loadDailyFaqSceneContext: () => new Promise(() => {}),
    withDailyFaqDeadline: task => withDailyFaqDeadline(task, 20),
    generateContentWithTransportFallback: async () => assert.fail('An offer-check timeout must not call a model'),
  })(article + repeated + footer, { ...context, scene: undefined });
  assert.equal(result.debug.dailyFaqHistoryStatus, 'verified');
  assert.equal(result.debug.dailyFaqFailedStage, 'offer-checks');
  assert.equal(result.debug.dailyFaqProductLinkSkipped[0].reason, 'repeated-faq');
  assert.equal(result.markdown, article + footer);
});

const editorialRepo = 'https://github.com/example/cli-bridge';
const editorialReport = [
  '## **今日焦点 TOP 10**', '', '### 1. 一款应用宣布调整维护方式', '',
  '据[本次更新](https://example.org/update)，该应用支持把外部插件迁移到独立接口。', '',
  '## **⌘ 开源 TOP 项目**', '', '### example/cli-bridge：把命令行工具接给 Agent', '',
  `**项目提供一套接口，把已有命令行工具交给 Agent 调用。** [项目地址](${editorialRepo})里给出了接口和用法。`, '',
].join('\n');

test('a missing commercial scene still publishes a sourced FAQ without a model or extra fetch', async () => {
  const noRequest = () => assert.fail('Editorial fallback must not make a remote request');
  const result = await runOptional({
    loadDailyFaqSceneContext,
    ensureDailyFaqProductLinks: (markdown, ctx) => ensureDailyFaqProductLinks(markdown, ctx, { fetchImpl: noRequest }),
    generateContentWithTransportFallback: noRequest,
  })(editorialReport, { catalogUrl: nov22Catalog, topics: ['Gemini'] });
  const faq = result.markdown.match(DAILY_FAQ_SECTION)?.[0];
  assert.match(faq, /cli-bridge 适合拿来做什么/);
  assert.ok(faq.includes(editorialRepo));
  assert.match(faq, /把已有命令行工具交给 Agent 调用/);
  assert.doesNotMatch(faq, /aivora\.cn/);
  assert.equal(result.markdown.replace(DAILY_FAQ_SECTION, '').trimEnd(), editorialReport.trimEnd());
  assert.equal(result.debug.dailyFaqSeparateGenerationAttempted, false);
  assert.equal(result.debug.dailyFaqProductLinkSkipped[0].reason, 'no-fresh-published-source');
  assert.equal(result.debug.dailyFaqUsedSourceFallback, true);
});

test('an already published question is replaced only using another cited item', async () => {
  const history = [{ question: 'cli-bridge 适合拿来做什么？', sourceUrls: [editorialRepo] }];
  const raw = editorialReport + `\n## 相关问题\n\n### cli-bridge 适合拿来做什么？\n\n[项目地址](${editorialRepo})。\n`;
  const result = await ensureDailyFaqProductLinks(raw, { delivery: { reason: 'no-fresh-published-source' }, recentFaqs: history });
  const faq = result.markdown.match(DAILY_FAQ_SECTION)?.[0];
  assert.ok(faq.includes('https://example.org/update'));
  assert.ok(!faq.includes(editorialRepo));
  assert.match(faq, /把外部插件迁移到独立接口/);
  assert.equal(result.skipped[0].reason, 'repeated-faq');
  assert.equal(result.markdown.replace(DAILY_FAQ_SECTION, '').trimEnd(), editorialReport.trimEnd());
});

test('a healthy FAQ is preserved and no FAQ is invented from an uncited or store-only item', async () => {
  const delivery = { delivery: { reason: 'verified-catalog-unavailable' } };
  const valid = editorialReport + `\n## 相关问题\n\n### 如何核对工具能不能接？\n\n按[项目说明](${editorialRepo})列出的接口先试一个小任务。\n`;
  assert.equal((await ensureDailyFaqProductLinks(valid, delivery)).markdown, valid);
  const weak = '## 今日焦点 TOP 10\n\n### 1. 新工具发布\n\n**连上已有工具前，需要先确认输入和输出格式。** ' +
    '[店铺](https://www.aivora.cn/products/missing) [坏链接](https://bad%zz.test/)';
  assert.equal((await ensureDailyFaqProductLinks(weak, delivery)).markdown, weak);
});

test('a repository answer uses the titled repository and excludes known subpaths', async () => {
  const oneProject = `## 开源 TOP 项目\n\n### example/cli-bridge：把命令行工具接给 Agent\n\n[依赖]` +
    `(${editorialRepo}/blob/main/README.md)。项目提供一套接口，把已有命令行工具交给 Agent 调用。 [仓库](${editorialRepo})。`;
  const delivery = { delivery: { reason: 'no-fresh-published-source' } };
  const chosen = await ensureDailyFaqProductLinks(oneProject, delivery);
  const faq = chosen.markdown.match(DAILY_FAQ_SECTION)?.[0];
  assert.match(faq, /cli-bridge 适合拿来做什么/);
  assert.ok(faq.includes(editorialRepo));
  assert.doesNotMatch(faq, /blob\/main/);
  const known = [{ question: '这个命令行插件是什么？', sourceUrls: ['https://github.com/Example/CLI-Bridge/blob/main/README.md'] }];
  assert.equal((await ensureDailyFaqProductLinks(oneProject, { ...delivery, recentFaqs: known })).markdown, oneProject);
  const mismatched = oneProject.replace(` [仓库](${editorialRepo})。`, '');
  assert.equal((await ensureDailyFaqProductLinks(mismatched, delivery)).markdown, mismatched);
});

test('a dependency capability cannot become the FAQ for the titled repository', async () => {
  const dependencies = `## 开源 TOP 项目\n\n### example/cli-bridge：命令行桥接\n\n` +
    `[SDK](https://github.com/example/sdk) 支持批量并发运行多个进程。 [项目仓库](${editorialRepo})。`;
  const result = await ensureDailyFaqProductLinks(dependencies, { delivery: { reason: 'no-fresh-published-source' } });
  assert.equal(result.markdown, dependencies);
});

test('different URLs do not permit the same tool and FAQ theme', async () => {
  const article = '## 开源 TOP 项目\n\n### example/claude-bridge：Claude 编程工作流\n\n' +
    '**该项目提供一套可复用的 Claude 工作流。** [仓库](https://github.com/example/claude-bridge)。';
  const result = await ensureDailyFaqProductLinks(article, {
    delivery: { reason: 'no-fresh-published-source' },
    recentFaqs: [{ topic: 'Claude', theme: 'workflow', question: 'Claude 工作流从哪里开始？', sourceUrls: ['https://example.org/other'] }],
  });
  assert.equal(result.markdown, article);
});

test('the seven-day topic check includes every tool in both current and published questions', async () => {
  const delivery = { delivery: { reason: 'no-fresh-published-source' } };
  const article = '## 开源 TOP 项目\n\n### example/toolkit：Claude 与 ChatGPT 工作流\n\n' +
    '该项目支持把 Claude 工作流的提示词导出到 ChatGPT。 [仓库](https://github.com/example/toolkit)。';
  const different = '## 开源 TOP 项目\n\n### example/bridge：Claude 工作流迁移工具\n\n' +
    '该项目支持把 Claude 工作流的指令复制到另一台电脑。 [仓库](https://github.com/example/bridge)。';
  const fresh = await ensureDailyFaqProductLinks(article, delivery);
  const question = fresh.markdown.match(DAILY_FAQ_SECTION)?.[0].match(/^### (.+)$/m)?.[1];
  assert.ok(question?.includes('Claude') && question.includes('ChatGPT') && question.includes('工作流'));
  const histories = [
    [article, { topic: 'Claude', question: 'Claude 工作流从哪里开始？' }],
    [different, { topic: 'ChatGPT', question }],
  ];
  for (const [draft, entry] of histories) {
    const result = await ensureDailyFaqProductLinks(draft, { ...delivery, recentFaqs: [{ ...entry, theme: 'workflow' }] });
    assert.equal(result.markdown, draft);
  }
});

test('fallback skips boilerplate answers, unsupported clauses, and ambiguous headline citations', async () => {
  const delivery = { delivery: { reason: 'no-fresh-published-source' } };
  const head = '## 今日焦点 TOP 10\n\n### 1. 一个前端工具发布新版\n\n';
  const ambiguous = head + '据[原文](https://example.org/one)，新版支持将插件迁到接口。 [另一出处](https://example.org/two)。';
  const detached = head + '新版支持将插件迁到新的独立接口。 详情请看[原文](https://example.org/more)。';
  const moreReading = head + '据[发布方](https://example.org/press)，本次发布提供了更多资料供读者查阅。';
  const empty = '## 开源 TOP 项目\n\n### example/cli-bridge：把命令行工具接给 Agent\n\n' +
    `请看发布方说明，细节以[项目仓库](${editorialRepo})为准。`;
  for (const text of [ambiguous, detached, moreReading, empty]) {
    assert.equal((await ensureDailyFaqProductLinks(text, delivery)).markdown, text);
  }
});

test('published FAQ history excludes today, survives month rollover and treats failures as optional', async () => {
  let stored;
  const kv = {get: async () => stored, put: async (_key, value) => {stored = value;}};
  await rememberPublishedDailyFaq(kv, '2026-09-30', article + oldFaq);
  await rememberPublishedDailyFaq(kv, '2026-10-03', article + raw);
  assert.equal((await loadRecentDailyFaqs(kv, '2026-10-03')).length, 1);
  const history = await loadRecentDailyFaqs(kv, '2026-10-04');
  assert.equal(history.length, 2);
  assert.equal(history[1].theme, 'workflow');
  assert.equal(isRepeatedDailyFaq('Claude 会员如何用 Skill 少交代几遍？', 'Claude', history), true);
  assert.equal(isRepeatedDailyFaq('Claude 会员到期了怎么续费？', 'Claude', history), false);
  assert.equal((await loadRecentDailyFaqs(kv, '2026-10-12')).length, 0);
  assert.deepEqual(await loadRecentDailyFaqs({get: async () => {throw new Error('offline');}}, '2026-10-04'), []);
  await assert.doesNotReject(rememberPublishedDailyFaq({get: async () => {throw new Error('offline');}}, '2026-10-04', article + raw));
});

test('recent FAQ questions guide generation and the same problem cannot pass by changing its title', () => {
  const recentFaqs = [{date:'2026-10-02', question:'Claude 会员如何装 Skill？', topic:'Claude', theme:'workflow'}];
  const sceneContext = {...context, recentFaqs};
  assert.match(buildStandaloneDailyFaqPromptInput('2026-10-03', article, [sourceText], sceneContext).prompt, /2026-10-02：Claude 会员如何装 Skill/);
  assert.equal(normalizeStandaloneDailyFaqSection(raw, sourceUrl, sourceText, 'Claude', sceneContext), '');
});

test('successful optional runtime changes only FAQ and a late timed-out result cannot mutate publication', async () => {
  const ready = article + oldFaq + footer;
  const result = await runOptional()(ready);
  assert.equal(result.debug.dailyFaqSeparateGenerationInserted, true);
  assert.ok(result.markdown.startsWith(article));
  assert.ok(result.markdown.endsWith(footer));
  let finish;
  const late = await runOptional({
    generateContentWithTransportFallback: () => new Promise((resolve) => {finish = resolve;}),
    withDailyFaqDeadline: (task) => withDailyFaqDeadline(task, 5),
  })(ready);
  finish(raw);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(late.markdown, ready);
  assert.equal(late.debug.dailyFaqSeparateGenerationInserted, undefined);
});

test('published FAQ history records only canonical shop product links and preserves old records', async () => {
  let stored = JSON.stringify([{date:'2026-11-02',question:'旧问题？',topic:'Claude'}]);
  const kv = {get:async () => stored,put:async (_key,value) => {stored=value;}};
  const section = raw.replace('AIVORA_PRODUCT_URL', context.scene.product.url);
  await rememberPublishedDailyFaq(kv, '2026-11-04', article + section);
  const history = await loadRecentDailyFaqs(kv, '2026-11-05');
  assert.equal(history.length, 2);
  assert.deepEqual(history[1].productUrls, [context.scene.product.url]);
  assert.equal(history[0].question, '旧问题？');
  assert.equal(history[0].productUrls, undefined);
});

test('a Codex scene accepts its verified subscription name in the question without changing the delivery', async () => {
  const url = 'https://example.org/codex';
  const product = {name:'ChatGPT Plus 充值续费',url:'https://www.aivora.cn/products/plus-renewal'};
  const ctx = {catalogUrl:context.catalogUrl,topics:['ChatGPT','Codex'],sourceText:`News Title: Codex 原型\nUrl: ${url}`,
    products:[{name:'ChatGPT Plus 成品号',url:'https://www.aivora.cn/products/plus-account'},product],
    scene:{topic:'Codex',sourceUrl:url,sourceText:'Codex 原型实验',product,official:{url:'https://learn.chatgpt.com/docs/pricing',text:'ChatGPT Plus includes Codex.'}}};
  const draft=`## **❓ 相关问题**\n\n### 想用 ChatGPT 辅助做语音小工具，怎么起步？\n\n**可以先从一个软件小功能试起。** [原型实验](${url})让 AI 参与软件设计，制造仍需多轮人工审核。已有可用账号、想继续试这些小任务，正要续费的可以看看[爱窝啦·AI账号店的 ChatGPT Plus 充值续费](AIVORA_PRODUCT_URL)。`;
  const normalized=normalizeStandaloneDailyFaqSection(draft,url,ctx.scene.sourceText,'Codex',ctx);
  assert.ok(normalized);
  const article=`## 新闻\n\n[Codex 原型](${url})\n\n`;
  const final=await ensureDailyFaqProductLinks(finalizeDailyShopFaq(article+normalized,ctx),ctx,
    {fetchImpl:async()=>{throw Error('already verified');}});
  assert.equal(final.links[0].url,product.url);
  assert.equal(final.requests,0);
  assert.doesNotMatch(final.markdown,/plus-account/);
  assert.equal(normalizeStandaloneDailyFaqSection(draft.replace('想用 ChatGPT','想用 Gemini'),url,ctx.scene.sourceText,'Codex',ctx),'');
});
