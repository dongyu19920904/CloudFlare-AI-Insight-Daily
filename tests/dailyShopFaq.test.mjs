import test from 'node:test';
import assert from 'node:assert/strict';

import {
  finalizeDailyShopFaq,
  formatDailyShopPromptContext,
  loadDailyShopContext,
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
  assert.equal(formatDailyShopPromptContext(failed), '');
});

test('a sourced same-topic FAQ gets one verified catalog link, not a guessed SKU', async () => {
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

  assert.equal((result.match(/https:\/\/www\.aivora\.cn/g) || []).length, 1);
  assert.match(result, /\[\*\*爱窝啦·AI账号店\*\*\]\(https:\/\/www\.aivora\.cn\/products\)/);
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
  assert.doesNotMatch(
    finalizeDailyShopFaq(`${article}\n\n[店铺](https://www.aivora.cn/products/fake-sku)`, context),
    /https:\/\/www\.aivora\.cn/
  );
  assert.doesNotMatch(
    finalizeDailyShopFaq(`${article}\n\n店铺 https://www.aivora.cn/products/fake-sku`, context),
    /https:\/\/www\.aivora\.cn/
  );
  assert.doesNotMatch(finalizeDailyShopFaq(unrelatedFaq, { ...context, catalogUrl: '' }), /aivora\.cn/);
});
