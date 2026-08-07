import test from "node:test";
import assert from "node:assert/strict";

import {
  DAILY_AIVORA_FAQ_CTA,
  isLowValueDailyMediaUrl,
  isVolatileDailyMediaUrl,
  normalizeDailyChinesePunctuation,
  normalizeDailyFaqAivoraCta,
  normalizeDailyOutputPresentation,
  normalizeMisleadingDailySourceLabels,
  removeEmptyDailyFunSection,
  removeEmptyDailyTopicSections,
  removeVolatileDailyImages,
  sanitizeDuplicateDailySections,
  stripDailyHeadingCountSuffix,
} from "../src/dailySectionSanitizer.js";

test("normalizeDailyFaqAivoraCta preserves the answer and replaces misleading store copy", () => {
  const markdown = `## **❓ 相关问题**

### MiniMax H3 国内怎么用？

MiniMax H3 可通过官方平台使用，具体地区与订阅要求以[官方说明](https://example.com/minimax-h3)为准。

如果你想统一访问多个模型，也可以通过 **[爱窝啦 Aivora](https://aivora.cn)** 省去逐个注册。`;

  const normalized = normalizeDailyFaqAivoraCta(markdown);

  assert.match(normalized, /MiniMax H3 可通过官方平台使用/);
  assert.match(normalized, /官方说明/);
  assert.ok(normalized.includes(DAILY_AIVORA_FAQ_CTA));
  assert.doesNotMatch(normalized, /爱窝啦 Aivora/);
  assert.doesNotMatch(normalized, /统一访问|省去逐个注册/);
});

test("normalizeDailyFaqAivoraCta does not hide a missing factual answer", () => {
  const markdown = `## **❓ 相关问题**

### 某工具国内怎么用？

访问 **[爱窝啦 Aivora](https://aivora.cn)** 即可统一体验。`;

  const normalized = normalizeDailyFaqAivoraCta(markdown);

  assert.doesNotMatch(normalized, /爱窝啦|Aivora|aivora\.cn/);
  assert.doesNotMatch(normalized, /购买后的使用指导与售后支持/);
});

test("sanitizeDuplicateDailySections removes repeated stories across V3 topic sections", () => {
  const markdown = `## **🔥 今日焦点 TOP 1**

### 1. [模型开放新接口](https://example.com/model-api)

今日焦点正文。

## **⚡ 产品与功能更新**

### [模型开放新接口的产品解读](https://example.com/model-api)

重复内容不应该保留。

### [另一款工具加入批处理](https://example.com/batch-tool)

这是不同事件，应该保留。

## **🧪 前沿研究与行业影响**

### [研究团队公布代理实验](https://example.com/agent-study)

这是研究栏目里的独立事件。`;

  const sanitized = sanitizeDuplicateDailySections(markdown);

  assert.doesNotMatch(sanitized, /重复内容不应该保留/);
  assert.match(sanitized, /另一款工具加入批处理/);
  assert.match(sanitized, /研究团队公布代理实验/);
});

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

test("removeEmptyDailyFunSection removes empty or source-less AI fun section", () => {
  const markdown = `## **今日AI资讯**

## **🔥 重磅 TOP 1**

### 1. [OpenAI 发布新的 Agent 工作流](https://example.com/openai-agent)
这是一条不同的 TOP 新闻。

## **📌 值得关注**

- **[产品]** [一个补充动态](https://example.com/watch-1) - 正常补充内容。

## **😄 AI趣闻**

今天没有自然好笑的素材。

## **❓ 相关问题**

### 如何体验今天提到的工具？
先看官方入口，再选择适合自己的服务方式。`;

  const sanitized = removeEmptyDailyFunSection(markdown);

  assert.doesNotMatch(sanitized, /AI趣闻/);
  assert.doesNotMatch(sanitized, /今天没有自然好笑的素材/);
  assert.match(sanitized, /值得关注/);
  assert.match(sanitized, /相关问题/);
});

test("removeEmptyDailyTopicSections removes a source-less optional topic section", () => {
  const markdown = `## **🔥 今日焦点 TOP 1**

### 1. 模型开放新接口

正文包含[接口发布详情](https://example.com/model-api)。

## **⚡ 产品与功能更新**

### 新接口降低调用成本

正文包含[价格与能力说明](https://example.com/pricing)。

## **◉ 社媒精选**

今天没有可核实的社媒素材。

## **❓ 相关问题**

### 如何体验？

访问 [Aivora](https://aivora.cn)。`;

  const sanitized = removeEmptyDailyTopicSections(markdown);

  assert.match(sanitized, /产品与功能更新/);
  assert.doesNotMatch(sanitized, /社媒精选/);
  assert.match(sanitized, /相关问题/);
});

test("removeEmptyDailyTopicSections removes an empty heading without consuming the next section", () => {
  const markdown = `## **⚡ 产品与功能更新**
## **◎ 行业变化与个人影响**

### 企业寻找 AI 培训

正文包含[招募信息](https://example.com/training)。`;

  const sanitized = removeEmptyDailyTopicSections(markdown);

  assert.doesNotMatch(sanitized, /产品与功能更新/);
  assert.match(sanitized, /行业变化与个人影响/);
  assert.match(sanitized, /招募信息/);
});

test("daily output presentation normalizes Chinese commas without changing URLs or code", () => {
  const markdown = "模型上线,开发者可测试。[参数页](https://example.com/a,b) `items.join(',')` 当天新增 **326 Stars**,总计 2417。";

  const normalized = normalizeDailyChinesePunctuation(markdown);

  assert.match(normalized, /模型上线，开发者可测试/);
  assert.match(normalized, /Stars\*\*，总计/);
  assert.match(normalized, /https:\/\/example\.com\/a,b/);
  assert.match(normalized, /items\.join\(','\)/);
});

test("daily output presentation corrects official wording on editorial links", () => {
  const markdown = "[阿里千问官方公告](https://www.aibase.com/zh/news/30136)与[DeepSeek 官方说明](https://api-docs.deepseek.com/news)";

  const normalized = normalizeMisleadingDailySourceLabels(markdown);

  assert.match(normalized, /\[AIBase 对这项消息的报道\]\(https:\/\/www\.aibase\.com/);
  assert.match(normalized, /\[DeepSeek 官方说明\]\(https:\/\/api-docs\.deepseek\.com/);
});

test("daily output presentation removes volatile and low-value images", () => {
  const markdown = `正文。

![临时图](https://cdn5.telesco.pe/file/example.jpg "临时图")

![头像](https://pbs.twimg.com/profile_images/123/user_normal.jpg "头像")

![稳定图](https://pbs.twimg.com/media/example.jpg "稳定图")`;

  assert.equal(isVolatileDailyMediaUrl("https://cdn5.telesco.pe/file/example.jpg"), true);
  assert.equal(isVolatileDailyMediaUrl("https://t.me/example"), false);
  assert.equal(isLowValueDailyMediaUrl("https://pbs.twimg.com/profile_images/123/user_normal.jpg"), true);
  assert.equal(isLowValueDailyMediaUrl("https://pbs.twimg.com/media/example.jpg"), false);

  const normalized = removeVolatileDailyImages(markdown);
  assert.doesNotMatch(normalized, /telesco\.pe/);
  assert.doesNotMatch(normalized, /profile_images|user_normal/);
  assert.match(normalized, /pbs\.twimg\.com/);
  assert.equal(normalizeDailyOutputPresentation(normalized), normalized);
});
