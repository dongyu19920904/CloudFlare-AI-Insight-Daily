import test from "node:test";
import assert from "node:assert/strict";

import RssNewsDataSource from "../src/dataSources/rss-news.js";
import { getISODate, setFetchDate } from "../src/helpers.js";

const originalFetch = globalThis.fetch;
const originalFetchDate = getISODate();

test("SuperTechFans HackerNews RSS is split into story-level news items", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>2026 07 08 HackerNews</title>
      <link>https://supertechfans.com/cn/post/2026-07-08-HackerNews/</link>
      <pubDate>Wed, 08 Jul 2026 07:00:12 +0800</pubDate>
      <description><![CDATA[
        <h2 id="1-router">1. OpenWrt One – 开源硬件路由器</h2>
        <p><a href="https://openwrt.org/toh/openwrt/one">https://openwrt.org/toh/openwrt/one</a></p>
        <p>OpenWrt One 是开源硬件路由器。</p>
        <hr>
        <h2 id="2-glm">2. GLM 5.2 与即将到来的人工智能利润率崩塌</h2>
        <p><a href="https://example.com/glm-5-2">https://example.com/glm-5-2</a></p>
        <p>GLM 5.2 是低成本开源权重模型，可能压低 AI 推理价格。</p>
      ]]></description>
    </item>
  </channel>
</rss>`,
  });
  setFetchDate("2026-07-08");

  try {
    const raw = await RssNewsDataSource.fetch({
      RSS_NEWS_URLS: "SuperTechFans HackerNews::https://www.supertechfans.com/cn/index.xml",
      RSS_NEWS_FILTER_DAYS: "3",
      RSS_NEWS_MAX_FEEDS_PER_RUN: "1",
      RSS_NEWS_MAX_ITEMS_PER_FEED: "1",
      RSS_NEWS_MAX_STORIES_PER_ITEM: "12",
    });
    const items = RssNewsDataSource.transform(raw, "news");

    assert.equal(items.length, 1);
    assert.equal(items[0].title, "GLM 5.2 与即将到来的人工智能利润率崩塌");
    assert.equal(items[0].url, "https://example.com/glm-5-2");
    assert.equal(items[0].source, "SuperTechFans HackerNews");
    assert.equal(items[0].details.sourcePageUrl, "https://supertechfans.com/cn/post/2026-07-08-HackerNews/");
  } finally {
    setFetchDate(originalFetchDate);
    globalThis.fetch = originalFetch;
  }
});
