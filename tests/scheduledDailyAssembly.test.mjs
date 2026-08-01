import test from "node:test";
import assert from "node:assert/strict";

import { assembleDailySummaryMarkdown } from "../src/dailyMarkdownAssembly.js";

const env = {
  INSERT_AD: "false",
  INSERT_FOOT: "false",
};

test("daily assembly always publishes the generated three-line summary", () => {
  const body = `## **🔥 今日焦点 TOP 1**

### 1. [产品更新](https://example.com/update)

这是正文。`;
  const summary = [
    "第一句说明今天最重要的事实。",
    "第二句指出产品与开源背后的变化。",
    "第三句告诉读者今天先看什么。",
  ].join("\n");

  const markdown = assembleDailySummaryMarkdown(body, summary, env);

  assert.match(markdown, /^## \*\*今日摘要\*\*/);
  assert.match(markdown, /第一句说明今天最重要的事实。\n第二句指出产品与开源背后的变化。\n第三句告诉读者今天先看什么。/);
  assert.match(markdown, /## \*\*🔥 今日焦点 TOP 1\*\*/);
  assert.ok(markdown.indexOf("今日摘要") < markdown.indexOf("utm_medium=mid_ad"));
  assert.ok(markdown.indexOf("utm_medium=mid_ad") < markdown.indexOf("今日焦点 TOP 1"));
});

test("daily assembly strips obsolete model-generated intros before the TOP section", () => {
  const body = `## **⏱ 3分钟读懂今天**

- **发生了什么**：旧导读。

## **今日AI资讯**

### **👀 只有一句话**
旧开场。

## **🔥 今日焦点 TOP 1**

### 1. [真实正文](https://example.com/story)`;

  const markdown = assembleDailySummaryMarkdown(body, "今天恢复三句话摘要，并保留真实正文。", env);

  assert.match(markdown, /## \*\*今日摘要\*\*/);
  assert.doesNotMatch(markdown, /3分钟读懂今天/);
  assert.doesNotMatch(markdown, /今日AI资讯/);
  assert.doesNotMatch(markdown, /只有一句话/);
  assert.match(markdown, /真实正文/);
});

test("daily assembly normalizes numbered summary text to at most three lines", () => {
  const body = `## **🔥 今日焦点 TOP 1**`;
  const summary = `1. 第一句。\n2. 第二句。\n3. 第三句。\n4. 不应出现。`;

  const markdown = assembleDailySummaryMarkdown(body, summary, env);

  assert.match(markdown, /第一句。\n第二句。\n第三句。/);
  assert.doesNotMatch(markdown, /不应出现/);
});
