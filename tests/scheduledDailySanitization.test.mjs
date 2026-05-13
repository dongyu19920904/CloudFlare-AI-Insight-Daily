import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeDuplicateDailySections, stripDailyHeadingCountSuffix } from "../src/dailySectionSanitizer.js";

test("stripDailyHeadingCountSuffix removes stale item counts from daily headings", () => {
  const markdown = [
    "## **\uD83D\uDD25 TOP 1**",
    "",
    "### 1. [OpenAI model](https://example.com/openai-model)",
    "A useful AI update.",
    "",
    "## **\uD83D\uDCCC \u503C\u5F97\u5173\u6CE8\uFF082\u6761\uFF09**",
    "",
    "- **[\u7814\u7A76]** [Causal AI](https://example.com/causal-ai) - One item only.",
    "",
    "## **\uD83D\uDE04 AI\u8DA3\u95FB(1\u6761)**",
    "",
    "### [AI fun](https://example.com/ai-fun)",
    "A small AI story.",
  ].join("\n");

  const stripped = stripDailyHeadingCountSuffix(markdown);
  const sanitized = sanitizeDuplicateDailySections(markdown);

  assert.match(stripped, /^## \*\*\uD83D\uDCCC \u503C\u5F97\u5173\u6CE8\*\*$/m);
  assert.match(stripped, /^## \*\*\uD83D\uDE04 AI\u8DA3\u95FB\*\*$/m);
  assert.match(sanitized, /^## \*\*\uD83D\uDCCC \u503C\u5F97\u5173\u6CE8\*\*$/m);
  assert.doesNotMatch(sanitized, /\uFF082\u6761\uFF09/);
  assert.doesNotMatch(sanitized, /\(1\u6761\)/);
});

test("sanitizeDuplicateDailySections removes watch and fun items already used in TOP", () => {
  const markdown = `## **今日AI资讯**

## **🔥 重磅 TOP 2**

### 1. [OpenAI 发布新模型](https://example.com/openai-model)
这是一条足够重要的 AI 新闻。

### 2. [Claude 工具链升级](https://example.com/claude-tools)
这是一条不同的 AI 新闻。

## **📌 值得关注**

- **[产品]** [OpenAI 发布新模型](https://example.com/openai-model) - 这条重复 TOP，不应该保留。
- **[研究]** [SAPO 强化学习方法](https://example.com/sapo) - 这条没有重复，应该保留。

## **😄 AI趣闻**

### [Claude 工具链升级](https://example.com/claude-tools)
这条和 TOP 重复，不应该保留。

### [开发者用 AI 修好了一个小工具](https://example.com/fun-ai-tool)
这条是新趣闻，应该保留。

## **❓ 相关问题**

### 如何体验 OpenAI 新模型？
可以通过官方入口或成品账号体验。`;

  const sanitized = sanitizeDuplicateDailySections(markdown);

  assert.doesNotMatch(sanitized, /这条重复 TOP/);
  assert.doesNotMatch(sanitized, /这条和 TOP 重复/);
  assert.match(sanitized, /SAPO 强化学习方法/);
  assert.match(sanitized, /开发者用 AI 修好了一个小工具/);
});

test("sanitizeDuplicateDailySections removes fun items already used in watch section", () => {
  const markdown = `## **今日AI资讯**

## **🔥 重磅 TOP 1**

### 1. [OpenAI 发布新的 Agent 工作流](https://example.com/openai-agent)
这是一条不同的 TOP 新闻。
## **📌 值得关注**

- **[产品]** [Clearly：轻量 AI-friendly Markdown 编辑器](https://example.com/clearly-ai-notes) - 已经在值得关注里使用。
## **😄 AI趣闻**

### [Clearly：轻量 AI-friendly Markdown 编辑器](https://example.com/clearly-ai-notes)
这条和值得关注重复，不应该保留。
### [开发者把 AI 接进旧工作台](https://example.com/fun-ai-workbench)
这条没有重复，应该保留。
## **❓ 相关问题**

### 如何体验今天提到的工具？
先看官方入口，再选择适合自己的服务方式。`;

  const sanitized = sanitizeDuplicateDailySections(markdown);

  assert.doesNotMatch(sanitized, /这条和值得关注重复/);
  assert.match(sanitized, /fun-ai-workbench/);
});
