import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDailyFaqProductLinks, loadDailyFaqSceneContext, formatDailyShopPromptContext } from '../src/dailyShopFaq.js';
import { buildStandaloneDailyFaqPromptInput } from '../src/dailyStandaloneFaq.js';

const catalogUrl = 'https://www.aivora.cn/products';
const sourceUrl = 'https://x.com/GoogleAI/status/2120940683233984862';
const source = `News Title: Google 推出 Gemini 4 Hydrogen 主打日常速度\nUrl: ${sourceUrl}\nHydrogen 与 Carbon 在 Antigravity 中协同工作。`;
const article = `## 今日焦点\n\n### 2. Google 推出 Gemini 4 Hydrogen\n\n[Google 的更新](${sourceUrl})介绍 Antigravity。\n\n`;
const faq = '## **❓ 相关问题**\n\n### 体验 Gemini 4 Hydrogen 需要什么账号？\n\n**Gemini 4 Hydrogen 通过 Antigravity 服务提供。** Google AI 官方推文显示，Hydrogen 被设计在 Antigravity 中与 Carbon 协同工作，日常编程和 Agent 工作流是主要场景，速度是 Gemini 3.8 Flash 的 2.5 倍。\n';
const products = [
  { name: 'Gemini Pro 成品号', url: `${catalogUrl}/gemini-native` },
  { name: 'Gemini Pro 成品号 含反重力', url: `${catalogUrl}/gemini-antigravity` },
  { name: 'Gemini Pro 充值续费', url: `${catalogUrl}/gemini-renewal` },
  { name: 'Claude/Gemini/Codex 三合一中转', url: `${catalogUrl}/multi-relay` },
];
const context = { catalogUrl, topics: ['Gemini'], candidateTopics: ['Gemini'], sourceText: source, sourceItems: [source], products };
const fetchProduct = async (url) => {
  const product = products.find(item => item.url === url);
  assert.ok(product, `Unexpected request: ${url}`);
  return { ok: true, text: async () => `<link rel="canonical" href="${url}"><h1>${product.name}</h1>` };
};

test('November 13 unlinked Hydrogen FAQ recovers its unique published source and Antigravity product', async () => {
  const result = await ensureDailyFaqProductLinks(article + faq, context, { fetchImpl: fetchProduct });
  assert.equal(result.links.length, 1);
  assert.equal(result.links[0].url, products[1].url);
  assert.match(result.markdown, /\[Google AI 官方推文\]\(https:\/\/x\.com\/GoogleAI\/status\/2120940683233984862\)/);
  assert.ok(result.markdown.startsWith(article));
  assert.match(result.markdown, /含反重力/);
  assert.doesNotMatch(result.markdown, /multi-relay/);
  assert.equal(result.requests, 1);
});

test('unlinked FAQ does not guess between two published Gemini sources or use unpublished input', async () => {
  const second = 'https://x.com/GoogleAI/status/2120940683233984863';
  const extra = `News Title: Gemini 4 Hydrogen 后续更新\nUrl: ${second}\nGemini 更新。`;
  const ambiguous = article + `[Gemini 另一项更新](${second})\n\n` + faq;
  const result = await ensureDailyFaqProductLinks(ambiguous, { ...context, sourceItems: [source, extra], sourceText: `${source}\n${extra}` },
    { fetchImpl: async () => { throw Error('Ambiguous evidence must not fetch products'); } });
  assert.equal(result.markdown, ambiguous);
  assert.equal(result.links.length, 0);
  const missing = await ensureDailyFaqProductLinks('## 新闻\n\n未引用 Gemini 原文。\n\n' + faq, context,
    { fetchImpl: async () => { throw Error('Unpublished source'); } });
  assert.equal(missing.links.length, 0);
});

test('a unique same-brand source cannot establish a different event or borrowed official attribution', async () => {
  for (const [url, title] of [
    [sourceUrl, 'Gemini 网页配色更新'],
    ['https://example.org/gemini-hydrogen', 'Gemini 4 Hydrogen 更新'],
  ]) {
    const item = `News Title: ${title}\nUrl: ${url}\n${title}`;
    const page = `## 新闻\n\n[${title}](${url})\n\n` + faq;
    const result = await ensureDailyFaqProductLinks(page, { ...context, sourceItems: [item], sourceText: item },
      { fetchImpl: async () => { throw Error('Unsupported source must not select a product'); } });
    assert.equal(result.markdown, page);
    assert.equal(result.links.length, 0);
  }
});

