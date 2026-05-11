import test from "node:test";
import assert from "node:assert/strict";

import { ensureDailyFunSectionHasSourceItem } from "../src/dailyFunFallback.js";
import { sanitizeDuplicateDailySections } from "../src/dailySectionSanitizer.js";
import { validateDailyPublication } from "../src/publishValidation.js";

const baseDailyMarkdown = `## **今日摘要**

\`\`\`
今天 AI 工具继续进入真实工作流，日报需要保持栏目完整，不能只留下空标题。
\`\`\`

## ⚡ 快速导航

- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **👀 只有一句话**
AI 工具正在从聊天窗口走向真实任务。

### **🔑 3 个关键词**
#Agent #工作流 #开发者

## **🔥 重磅 TOP 1**

### 1. [OpenAI 发布新的 Agent 工作流能力](https://example.com/openai-agent-workflow)
这是一条足够完整的 AI 产品新闻，正文说明它为什么重要，并且不依赖空栏目凑结构。开发者真正关心的是，Agent 是否能从简单对话变成可持续执行任务的工作流；这条新闻正好提供了新的观察窗口。这里继续补足正文长度，让校验聚焦在空栏目问题上，而不是内容太短。

## **📌 值得关注**

- **[产品]** [一个补充动态](https://example.com/watch-1) - 这条补充动态没有和 TOP 重复。

## **😄 AI趣闻**

## **❓ 相关问题**

### 如何体验今天提到的 Agent 工作流？

可以先从主流 AI 工具开始，确认账号、地区和付费门槛，再决定是否接入自己的工作流。

**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取成品账号，极速发货，售后无忧。`;

test("ensureDailyFunSectionHasSourceItem fills an empty AI fun section from selected sources", () => {
  const selectedContentItems = [
    [
      "News Title: 一个开发者把 AI 助手接进旧工作台",
      "Published: 2026-05-11",
      "Url: https://example.com/fun-agent-workbench",
      "Content Summary: 这个 AI 工具变化适合写成一个轻观察。",
    ].join("\n"),
  ];

  const result = ensureDailyFunSectionHasSourceItem(baseDailyMarkdown, selectedContentItems);

  assert.equal(result.inserted, true);
  assert.match(result.markdown, /AI趣闻/);
  assert.match(result.markdown, /fun-agent-workbench/);

  const validation = validateDailyPublication({
    summaryText: "今天 AI 工具继续进入真实工作流，日报需要保持栏目完整，不能只留下空标题。",
    pageMarkdown: result.markdown,
    minimumTopItems: 1,
  });
  assert.equal(validation.ok, true);
});

test("ensureDailyFunSectionHasSourceItem leaves a non-empty AI fun section unchanged", () => {
  const markdown = baseDailyMarkdown.replace(
    "## **😄 AI趣闻**",
    "## **😄 AI趣闻**\n\n### [已经存在的趣闻](https://example.com/existing-fun)\n这条已经有原始来源链接，不需要兜底。"
  );

  const result = ensureDailyFunSectionHasSourceItem(markdown, [
    "News Title: 另一个候选\nUrl: https://example.com/another",
  ]);

  assert.equal(result.inserted, false);
  assert.equal(result.markdown, markdown);
});

test("ensureDailyFunSectionHasSourceItem can fill after duplicate sanitization empties AI fun", () => {
  const duplicatedFunMarkdown = baseDailyMarkdown.replace(
    "## **😄 AI趣闻**",
    "## **😄 AI趣闻**\n\n### [OpenAI 发布新的 Agent 工作流能力](https://example.com/openai-agent-workflow)\n这条和 TOP 重复，会先被去重器清掉。"
  );
  const sanitized = sanitizeDuplicateDailySections(duplicatedFunMarkdown);

  const result = ensureDailyFunSectionHasSourceItem(sanitized, [
    [
      "News Title: 一个用户把 AI 助手接进旧工作台",
      "Published: 2026-05-11",
      "Url: https://example.com/fallback-fun-source",
      "Content Summary: 这条适合补成 AI 趣闻观察。",
    ].join("\n"),
  ]);

  assert.equal(result.inserted, true);
  assert.doesNotMatch(result.markdown, /这条和 TOP 重复/);
  assert.match(result.markdown, /fallback-fun-source/);
});

test("ensureDailyFunSectionHasSourceItem skips non-AI fallback candidates", () => {
  const result = ensureDailyFunSectionHasSourceItem(baseDailyMarkdown, [
    [
      "News Title: 告别盲目锻炼 这份周练计划直接照做",
      "Published: 2026-05-11",
      "Url: https://example.com/workout-plan",
      "Content Summary: 跟 AI 圈关系不大，但可以提醒读者身体还是要练。",
    ].join("\n"),
    [
      "News Title: 开发者把 AI Agent 接进旧工作台",
      "Published: 2026-05-11",
      "Url: https://example.com/ai-agent-workbench",
      "Content Summary: 这条 AI 工具变化适合写成一个轻观察。",
    ].join("\n"),
  ]);

  assert.equal(result.inserted, true);
  assert.doesNotMatch(result.markdown, /workout-plan/);
  assert.match(result.markdown, /ai-agent-workbench/);
});

test("ensureDailyFunSectionHasSourceItem does not reuse an already used source URL", () => {
  const markdown = baseDailyMarkdown.replace(
    "## **📌 值得关注**",
    "## **📌 值得关注**\n\n- **[产品]** [Clearly AI-friendly notes](https://example.com/clearly-ai-notes) - 这条已经在值得关注里使用。"
  );

  const result = ensureDailyFunSectionHasSourceItem(markdown, [
    [
      "News Title: Clearly AI-friendly notes",
      "Published: 2026-05-11",
      "Url: https://example.com/clearly-ai-notes",
      "Content Summary: AI Agent friendly notes app.",
    ].join("\n"),
  ]);

  assert.equal(result.inserted, false);
  assert.equal(result.markdown, markdown);
});
