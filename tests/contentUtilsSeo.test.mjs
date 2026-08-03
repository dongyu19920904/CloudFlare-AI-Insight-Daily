import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDailyContentWithFrontMatter,
  buildDailyMetaDescription,
  updateHomeIndexContent,
} from "../src/contentUtils.js";

const dailyMarkdown = `## **今日摘要**

\`\`\`
OpenAI 发布经过官方确认的新模型，开发者需要重新比较调用成本。
产品能力和计费方式同时变化，使用前应核对官方限制。
今天先看官方价格页，再决定使用订阅还是 API。
\`\`\`

## **🔥 今日焦点 TOP 1**`;

test("daily meta description is derived from the current three-line summary", () => {
  const description = buildDailyMetaDescription(dailyMarkdown);

  assert.match(description, /OpenAI 发布经过官方确认的新模型/);
  assert.match(description, /今天先看官方价格页/);
  assert.ok(Array.from(description).length <= 150);
});

test("daily page front matter includes publication date, breadcrumbs, and unique description", () => {
  const content = buildDailyContentWithFrontMatter("2026-08-03", dailyMarkdown, {
    title: "爱窝啦 AI 日报 2026/8/3",
  });

  assert.match(content, /^date: 2026-08-03T00:00:00\+08:00$/m);
  assert.match(content, /^breadcrumbs: true$/m);
  assert.match(content, /^description: ".*OpenAI 发布经过官方确认的新模型.*"$/m);
});

test("daily home front matter refreshes its description with the latest issue", () => {
  const existing = `---
title: 旧日报
description: "旧的通用描述"
next: /2026-08/2026-08-02
---

旧正文`;

  const content = updateHomeIndexContent(existing, dailyMarkdown, "2026-08-03", {
    title: "爱窝啦 AI 日报 2026/8/3",
  });

  assert.match(content, /^next: \/2026-08\/2026-08-03$/m);
  assert.match(content, /^description: ".*今天先看官方价格页.*"$/m);
  assert.doesNotMatch(content, /旧的通用描述/);
});
