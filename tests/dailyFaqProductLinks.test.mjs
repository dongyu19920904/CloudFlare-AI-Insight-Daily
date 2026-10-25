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
  assert.doesNotMatch(first.markdown, /相关商品[：:]/);
});

test('a native recommendation stays in its original sentence without another product tail', async () => {
  const natural = question + ` 如果正准备另开一个账号，可以看看 [爱窝啦·AI账号店的 ${name}](${productUrl}) 的交付说明。`;
  const result = await faq.ensureDailyFaqProductLinks(news + natural + footer, context, { fetchImpl: okFetch });
  assert.ok(result.markdown.includes(`可以看看 [爱窝啦·AI账号店的 ${name}](${productUrl}) 的交付说明。`));
  assert.doesNotMatch(result.markdown, /相关商品[：:]|如果你原本/);
  assert.ok(result.markdown.startsWith(news));
  assert.ok(result.markdown.endsWith(footer));
});

test('legacy product lines become an inline conditional suggestion and remain idempotent', async () => {
  const legacy = question + `\r\n\r\n相关商品：[旧商品](${productUrl})。\r\n`;
  const first = await faq.ensureDailyFaqProductLinks(news + legacy + footer, context, { fetchImpl: okFetch });
  const second = await faq.ensureDailyFaqProductLinks(first.markdown, context, { fetchImpl: okFetch });
  assert.equal(first.markdown, second.markdown);
  assert.doesNotMatch(first.markdown, /相关商品[：:]|旧商品/);
  assert.ok(first.markdown.includes('流程。 如果你原本就想另开一个 Gemini 账号'));
  assert.equal(first.links.length, 1);
});

test('login trouble never turns the automatic purchase suggestion into a repair promise', async () => {
  const body = (news + question).replaceAll('Gemini', 'ChatGPT').replace('导出网站需要什么账号', '登录不进去要重买账号吗');
  const result = await faq.ensureDailyFaqProductLinks(body, { ...context, sourceText: context.sourceText.replaceAll('Gemini', 'ChatGPT') }, {
    fetchImpl: async url => ({ ok: true, text: async () => `<link rel="canonical" href="${url}"><h1>ChatGPT Plus 成品号</h1>` }),
  });
  assert.equal(result.links.length, 1);
  assert.match(result.markdown, /原本就想另开一个 ChatGPT 账号/);
  assert.match(result.markdown, /购买不能代替登录排查/);
  assert.doesNotMatch(result.markdown, /相关商品[：:]|购买.*(?:即可|就能).*登录/);
});

test('ChatGPT login scenes read official login troubleshooting instead of plan marketing', async () => {
  const url = 'https://www.v2ex.com/t/example';
  const item = `News Title: ChatGPT Apple ID 登录异常\nUrl: ${url}`;
  const requests = [];
  const result = await faq.loadDailyFaqSceneContext(`[新闻](${url})`, [item], {
    catalogUrl, topics: ['ChatGPT'], candidateTopics: ['ChatGPT'], products: [context.products[0]],
  }, { fetchImpl: async target => {
    requests.push(target);
    return {ok:true,text:async () => `<link rel="canonical" href="${target}"><h1>ChatGPT Plus 成品号</h1><p>General Troubleshooting Steps: use the original sign-in method.</p>`};
  }});
  assert.ok(requests.includes('https://help.openai.com/en/articles/7426629-why-cant-i-log-in-to-chatgpt'));
  assert.ok(!requests.includes('https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus'));
  assert.match(result.scene.official.text, /original sign-in method/);
});

test('a useful tool workflow outranks a login incident for the optional buying FAQ only', async () => {
  const fault='News Title: ChatGPT Apple ID 登录异常\nUrl: https://example.org/login';
  const workflow='News Title: Gemini 编程工作流\nUrl: https://example.org/workflow';
  const result=await faq.loadDailyFaqSceneContext('[故障](https://example.org/login) [工具](https://example.org/workflow)', [fault,workflow], {
    ...context,candidateTopics:['ChatGPT','Gemini'],
  }, {fetchImpl:okFetch});
  assert.equal(result.scene.topic,'Gemini');
  assert.equal(result.scene.sourceUrl,'https://example.org/workflow');
});

test('repository FAQs verify the project README rather than infer installation from a plan page', async () => {
  const url='https://github.com/example/design-skill';
  const item=`Project Name: Claude design skill\nUrl: ${url}`;
  const requests=[];
  const result=await faq.loadDailyFaqSceneContext(`[Claude](${url})`,[item],{
    catalogUrl,topics:['Claude'],candidateTopics:['Claude'],products:[{name:'Claude Pro 续费',url:`${catalogUrl}/claude`}],
  },{fetchImpl:async target=>{requests.push(target);return {ok:true,text:async()=>`<link rel="canonical" href="${target}"><h1>Claude Pro 续费</h1>Design skill documentation.`};}});
  assert.ok(requests.includes('https://raw.githubusercontent.com/example/design-skill/HEAD/README.md'));
  assert.equal(result.scene.official.url,'https://raw.githubusercontent.com/example/design-skill/HEAD/README.md');
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

test('an unverified SKU uses only the current verified catalog and preserves the ready news', async () => {
  for (const fetchImpl of [
    async () => { throw Error('offline'); },
    async () => ({ ok: false, status: 404 }),
    async () => ({ ok: true, text: async () => `<link rel="canonical" href="https://example.org"><h1>${name}</h1>` }),
    async () => ({ ok: true, text: async () => `<link rel="canonical" href="${productUrl}"><h1>ChatGPT Plus</h1>` }),
  ]) {
    const original = news + question + footer;
    const result = await faq.ensureDailyFaqProductLinks(original, context, { fetchImpl });
    assert.ok(result.markdown.startsWith(news));
    assert.ok(result.markdown.endsWith(footer));
    assert.equal(result.links[0].url, catalogUrl);
    assert.ok(result.markdown.includes(name));
    assert.ok(!result.markdown.includes(`](${productUrl})`));
  }
});

test('a verified current scene product can be reused without another network request', async () => {
  const shop = { ...context, scene: { topic: 'Gemini', product: { name, url: productUrl } } };
  const result = await faq.ensureDailyFaqProductLinks(news + question, shop,
    { fetchImpl: async () => { throw Error('already verified'); } });
  assert.equal(result.requests, 0);
  assert.equal(result.links[0].url, productUrl);
});

test('shop listing separators do not make the prose link read like a catalog label', async () => {
  const result = await faq.ensureDailyFaqProductLinks(news + question, context, { fetchImpl: async url => ({ok:true,
    text:async () => `<link rel="canonical" href="${url}"><h1>Gemini Pro｜成品号【年卡】</h1>`}) });
  assert.ok(result.markdown.includes('[爱窝啦·AI账号店的 Gemini Pro 成品号年卡]'));
  assert.doesNotMatch(result.markdown, /【|】|｜/);
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
