import test from "node:test";
import assert from "node:assert/strict";

import { extractNumberedDailyItems } from "../src/dailyMarkdownItems.js";

test("extractNumberedDailyItems supports body source links and legacy linked headings", () => {
  const markdown = `
### 1. MiniMax H3 统一全模态生成

官方公布的 [H3 能力与定价详情](https://example.com/h3) 显示模型支持 **15 秒 2K** 输出。

![H3 演示](https://example.com/h3.png)

### 2. [旧格式标题仍可读取](https://example.com/legacy)

旧日报正文。
`;

  const items = extractNumberedDailyItems(markdown);

  assert.equal(items.length, 2);
  assert.equal(items[0].title, "MiniMax H3 统一全模态生成");
  assert.equal(items[0].url, "https://example.com/h3");
  assert.equal(items[0].bodyLinks.length, 1);
  assert.equal(items[0].headingLink, null);
  assert.equal(items[1].title, "旧格式标题仍可读取");
  assert.equal(items[1].url, "https://example.com/legacy");
  assert.equal(items[1].bodyLinks.length, 0);
  assert.equal(items[1].headingLink?.url, "https://example.com/legacy");
});

test("extractNumberedDailyItems leaves a source-less item detectable", () => {
  const items = extractNumberedDailyItems("### 1. 只有标题\n\n正文没有链接。");

  assert.equal(items.length, 1);
  assert.equal(items[0].url, "");
});
