import test from 'node:test';
import assert from 'node:assert/strict';
import * as faq from '../src/dailyShopFaq.js';

const source = 'https://x.com/GeminiApp/status/123';
const productUrl = 'https://www.aivora.cn/products/gemini-account';
const catalogUrl = 'https://www.aivora.cn/products';
const name = 'Gemini Pro 成品号年卡';
const news = `## 新闻\r\n\r\n[Gemini 导出 Sites](${source})\r\n\r\n![原图](https://example.org/photo.png)\r\n\r\n`;
const footer = '\r\n\r\n## 页脚\r\n\r\n保持不变。\r\n';
const question = `## **❓ 相关问题**\r\n\r\n**Gemini 导出网站需要什么账号？**\r\n\r\n[官方演示](${source})展示了从 Gemini 导出 Sites 草稿的流程。`;
const context = { catalogUrl, topics: ['Gemini', 'ChatGPT'], sourceText: `News Title: Gemini\nUrl: ${source}`,
  products: [{ name: 'ChatGPT Plus 成品号', url: `${catalogUrl}/chatgpt-account` }, { name, url: productUrl }] };
const okFetch = async url => ({ ok: true, text: async () => `<link rel="canonical" href="${url}"><h1>${name}</h1>` });

test('today-style Gemini FAQ gets a real product even when the model omitted its link', async () => {
  const result = await faq.ensureDailyFaqProductLinks(news + question + footer, context, { fetchImpl: okFetch });
  assert.ok(result.markdown.startsWith(news));
  assert.ok(result.markdown.endsWith(footer));
  assert.match(result.markdown, /### Gemini 导出网站需要什么账号？/);
  assert.ok(result.markdown.includes(`[爱窝啦·AI账号店的 ${name}](${productUrl})`));
  assert.equal(result.links[0].topic, 'Gemini');
  assert.equal(result.requests, 1);
});

test('product links are idempotent and never copied from another topic or guessed SKU', async () => {
  const wrong = question + `\r\n\r\n相关商品：[猜测商品](${catalogUrl}/invented)。`;
  const first = await faq.ensureDailyFaqProductLinks(news + wrong + footer, context, { fetchImpl: okFetch });
  const second = await faq.ensureDailyFaqProductLinks(first.markdown, context, { fetchImpl: okFetch });
  assert.equal(second.markdown, first.markdown);
  assert.equal((second.markdown.match(/\]\(https:\/\/www\.aivora\.cn\/products\//g) || []).length, 1);
  assert.doesNotMatch(second.markdown, /invented|chatgpt-account/);
});

test('missing catalog, unrelated questions and unsupported source links cannot add a recommendation', async () => {
  for (const [markdown, shop] of [
    [news + question, {}],
    [news + question.replace('Gemini 导出网站需要什么账号', '这个开源项目是什么'), context],
    [news + question.replace(source, 'https://example.org/unknown'), context],
  ]) {
    let calls = 0;
    const result = await faq.ensureDailyFaqProductLinks(markdown, shop, { fetchImpl: async () => { calls++; throw Error('must not fetch'); } });
    assert.equal(result.markdown, markdown);
    assert.equal(calls, 0);
  }
});

test('HTTP failures, wrong canonical and wrong product title preserve the ready news', async () => {
  for (const fetchImpl of [
    async () => { throw Error('offline'); },
    async () => ({ ok: false, status: 404 }),
    async () => ({ ok: true, text: async () => `<link rel="canonical" href="https://example.org"><h1>${name}</h1>` }),
    async () => ({ ok: true, text: async () => `<link rel="canonical" href="${productUrl}"><h1>ChatGPT Plus</h1>` }),
  ]) {
    const original = news + question + footer;
    const result = await faq.ensureDailyFaqProductLinks(original, context, { fetchImpl });
    assert.equal(result.markdown, original);
    assert.equal(result.links.length, 0);
  }
});

test('a verified current scene product can be reused without another network request', async () => {
  const shop = { ...context, scene: { topic: 'Gemini', product: { name, url: productUrl } } };
  const result = await faq.ensureDailyFaqProductLinks(news + question, shop,
    { fetchImpl: async () => { throw Error('already verified'); } });
  assert.equal(result.requests, 0);
  assert.equal(result.links[0].url, productUrl);
});

test('ChatGPT gets its matching Plus product, never a Gemini entry', async () => {
  const body = (news + question).replaceAll('Gemini', 'ChatGPT');
  const result = await faq.ensureDailyFaqProductLinks(body, { ...context, sourceText: context.sourceText.replaceAll('Gemini', 'ChatGPT') }, { fetchImpl: async url => ({ ok: true,
    text: async () => `<link rel="canonical" href="${url}"><h1>ChatGPT Plus 成品号</h1>` }) });
  assert.equal(result.links[0].url, `${catalogUrl}/chatgpt-account`);
});

test('separate questions match separate source records and keep at most two product entries', async () => {
  const chatSource = 'https://openai.com/index/chatgpt/';
  const body = news + `[ChatGPT](${chatSource})\n\n` + question +
    `\n\n### ChatGPT 适合用什么账号？\n\n[ChatGPT 官方说明](${chatSource})介绍了新功能。` + footer;
  const shop = { ...context, sourceText: `${context.sourceText}\nUrl: ${chatSource}`,
    sourceItems: [context.sourceText, `News Title: ChatGPT\nUrl: ${chatSource}`] };
  const result = await faq.ensureDailyFaqProductLinks(body, shop, { fetchImpl: async url => ({ok:true,
    text:async () => `<link rel="canonical" href="${url}"><h1>${url === productUrl ? name : 'ChatGPT Plus 成品号'}</h1>`}) });
  assert.deepEqual(result.links.map(link => link.topic), ['Gemini', 'ChatGPT']);
  assert.equal(result.requests, 2);
  const wrong = await faq.ensureDailyFaqProductLinks(body.replace(`[ChatGPT 官方说明](${chatSource})`, `[错误来源](${source})`), shop, {fetchImpl:okFetch});
  assert.equal(wrong.links.length, 1);
});
