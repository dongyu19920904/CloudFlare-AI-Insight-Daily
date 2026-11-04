import test from 'node:test';
import assert from 'node:assert/strict';

import {
  finalizeDailyShopFaq,
  formatDailyShopPromptContext,
  loadDailyShopContext,
  loadDailyFaqSceneContext,
} from '../src/dailyShopFaq.js';
import { assembleDailySummaryMarkdown } from '../src/dailyMarkdownAssembly.js';
import { getSystemPromptSummarizationStepOne } from '../src/prompt/summarizationPromptStepZero.js';

const catalogUrl = 'https://www.aivora.cn/products';
const sourceUrl = 'https://openai.com/index/chatgpt-update/';
const selectedItems = [`News Title: ChatGPT 更新\nUrl: ${sourceUrl}\nContent Summary: 官方说明了功能变化。`];
const sitemap = `<urlset><url><loc>${catalogUrl}</loc></url><url><loc>${catalogUrl}/chatgpt-pro-20x-account-monthly</loc></url></urlset>`;

test('main system FAQ requires relevant recommendations even when optional rewriting cannot finish', () => {
  const prompt = getSystemPromptSummarizationStepOne('2026-10-22');
  const faq = prompt.split('## **❓ 相关问题**')[1].split('## 输出前自检')[0];
  assert.match(faq, /每条问答.*相关商品/);
  assert.match(faq, /免费.*付费/);
  assert.doesNotMatch(faq, /优先使用[^\n]*国内怎么用|才可在回答末尾/);
});

function fakeFetch(url) {
  if (url.endsWith('/sitemap.xml')) {
    return Promise.resolve({ ok: true, text: async () => sitemap });
  }
  return Promise.resolve({
    ok: true,
    text: async () => `<link rel="canonical" href="${catalogUrl}">`,
  });
}

test('daily shop context only exposes a sitemap-listed canonical catalog and relevant topic', async () => {
  const context = await loadDailyShopContext(selectedItems, { fetchImpl: fakeFetch });

  assert.equal(context.catalogUrl, catalogUrl);
  assert.deepEqual(context.topics, ['ChatGPT']);
  assert.deepEqual(context.candidateTopics, ['ChatGPT']);
  assert.match(formatDailyShopPromptContext(context), /ChatGPT/);
  assert.match(formatDailyShopPromptContext(context), /不证明库存或新闻中的新功能属于任一套餐/);
  assert.doesNotMatch(formatDailyShopPromptContext(context), /chatgpt-pro-20x-account-monthly/);
});

test('daily shop context fails closed without blocking generation', async () => {
  const failed = await loadDailyShopContext(selectedItems, {
    fetchImpl: async () => { throw new Error('offline'); },
  });
  const invalidCanonical = await loadDailyShopContext(selectedItems, {
    fetchImpl: async (url) => url.endsWith('/sitemap.xml')
      ? { ok: true, text: async () => sitemap }
      : { ok: true, text: async () => '<link rel="canonical" href="https://other.example/products">' },
  });
  const unrelated = await loadDailyShopContext(['News Title: 机器人硬件'], { fetchImpl: fakeFetch });

  assert.equal(failed.catalogUrl, '');
  assert.equal(invalidCanonical.catalogUrl, '');
  assert.equal(unrelated.catalogUrl, '');
  assert.deepEqual(unrelated.candidateTopics, []);
  assert.equal(formatDailyShopPromptContext(failed), '');
});

test('ChatGPT Chinese SKU names reach the main FAQ prompt, not only the optional rewrite', async () => {
  const productUrl = `${catalogUrl}/cheng-pin-hao-yue-ka`;
  const context = await loadDailyShopContext(selectedItems, { fetchImpl: async (url) => ({ ok: true,
    text: async () => url.endsWith('/sitemap.xml')
      ? `<urlset><url><loc>${catalogUrl}</loc></url><url><loc>${productUrl}</loc></url></urlset>`
      : `<link rel="canonical" href="${catalogUrl}"><a href="${productUrl}">ChatGPT Plus 成品号</a>`,
  }) });
  assert.deepEqual(context.topics, ['ChatGPT']);
  assert.match(formatDailyShopPromptContext(context), /ChatGPT Plus 成品号/);
  assert.match(formatDailyShopPromptContext(context), /每条相关问题/);
  assert.doesNotMatch(formatDailyShopPromptContext(context), /否则省略 FAQ/);
});