test('Antigravity source chooses the matching delivery before a generic Gemini account', async () => {
  const result = await loadDailyFaqSceneContext(article, [source], context, {
    fetchImpl: async url => products.some(item => item.url === url) ? fetchProduct(url) :
      { ok: true, text: async () => '<main>Google AI Pro and Antigravity</main>' },
  });
  assert.equal(result.scene.product?.url, products[1].url);
});

test('explicit Gemini API use can select a relay without treating it as a native subscription', async () => {
  const apiSource = `News Title: Gemini API 接入脚本\nUrl: ${sourceUrl}\n用 API Key 调用 Gemini 接口。`;
  const input = article + `## **❓ 相关问题**\n\n### 用 Gemini API 写脚本怎么选入口？\n\n**先确认接入方式。** [API 接入说明](${sourceUrl})介绍用密钥调用模型。\n`;
  const result = await ensureDailyFaqProductLinks(input, { ...context, sourceItems: [apiSource], sourceText: apiSource }, { fetchImpl: fetchProduct });
  assert.equal(result.links.length, 1);
  assert.equal(result.links[0].url, products[3].url);
  assert.match(result.markdown, /不是官网会员|不是原生账号/);
  assert.doesNotMatch(result.markdown, /原本就想另开一个/);
  assert.match(formatDailyShopPromptContext({ ...context, sourceText: apiSource, sourceItems: [apiSource] }), /三合一中转/);
});

test('a relay-only catalog cannot become an Antigravity account recommendation', async () => {
  const result = await ensureDailyFaqProductLinks(article + faq, { ...context, products: [products[3]] },
    { fetchImpl: async () => { throw Error('Do not fetch a mismatched relay'); } });
  assert.equal(result.links.length, 0);
});

test('denying API relay access does not reverse a native-account recommendation', async () => {
  const page = article + `## **❓ 相关问题**\n\n### Gemini 网页怎么开始用？\n\n**先选原生账号。** [本次更新](${sourceUrl})介绍使用入口，这不是 API 中转。\n`;
  const ctx = { ...context, scene: { topic: 'Gemini', product: products[0] } };
  const result = await ensureDailyFaqProductLinks(page, ctx, { fetchImpl: fetchProduct });
  assert.equal(result.links[0]?.url, products[0].url);
});

test('denying Antigravity access does not reverse an explicit API recommendation', async () => {
  const item = `News Title: Gemini API 接入\nUrl: ${sourceUrl}\n用 API Key 接入 Gemini。`;
  const page = article + `## **❓ 相关问题**\n\n### Gemini API 怎么接入？\n\n**这是 API 接入。** [本次更新](${sourceUrl})介绍接口，这不是 Antigravity。\n`;
  const result = await ensureDailyFaqProductLinks(page, { ...context, sourceItems: [item], sourceText: item }, { fetchImpl: fetchProduct });
  assert.equal(result.links[0]?.url, products[3].url);
});

test('relay writing instructions separate model access from official subscriptions', () => {
  const ctx = { ...context, scene: { topic: 'Gemini', sourceUrl, sourceText: 'Gemini API 调用', product: products[3] } };
  const input = buildStandaloneDailyFaqPromptInput('2026-11-13', article, [source], ctx);
  assert.match(input.prompt, /API.*中转|中转.*API/);
  assert.match(input.prompt, /不是.*(?:官方|官网|原生).*账号|不.*(?:解锁|等同|代替).*会员/);
  assert.match(input.prompt, /(?:模型|型号).*(?:列表|可选|实际)/);
});

test('recently published products are not reintroduced by source recovery', async () => {
  const result = await ensureDailyFaqProductLinks(article + faq, { ...context,
    recentFaqs: products.map(item => ({ productUrls: [item.url] })),
  }, { fetchImpl: async () => { throw Error('No unused product'); } });
  assert.equal(result.links.length, 0);
});

