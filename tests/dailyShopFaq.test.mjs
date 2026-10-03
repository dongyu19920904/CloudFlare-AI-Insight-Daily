import test from 'node:test';
import assert from 'node:assert/strict';

import {
  finalizeDailyShopFaq,
  formatDailyShopPromptContext,
  loadDailyShopContext,
  loadDailyFaqSceneContext,
} from '../src/dailyShopFaq.js';
import { assembleDailySummaryMarkdown } from '../src/dailyMarkdownAssembly.js';

const catalogUrl = 'https://www.aivora.cn/products';
const sourceUrl = 'https://openai.com/index/chatgpt-update/';
const selectedItems = [`News Title: ChatGPT 更新\nUrl: ${sourceUrl}\nContent Summary: 官方说明了功能变化。`];
const sitemap = `<urlset><url><loc>${catalogUrl}</loc></url><url><loc>${catalogUrl}/chatgpt-pro-20x-account-monthly</loc></url></urlset>`;

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

test('failed SKU and official checks keep only the verified catalog, not fabricated rights', async () => {
  const url = 'https://x.com/example/status/123';
  const result = await loadDailyFaqSceneContext(`[Claude](${url})`, [`News Title: Claude\nUrl: ${url}`], {
    catalogUrl, topics: ['Claude'], products: [{ name: 'Claude Pro', url: `${catalogUrl}/sku` }],
  }, { fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(result.scene.product, null);
  assert.equal(result.scene.official, null);
  assert.equal(result.catalogUrl, catalogUrl);
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