test('a source-backed usage question keeps its related shop link without purchase words', () => {
  const body = `## 新闻\n\n[ChatGPT 聊天锁](${sourceUrl})正在推送。\n\n## **❓ 相关问题**\n\n### ChatGPT 锁定聊天怎么用？\n\n[ChatGPT 聊天锁](${sourceUrl})也向免费用户开放。经常写稿的读者可看[爱窝啦·AI账号店的 ChatGPT 商品](${catalogUrl})。`;
  const result = finalizeDailyShopFaq(body, {catalogUrl, topics:['ChatGPT'], sourceText:`Url: ${sourceUrl}`});
  assert.match(result, /\]\(https:\/\/www.aivora.cn\/products\)/);
  assert.equal(result.split('## **❓ 相关问题**')[0], body.split('## **❓ 相关问题**')[0]);
});

test('ChatGPT news takes priority over a Claude workflow and selects a normal Plus account', async () => {
  const claude = 'https://github.com/example/skills';
  const plus = `${catalogUrl}/plus-account`;
  const context = await loadDailyFaqSceneContext(`[Claude 技能](${claude})\n[ChatGPT 更新](${sourceUrl})`, [
    `Project Name: skills\nUrl: ${claude}\nDescription: Claude Code 工作流`,
    `News Title: ChatGPT 聊天锁\nUrl: ${sourceUrl}\nContent Summary: ChatGPT 免费和付费用户逐步开放`,
  ], {catalogUrl, topics:['ChatGPT','Claude'], products:[
    {name:'ChatGPT Pro 充值续费',url:`${catalogUrl}/pro-renewal`},
    {name:'ChatGPT Plus 成品号',url:plus},
    {name:'Claude Pro 充值续费',url:`${catalogUrl}/claude-renewal`},
  ]}, {fetchImpl:async url => ({ok:true,text:async () => url===plus
    ? `<link rel="canonical" href="${plus}"><h1>ChatGPT Plus 成品号</h1>`
    : '<h1>What is ChatGPT Plus?</h1><p>A subscription plan.</p>'})});
  assert.equal(context.scene.topic, 'ChatGPT');
  assert.equal(context.scene.product.url, plus);
});

test('a sourced FAQ drops guessed SKUs without appending a fixed advertising paragraph', async () => {
  const context = await loadDailyShopContext(selectedItems, { fetchImpl: fakeFetch });
  const body = `## **🔥 今日焦点 TOP 1**

### 1. ChatGPT 更新了一个使用入口

[OpenAI 官方说明列出新入口](${sourceUrl})。

## **❓ 相关问题**

### ChatGPT 更新后，购买订阅前先看什么？

[OpenAI 官方说明列出功能边界](${sourceUrl})。先核对功能开放范围，不要把新闻更新当作每个套餐都支持。

可查看 [爱窝啦 Aivora](https://www.aivora.cn/products/fake-sku) 并核对当前商品。`;
  const assembled = assembleDailySummaryMarkdown(body, '今天有一项 ChatGPT 更新。', {
    INSERT_AD: 'false', INSERT_FOOT: 'false',
  });
  const result = finalizeDailyShopFaq(assembled, context);

  assert.equal((result.match(/https:\/\/www\.aivora\.cn/g) || []).length, 0);
  assert.doesNotMatch(result, /准备比较当前公开/);
  assert.doesNotMatch(result, /fake-sku|统一体验|https:\/\/www\.aivora\.cn\/\)/);
  assert.match(result, /官方说明列出功能边界/);
});

test('missing, unrelated or unsupported FAQ does not add a shop link', async () => {
  const context = await loadDailyShopContext(selectedItems, { fetchImpl: fakeFetch });
  const article = `## **🔥 今日焦点 TOP 1**\n\n### 1. ChatGPT 更新入口\n\n[官方说明](${sourceUrl})。`;
  const unrelatedFaq = `${article}\n\n## **❓ 相关问题**\n\n### Grok 更新后该买什么？\n\n[官方说明](${sourceUrl})。`;
  const inventedSource = `${article}\n\n## **❓ 相关问题**\n\n### ChatGPT 更新后该买什么？\n\n[编造的来源](https://example.com/never-in-input)。`;

  for (const markdown of [article, unrelatedFaq, inventedSource]) {
    assert.doesNotMatch(finalizeDailyShopFaq(markdown, context), /aivora\.cn/);
  }
  assert.equal(finalizeDailyShopFaq(article, context), article);
  assert.doesNotMatch(finalizeDailyShopFaq(unrelatedFaq, { ...context, catalogUrl: '' }), /aivora\.cn/);
});