test('a plain-text FAQ question still gets its verified delivery and becomes a readable heading', async () => {
  const page = article + `## **❓ 相关问题**\n\nGemini 网页怎么开始用？\n\n**先选原生账号。** [本次更新](${sourceUrl})介绍使用入口。\n`;
  const result = await ensureDailyFaqProductLinks(page, context, { fetchImpl: fetchProduct });
  assert.equal(result.links.length, 1);
  assert.match(result.markdown, /### Gemini 网页怎么开始用？/);
  assert.ok(result.markdown.startsWith(article));
  assert.equal((await ensureDailyFaqProductLinks(result.markdown, context, { fetchImpl: fetchProduct })).markdown, result.markdown);
});

test('a soft-wrapped rhetorical question inside the answer is not a second FAQ', async () => {
  const page = article + `## **❓ 相关问题**\n\nGemini 4 Hydrogen 需要什么账号？\n\n**先看清原生入口。** [Google 官方说明](${sourceUrl})介绍 Antigravity。\n还需要另开一个 Gemini 4 Hydrogen 账号吗？\n已有账号可先检查实际可选模型。\n`;
  const result = await ensureDailyFaqProductLinks(page, context, { fetchImpl: fetchProduct });
  assert.equal(result.links.length, 1);
  assert.equal((result.markdown.match(/^### /gm) || []).length, 2); // One news title and one FAQ title.
  assert.doesNotMatch(result.markdown, /^### 还需要/m);
});

test('a versioned subject prefix does not cite a differently named model', async () => {
  const item = `News Title: Gemini 4 Hydrogen Plus 发布\nUrl: ${sourceUrl}\nGemini 4 Hydrogen Plus 用于 Antigravity。`;
  const page = `## 新闻\n\n[Gemini 4 Hydrogen Plus](${sourceUrl})\n\n` + faq;
  const result = await ensureDailyFaqProductLinks(page, { ...context, sourceItems: [item], sourceText: item },
    { fetchImpl: async () => { throw Error('Different model'); } });
  assert.equal(result.links.length, 0);
});

test('enterprise-specific features cannot recommend a personal subscription on brand alone', async () => {
  const url = 'https://example.org/chatgpt-enterprise';
  const item = `News Title: ChatGPT Enterprise 企业采购\nUrl: ${url}\nChatGPT Enterprise 通过 AWS 采购。`;
  const page = `## 新闻\n\n[ChatGPT Enterprise](${url})\n\n## **❓ 相关问题**\n\n### ChatGPT Enterprise 公司怎么采购？\n\n**先确认企业采购入口。** [企业采购公告](${url})说明了渠道变化。\n`;
  const result = await ensureDailyFaqProductLinks(page, { catalogUrl, topics: ['ChatGPT'], sourceText: item,
    sourceItems: [item], products: [{ name: 'ChatGPT Go 充值续费', url: `${catalogUrl}/chatgpt-go` }] },
  { fetchImpl: async () => { throw Error('Personal subscription is not an enterprise plan'); } });
  assert.equal(result.links.length, 0);
});

for (const [topic, name, use] of [
  ['ChatGPT', 'ChatGPT Plus 成品号', 'ChatGPT 网页写作'],
  ['Claude', 'Claude Pro 充值续费', 'Claude 文档整理'],
  ['Cursor', 'Cursor Pro+ 独享号', 'Cursor IDE 改代码'],
  ['Gemini', 'Gemini Pro 充值续费', 'Gemini 网页写作'],
  ['Codex', 'Codex API 中转', 'Codex API Key 接入脚本'],
  ['MiniMax', 'MiniMax M3 Coding Plan 中转', 'MiniMax Coding Plan 接入编程工具'],
  ['Grok', 'Grok Super 充值续费', 'Grok 网页问答'],
  ['Perplexity', 'Perplexity Pro 充值续费', 'Perplexity 网页搜索'],
]) {
  test(`${topic} matching retains the correct delivery and non-FAQ bytes`, async () => {
    const url = 'https://example.org/update';
    const productUrl = `${catalogUrl}/verified-${topic.toLowerCase()}`;
    const item = `News Title: ${use}\nUrl: ${url}\n${use}`;
    const prefix = `## 新闻\n\n[${use}](${url})\n\n`;
    const page = prefix + `## **❓ 相关问题**\n\n### ${use}怎么起步？\n\n**先选对入口。** [本次更新](${url})提供了具体使用线索。\n`;
    const result = await ensureDailyFaqProductLinks(page, { catalogUrl, topics: [topic], sourceText: item,
      sourceItems: [item], products: [{ name, url: productUrl }] }, { fetchImpl: async request => ({
      ok: true, text: async () => `<link rel="canonical" href="${request}"><h1>${name}</h1>`,
    }) });
    assert.equal(result.links.length, 1);
    assert.equal(result.links[0].url, productUrl);
    assert.ok(result.markdown.startsWith(prefix));
  });
}
