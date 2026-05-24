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
  assert.doesNotMatch(result.markdown, /适合放在\s*AI趣闻/);
  assert.doesNotMatch(result.markdown, /适合补成\s*AI\s*趣闻/);
  assert.doesNotMatch(result.markdown, /有意思的不是它声量多大/);

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

test("ensureDailyFunSectionHasSourceItem can use an unused selected source when strong AI wording is unavailable", () => {
  const result = ensureDailyFunSectionHasSourceItem(baseDailyMarkdown, [
    [
      "News Title: A lighter Markdown editor for daily notes",
      "Published: 2026-05-11",
      "Url: https://example.com/lighter-markdown-editor",
      "Content Summary: A simple writing tool with fast launch and fewer plugin decisions.",
    ].join("\n"),
  ]);

  assert.equal(result.inserted, true);
  assert.match(result.markdown, /AI小观察/);
  assert.match(result.markdown, /lighter-markdown-editor/);
});

test("ensureDailyFunSectionHasSourceItem prefers human-facing news over paper fallback", () => {
  const result = ensureDailyFunSectionHasSourceItem(baseDailyMarkdown, [
    [
      "Papers Title: H-OmniStereo: Zero-Shot Omnidirectional Stereo Matching with Heading-Align",
      "Published: 2026-05-16",
      "Url: https://arxiv.org/abs/2605.14963",
      "Abstract/Content Summary: A technical paper about omnidirectional stereo matching.",
    ].join("\n"),
    [
      "News Title: 用户用 Kimi WebBridge 自动填完一张复杂表单",
      "Published: 2026-05-16",
      "Url: https://example.com/kimi-webbridge-form",
      "Content Summary: 一个用户把浏览器里的重复点击交给 AI 处理，原本十几步的流程变成一句话。",
    ].join("\n"),
  ]);

  assert.equal(result.inserted, true);
  assert.match(result.markdown, /kimi-webbridge-form/);
  assert.match(result.markdown, /手指头点到最后/);
  assert.match(result.markdown, /小按钮里捞出来/);
  assert.doesNotMatch(result.markdown, /2605\.14963/);
  assert.doesNotMatch(result.markdown, /这条小观察适合放在/);
});

test("ensureDailyFunSectionHasSourceItem turns map-reading source into a lively real observation", () => {
  const result = ensureDailyFunSectionHasSourceItem(baseDailyMarkdown, [
    [
      "News Title: 用户读书时让 AI 生成地理空间地图",
      "Published: 2026-05-17",
      "Url: https://example.com/ai-reading-map",
      "Content Summary: 最近在读书过程中，如果涉及地理空间相关内容，会随手让 AI 生成一张地图，配合作者文本理解。",
    ].join("\n"),
  ]);

  assert.equal(result.inserted, true);
  assert.match(result.markdown, /ai-reading-map/);
  assert.match(result.markdown, /作者那边还在铺陈山川河流/);
  assert.match(result.markdown, /爱抢答的小伙计/);
  assert.doesNotMatch(result.markdown, /最近在读书过程中，如果涉及/);
  assert.doesNotMatch(result.markdown, /有意思的不是它声量多大/);
});

test("ensureDailyFunSectionHasSourceItem turns unavoidable paper fallback into readable observation", () => {
  const result = ensureDailyFunSectionHasSourceItem(baseDailyMarkdown, [
    [
      "Papers Title: RxEval: A Prescription-Level Benchmark for Evaluating LLM Medication Recommendation Safety",
      "Published: 2026-05-16",
      "Url: https://arxiv.org/abs/2605.14543",
      "Abstract/Content Summary: arXiv:2605.14543v1 Announce Type: cross Abstract: Inpatient medication recommendation requires clinicians to repeatedly compare medications.",
    ].join("\n"),
  ]);

  assert.equal(result.inserted, true);
  assert.match(result.markdown, /2605\.14543/);
  assert.match(result.markdown, /医疗 AI/);
  assert.doesNotMatch(result.markdown, /arXiv:2605/);
  assert.doesNotMatch(result.markdown, /Announce Type/);
  assert.doesNotMatch(result.markdown, /Inpatient medication recommendation requires/);
  assert.doesNotMatch(result.markdown, /这条小观察适合放在/);
});

test("ensureDailyFunSectionHasSourceItem keeps AI rant fallback grounded in the source", () => {
  const result = ensureDailyFunSectionHasSourceItem(baseDailyMarkdown, [
    [
      "News Title: 感觉 GPT 5.5 最近降智实在离谱",
      "Published: 2026-05-24",
      "Url: https://www.v2ex.com/t/1214839",
      "Content Summary: 一个 example.com 能耗半小时，开了两个 Pro 20x 账号，结果半个月就不行了，关闭续费了。真写代码还是只能 Claude。",
    ].join("\n"),
  ]);

  assert.equal(result.inserted, true);
  assert.match(result.markdown, /1214839/);
  assert.match(result.markdown, /example\.com/);
  assert.match(result.markdown, /Pro 20x/);
  assert.match(result.markdown, /Claude/);
  assert.doesNotMatch(result.markdown, /少点几下/);
  assert.doesNotMatch(result.markdown, /爱搭把手/);
});

test("ensureDailyFunSectionHasSourceItem prefers concrete fun sources over low-value AI rants", () => {
  const result = ensureDailyFunSectionHasSourceItem(baseDailyMarkdown, [
    [
      "News Title: 感觉 GPT 5.5 最近降智实在离谱",
      "Published: 2026-05-24",
      "Url: https://www.v2ex.com/t/1214839",
      "Content Summary: 一个 example.com 能耗半小时，开了两个 Pro 20x 账号，关闭续费了。真写代码还是只能 Claude。",
    ].join("\n"),
    [
      "News Title: M5 Stack 新设备有麦克风和扬声器，适合接入 AI 语音实验",
      "Published: 2026-05-24",
      "Url: https://example.com/m5-stack-ai-voice",
      "Content Summary: 一个开发者收到 M5 Stack 新设备，提到麦克风和扬声器让 AI 语音玩法多了很多。",
    ].join("\n"),
  ]);

  assert.equal(result.inserted, true);
  assert.match(result.markdown, /m5-stack-ai-voice/);
  assert.doesNotMatch(result.markdown, /1214839/);
});