test('an open-source tool FAQ is not turned into an account shop pitch', () => {
  const repoUrl = 'https://github.com/mvschwarz/openrig';
  const body = `## **🔥 今日焦点 TOP 1**\n\n### 1. Claude 工具开源\n\n[项目仓库](${repoUrl})。\n\n## **❓ 相关问题**\n\n### Claude 工具如何开始测试？\n\n[项目仓库](${repoUrl}) 提供使用说明。`;
  const result = finalizeDailyShopFaq(body, {
    catalogUrl, topics: ['Claude'], sourceText: `Url: ${repoUrl}`,
  });
  assert.doesNotMatch(result, /aivora\.cn/);
});

test('a verified Gemini topic replaces an unrelated repo FAQ with a sourced buyer FAQ', () => {
  const geminiUrl = 'https://x.com/GeminiApp/status/2104660668859453637';
  const context = {
    catalogUrl,
    topics: ['Gemini'],
    sourceText: `News Title: Gemini App 更新\nUrl: ${geminiUrl}`,
  };
  const article = `## **🔥 今日焦点 TOP 1**\n\n### 1. Gemini App 更新\n\n[Gemini 官方演示](${geminiUrl})展示新功能。`;
  const unrelated = `${article}\n\n## **❓ 相关问题**\n\n### up 是什么项目？\n\n[up 仓库](https://github.com/byoungd/up)收集学习资料。`;
  assert.equal(finalizeDailyShopFaq(unrelated, context), unrelated);

  const buyerFaq = `${article}\n\n## **❓ 相关问题**\n\n### Gemini 新功能，购买订阅前要确认什么？\n\n[Gemini 官方演示](${geminiUrl})展示了功能，不能据此保证所有套餐可用。可查看[爱窝啦·AI账号店的商品目录](${catalogUrl})。`;
  const result = finalizeDailyShopFaq(buyerFaq, context);
  assert.equal((result.match(/https:\/\/www\.aivora\.cn/g) || []).length, 1);
  assert.match(result, /\[爱窝啦·AI账号店的商品目录\]\(https:\/\/www\.aivora\.cn\/products\)/);
});

test('catalog names identify Chinese SKU slugs without changing the main prompt', async () => {
  const url = `${catalogUrl}/chong-zhi-xu-fei-yue-ka-2`;
  const context = await loadDailyShopContext(['News Title: Claude Code 技能库\nUrl: https://github.com/example/skills'], {
    fetchImpl: async (target) => ({ ok: true, text: async () => target.endsWith('sitemap.xml')
      ? `<urlset><url><loc>${catalogUrl}</loc></url><url><loc>${catalogUrl}/claude-relay</loc></url><url><loc>${url}</loc></url></urlset>`
      : `<link rel="canonical" href="${catalogUrl}"><a href="/products/chong-zhi-xu-fei-yue-ka-2">Claude Pro｜充值续费（月卡）</a>` }),
  });
  assert.deepEqual(context.products, [{ url, name: 'Claude Pro｜充值续费（月卡）' }]);
  assert.doesNotMatch(formatDailyShopPromptContext(context), /chong-zhi/);
});

test('FAQ enrichment verifies one named SKU and one official page, excludes quota relays', async () => {
  const source = 'https://github.com/example/skills';
  const productUrl = `${catalogUrl}/current-claude-pro`;
  const calls = [];
  const result = await loadDailyFaqSceneContext(`[技能库](${source})`, [
    `Project Name: skills\nUrl: ${source}\nDescription: Claude Code 工作流技能库`,
  ], { catalogUrl, topics: ['Claude'], products: [
    { name: 'Claude 中转额度包', url: `${catalogUrl}/relay` },
    { name: 'Claude Pro 充值续费', url: productUrl },
  ] }, { fetchImpl: async (url) => {
    calls.push(url);
    return { ok: true, text: async () => url === productUrl
      ? `<link rel="canonical" href="${productUrl}"><h1>Claude Pro 充值续费</h1>`
      : '<h1>Claude Code</h1><p>With Pro and Max plans, you have access to Claude Code.</p>' };
  } });
  assert.equal(calls.length, 2);
  assert.equal(result.scene.product.url, productUrl);
  assert.match(result.scene.official.text, /Pro and Max/);
  assert.equal(result.scene.sourceUrl, source);
});

