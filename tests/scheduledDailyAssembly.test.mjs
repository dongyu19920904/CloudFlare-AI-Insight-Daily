import test from "node:test";
import assert from "node:assert/strict";

import { assembleDailySummaryMarkdown } from "../src/dailyMarkdownAssembly.js";

const env = {
  INSERT_AD: "false",
  INSERT_FOOT: "false",
};

test("daily assembly publishes the V2 briefing without duplicate legacy intro sections", () => {
  const body = `## **⏱ 3分钟读懂今天**

- **发生了什么**：主流 AI 工具今天更新了任务工作流。
- **为什么重要**：开发者可以更清楚地检查修改和返工。
- **今天可以做**：选一个小任务测试十分钟并记录结果。

## **🔥 重磅 TOP 1**`;

  const markdown = assembleDailySummaryMarkdown(body, "旧版三行摘要不应显示在新版页面。", env);

  assert.match(markdown, /^## \*\*⏱ 3分钟读懂今天\*\*/);
  assert.match(markdown, /3分钟读懂今天/);
  assert.match(markdown, /重磅 TOP 1/);
  assert.ok(markdown.indexOf("3分钟读懂今天") < markdown.indexOf("utm_medium=mid_ad"));
  assert.doesNotMatch(markdown, /## \*\*今日摘要\*\*/);
  assert.doesNotMatch(markdown, /## ⚡ 快速导航/);
  assert.doesNotMatch(markdown, /旧版三行摘要不应显示/);
});

test("daily assembly keeps the legacy summary wrapper when the model misses the V2 briefing", () => {
  const body = `## **今日AI资讯**

## **🔥 重磅 TOP 1**`;

  const markdown = assembleDailySummaryMarkdown(body, "今天的有效三行摘要用于稳定发布。", env);

  assert.match(markdown, /## \*\*今日摘要\*\*/);
  assert.match(markdown, /## ⚡ 快速导航/);
  assert.match(markdown, /今天的有效三行摘要用于稳定发布/);
  assert.match(markdown, /## \*\*今日AI资讯\*\*/);
});

test("daily assembly falls back safely when the V2 briefing is incomplete", () => {
  const body = `## **⏱ 3分钟读懂今天**

- **发生了什么**：模型只写了一半导读。

## **🔥 重磅 TOP 1**`;

  const markdown = assembleDailySummaryMarkdown(body, "完整日报仍使用真实生成摘要发布。", env);

  assert.match(markdown, /## \*\*今日摘要\*\*/);
  assert.match(markdown, /完整日报仍使用真实生成摘要发布/);
  assert.match(markdown, /重磅 TOP 1/);
});
