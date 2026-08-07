import test from "node:test";
import assert from "node:assert/strict";

import {
  countUsableDailyMedia,
  ensureDailyMediaCoverage,
} from "../src/dailyMediaCoverage.js";

function candidate(index, imageUrl) {
  return {
    title: `AI 新闻 ${index}`,
    url: `https://example.com/news-${index}`,
    placeholders: [`![image](${imageUrl})`],
  };
}

test("ensureDailyMediaCoverage inserts only source-matched media beside each item", () => {
  const markdown = `## **🔥 今日焦点 TOP 10**

### 1. 第一条 AI 新闻

**第一条有更新。** [第一条新闻披露了新能力](https://example.com/news-1)。

![已有画面](https://cdn.example.com/one.jpg "已有画面")

### 2. 第二条 AI 新闻

**第二条有更新。** [第二条新闻展示了运行画面](https://example.com/news-2)。

### 3. 第三条 AI 新闻

**第三条有更新。** [第三条新闻列出了测试结果](https://example.com/news-3)。

## **❓ 相关问题**

### 工具怎么用？

[第二条新闻](https://example.com/news-2)也回答了这个问题。`;
  const result = ensureDailyMediaCoverage(markdown, [
    candidate(1, "https://cdn.example.com/one.jpg"),
    candidate(2, "https://cdn.example.com/two.jpg"),
    candidate(3, "https://cdn.example.com/three.jpg"),
  ]);

  assert.equal(result.targetCount, 3);
  assert.equal(result.insertedCount, 2);
  assert.equal(result.usableMediaCount, 3);
  assert.equal(countUsableDailyMedia(result.markdown), 3);
  assert.match(result.markdown, /AI 新闻 2\]\(https:\/\/cdn\.example\.com\/two\.jpg "AI 新闻 2"\)/);
  assert.match(result.markdown, /AI 新闻 3\]\(https:\/\/cdn\.example\.com\/three\.jpg "AI 新闻 3"\)/);
  assert.equal(result.markdown.match(/cdn\.example\.com\/two\.jpg/g)?.length, 1);
});

test("ensureDailyMediaCoverage ignores profile avatars and does not create a gallery", () => {
  const markdown = `## **🔥 今日焦点 TOP 10**

### 1. 一条 AI 新闻

**功能更新了。** [开发者展示了新交互](https://x.com/dev/status/1)。`;
  const result = ensureDailyMediaCoverage(markdown, [{
    title: "开发者头像",
    url: "https://x.com/dev/status/1",
    placeholders: ["![avatar](https://pbs.twimg.com/profile_images/123/dev_normal.jpg)"],
  }]);

  assert.equal(result.insertedCount, 0);
  assert.equal(result.targetCount, 0);
  assert.doesNotMatch(result.markdown, /相关配图|profile_images/);
});