test('Chinese-only SKU names support both main FAQ and optional scene rewriting', async () => {
  const source = 'https://github.com/example/skills';
  const productUrl = `${catalogUrl}/chong-zhi-xu-fei-yue-ka-2`;
  const items = [`Project Name: skills\nUrl: ${source}\nDescription: Claude Code 技能库`];
  const context = await loadDailyShopContext(items, { fetchImpl: async (url) => ({ ok: true,
    text: async () => url.endsWith('sitemap.xml')
      ? `<urlset><url><loc>${catalogUrl}</loc></url><url><loc>${productUrl}</loc></url></urlset>`
      : `<link rel="canonical" href="${catalogUrl}"><a href="${productUrl}">Claude Pro 充值续费</a>`,
  }) });
  assert.match(formatDailyShopPromptContext(context), /Claude Pro 充值续费/);
  assert.deepEqual(context.topics, ['Claude']);
  const enriched = await loadDailyFaqSceneContext(`[Claude Code](${source})`, items, context, {
    fetchImpl: async (url) => ({ ok: true, text: async () => url === productUrl
      ? `<link rel="canonical" href="${productUrl}"><h1>Claude Pro 充值续费</h1>`
      : 'With Pro and Max plans, you have access to Claude Code.' }),
  });
  assert.equal(enriched.scene.product.url, productUrl);
  assert.equal(enriched.catalogUrl, catalogUrl);
  assert.deepEqual(context.topics, ['Claude']);
  assert.match(formatDailyShopPromptContext(context), /Claude Pro 充值续费/);
});

test('failed SKU and official checks keep only the verified catalog, not fabricated rights', async () => {
  const url = 'https://x.com/example/status/123';
  const result = await loadDailyFaqSceneContext(`[Claude](${url})`, [`News Title: Claude\nUrl: ${url}`], {
    catalogUrl, topics: ['Claude'], products: [{ name: 'Claude Pro', url: `${catalogUrl}/sku` }],
  }, { fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(result.scene.product, null);
  assert.equal(result.scene.official, null);
  assert.equal(result.catalogUrl, catalogUrl);
});

test('FAQ rotates to another actual news scene instead of reusing yesterday workflow', async () => {
  const skillUrl = 'https://github.com/example/skills';
  const quotaUrl = 'https://example.org/claude-quota';
  const result = await loadDailyFaqSceneContext(`[Claude Skill](${skillUrl})\n[Claude 额度](${quotaUrl})`, [
    `Project Name: skills\nUrl: ${skillUrl}\nDescription: Claude Code 工作流技能`,
    `News Title: Claude 使用额度\nUrl: ${quotaUrl}\nContent Summary: Claude 用户关注额度的消耗`,
  ], {catalogUrl, topics:['Claude'], recentFaqs:[{
    date:'2026-10-02', topic:'Claude', theme:'workflow', question:'Claude Skill 如何用？', sourceUrls:[skillUrl],
  }]}, {fetchImpl: async () => {throw new Error('offline');}});
  assert.equal(result.scene.sourceUrl, quotaUrl);
  assert.equal(result.scene.topic, 'Claude');
});

test('FAQ link sanitation leaves news, images and footer byte-identical and allows only one verified URL', () => {
  const before = '## 新闻\r\n\r\n[Claude 工具](https://example.org/a)\r\n\r\n![配图](https://example.org/a.png)\r\n\r\n';
  const after = '## 页脚\r\n\r\n保留空白。\r\n';
  const faq = `## **❓ 相关问题**\n\n### Claude 会员如何选？\n\n[来源](https://example.org/a)说明了 Claude 工具。看看[爱窝啦·AI账号店的续费](${catalogUrl})和[错误链接](${catalogUrl}/fake)。\n\n`;
  const result = finalizeDailyShopFaq(before + faq + after, {
    catalogUrl, topics: ['Claude'], sourceText: 'Url: https://example.org/a',
  });
  assert.ok(result.startsWith(before));
  assert.ok(result.endsWith(after));
  assert.equal((result.match(/\]\(https:\/\/www.aivora.cn/g) || []).length, 1);
  assert.doesNotMatch(result, /products\/fake|准备比较当前公开/);
});

test('Codex-only news discovers a Chinese-named ChatGPT Plus SKU through the live catalog', async () => {
  const plus = `${catalogUrl}/cheng-pin-hao-yue-ka`;
  const items = ['News Title: Codex 语音原型\nUrl: https://example.org/prototype\nContent Summary: Codex 协助设计软件和外壳'];
  const context = await loadDailyShopContext(items, { fetchImpl: async url => ({ok:true,
    text: async () => url.endsWith('sitemap.xml')
      ? `<urlset><url><loc>${catalogUrl}</loc></url><url><loc>${plus}</loc></url></urlset>`
      : `<link rel="canonical" href="${catalogUrl}"><a href="/products/cheng-pin-hao-yue-ka">ChatGPT Plus 成品号</a>`,
  }) });
  assert.deepEqual(context.topics, ['Codex']);
  assert.match(formatDailyShopPromptContext(context), /ChatGPT Plus 成品号/);
});

test('Codex scene matches a verified Plus subscription, not relay, verification or quota products', async () => {
  const source = 'https://example.org/prototype';
  const plus = `${catalogUrl}/current-plus`;
  const result = await loadDailyFaqSceneContext(`[语音原型](${source})`, [
    `News Title: Codex 语音原型\nUrl: ${source}\nContent Summary: Codex 协助设计软件和外壳`,
  ], {catalogUrl, topics:['Codex'], products:[
    {name:'Codex 接码',url:`${catalogUrl}/verification`},
    {name:'Codex 中转额度包',url:`${catalogUrl}/relay`},
    {name:'ChatGPT Plus 镜像',url:`${catalogUrl}/mirror`},
    {name:'ChatGPT Go 成品号',url:`${catalogUrl}/go`},
    {name:'ChatGPT Plus 成品号',url:plus},
  ]}, {fetchImpl:async url => ({ok:true,text:async () => url === plus
    ? `<link rel="canonical" href="${plus}"><h1>ChatGPT Plus 成品号</h1>`
    : `<nav>${'Navigation '.repeat(600)}</nav><main><h1>Pricing</h1><p>ChatGPT Work and Codex are included in your ChatGPT Plus plan.</p></main>`})});
  assert.equal(result.scene.product?.url, plus);
  assert.match(result.scene.official.text, /Codex are included.*Plus/);
  assert.doesNotMatch(result.scene.official.text, /Navigation/);
});

test('missing official plan evidence cannot turn a Codex scene into a Plus entitlement claim', async () => {
  const source = 'https://example.org/prototype';
  const plus = `${catalogUrl}/current-plus`;
  const result = await loadDailyFaqSceneContext(`[原型](${source})`, [`News Title: Codex 原型\nUrl: ${source}`],
    {catalogUrl, topics:['Codex'], products:[{name:'ChatGPT Plus 成品号',url:plus}]},
    {fetchImpl:async url => {
      if (url !== plus) throw Error('official unavailable');
      return {ok:true,text:async () => `<link rel="canonical" href="${plus}"><h1>ChatGPT Plus 成品号</h1>`};
    }});
  assert.equal(result.scene.product, null);
  assert.equal(result.scene.official, null);
});

test('a relevant scene with a deliverable outranks a higher-priority scene without one', async () => {
  const chat = 'https://example.org/chatgpt';
  const gemini = 'https://example.org/gemini';
  const product = `${catalogUrl}/gemini-renewal`;
  const result = await loadDailyFaqSceneContext(`[ChatGPT](${chat})\n[Gemini](${gemini})`, [
    `News Title: ChatGPT 新功能\nUrl: ${chat}`,
    `News Title: Gemini 文档整理\nUrl: ${gemini}`,
  ], {catalogUrl, topics:['ChatGPT','Gemini'], products:[{name:'Gemini Pro 充值续费',url:product}]},
    {fetchImpl:async url => ({ok:true,text:async () => url === product
      ? `<link rel="canonical" href="${product}"><h1>Gemini Pro 充值续费</h1>` : '<main>Google AI plans</main>'})});
  assert.equal(result.scene.topic, 'Gemini');
  assert.equal(result.scene.product.url, product);
});

test('actual product URLs rotate across Codex and ChatGPT aliases within the same history', async () => {
  const source = 'https://example.org/new-codex';
  const used = `${catalogUrl}/plus-account`;
  const next = `${catalogUrl}/plus-renewal`;
  const result = await loadDailyFaqSceneContext(`[Codex](${source})`, [`News Title: Codex 原型\nUrl: ${source}`], {
    catalogUrl, topics:['Codex'], recentFaqs:[{date:'2026-11-03',topic:'ChatGPT',question:'ChatGPT 怎么选？',productUrls:[used]}],
    products:[{name:'ChatGPT Plus 成品号',url:used},{name:'ChatGPT Plus 充值续费',url:next}],
  }, {fetchImpl:async url => ({ok:true,text:async () => url === next
    ? `<link rel="canonical" href="${next}"><h1>ChatGPT Plus 充值续费</h1>`
    : '<main>ChatGPT Plus includes Codex.</main>'})});
  assert.equal(result.scene.product?.url, next);
});

test('navigation keywords and negative plan statements do not establish Codex subscription support', async () => {
  const source = 'https://example.org/prototype';
  const plus = `${catalogUrl}/plus`;
  for (const official of [
    '<nav>ChatGPT Plus Codex included</nav><main>Account settings</main>',
    '<main>ChatGPT Plus does not include Codex.</main>',
  ]) {
    const result = await loadDailyFaqSceneContext(`[原型](${source})`, [`News Title: Codex 原型\nUrl: ${source}`],
      {catalogUrl,topics:['Codex'],products:[{name:'ChatGPT Plus 成品号',url:plus}]},
      {fetchImpl:async url => ({ok:true,text:async () => url === plus
        ? `<link rel="canonical" href="${plus}"><h1>ChatGPT Plus 成品号</h1>` : official})});
    assert.equal(result.scene.product, null);
  }
});

test('current pricing cards supply the actual Codex plan context without requiring an old page heading', async () => {
  const source = 'https://example.org/prototype';
  const plus = `${catalogUrl}/plus`;
  const result = await loadDailyFaqSceneContext(`[Codex](${source})`, [`News Title: Codex 原型\nUrl: ${source}`],
    {catalogUrl,topics:['Codex'],products:[{name:'ChatGPT Plus 成品号',url:plus}]},
    {fetchImpl:async url => ({ok:true,text:async () => url === plus
      ? `<link rel="canonical" href="${plus}"><h1>ChatGPT Plus 成品号</h1>`
      : '<main><h1>Pricing</h1><p>ChatGPT Work and Codex share usage.</p><h2>Plus</h2><p>Codex on the web, in the CLI, in the IDE extension.</p></main>'})});
  assert.equal(result.scene.product?.url, plus);
});

test('tracking removal does not hide the actual Codex news or drop its related product link', async () => {
  const plain = 'https://www.bestblogs.dev/en/status/123';
  const tracked = `${plain}?utm_source=rss&entry=rss_article_item`;
  const plus = `${catalogUrl}/plus-renewal`;
  const items = [`News Title: Codex 语音原型\nUrl: ${tracked}\nContent Summary: Codex 软件设计`];
  const article = `## 新闻\n\n[Codex 原型](${plain})\n\n`;
  const context = await loadDailyFaqSceneContext(article, items, {catalogUrl,topics:['Codex'],sourceItems:items,
    sourceText:items.join('\n'),products:[{name:'ChatGPT Plus 充值续费',url:plus}]},
    {fetchImpl:async url => ({ok:true,text:async () => url === plus
      ? `<link rel="canonical" href="${plus}"><h1>ChatGPT Plus 充值续费</h1>`
      : '<main>ChatGPT Plus includes Codex.</main>'})});
  assert.equal(context.scene.sourceUrl, plain);
  const section = `## **❓ 相关问题**\n\n### Codex 可以做语音小工具吗？\n\n[原型实验](${plain})展示了软件设计。已有账号可以看[爱窝啦·AI账号店的 ChatGPT Plus 充值续费](${plus})。`;
  const cleaned = finalizeDailyShopFaq(article + section, context);
  assert.ok(cleaned.includes(`](${plus})`));
});

test('tracking normalization never confuses two different article query IDs', async () => {
  const result = await loadDailyFaqSceneContext('[Codex](https://news.ycombinator.com/item?id=2)', [
    'News Title: Codex 原型\nUrl: https://news.ycombinator.com/item?id=1&utm_source=rss',
  ], {catalogUrl,topics:['Codex'],products:[{name:'ChatGPT Plus',url:`${catalogUrl}/plus`}]},
    {fetchImpl:async () => {throw Error('must not fetch');}});
  assert.equal(result.scene, undefined);
});
