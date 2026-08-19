import test from "node:test";
import assert from "node:assert/strict";

import {
  DAILY_AIVORA_FAQ_CTA,
  enforceDailyTopGithubLimit,
  ensureDailyTopHighlightDensity,
  ensureUniqueDailyTopSources,
  isLowValueDailyMediaUrl,
  isVolatileDailyMediaUrl,
  normalizeDailyChinesePunctuation,
  normalizeDailyFaqAivoraCta,
  normalizeDailyOutputPresentation,
  normalizeDailyTopEvidenceLinkLabels,
  normalizeMisleadingDailySourceLabels,
  removeEmptyDailyFunSection,
  removeEmptyDailyTopicSections,
  removeDailyGenerationMetaNotes,
  removeVolatileDailyImages,
  sanitizeDuplicateDailySections,
  stripDailyHeadingCountSuffix,
} from "../src/dailySectionSanitizer.js";
import { extractNumberedDailyItems } from "../src/dailyMarkdownItems.js";

test("removeDailyGenerationMetaNotes strips candidate-count commentary", () => {
  const markdown = `## **🔥 今日焦点 TOP 10**

今日合格 AI 相关素材共 6 条（TOP 候选 4、5 属泛生活内容，TOP 候选 7 属商业投资语录），实际只能输出 6 条。

### 1. Claude 增加新能力

**功能更新了。** [官方说明列出变化](https://example.com/claude)。`;

  const normalized = removeDailyGenerationMetaNotes(markdown);

  assert.doesNotMatch(normalized, /今日合格|TOP 候选|实际只能输出/);
  assert.match(normalized, /^### 1\. Claude 增加新能力$/m);
});

test("normalizeDailyTopEvidenceLinkLabels turns source tags into contextual fact links", () => {
  const markdown = `## **🔥 今日焦点 TOP 2**

### 1. DeepSeek 宣布近期上调 API 价格

**价格准备调整。** 据 AIBase 整理，[AIBase 对这项消息的报道](https://example.com/price)，具体方案待公布。

### 2. Agent 技能库单日新增 593 Stars

**项目热度上涨。** [agent-skills 单日新增 593 Stars](https://github.com/example/skills)，适合工程团队参考。`;

  const normalized = normalizeDailyTopEvidenceLinkLabels(markdown);

  assert.match(normalized, /\[DeepSeek 宣布近期上调 API 价格\]\(https:\/\/example\.com\/price\)/);
  assert.doesNotMatch(normalized, /AIBase 对这项消息的报道/);
  assert.match(normalized, /\[agent-skills 单日新增 593 Stars\]/);
});

test("normalizeDailyTopEvidenceLinkLabels catches short source-tag variants", () => {
  const markdown = `## **🔥 今日焦点 TOP 4**

### 1. 豆包上线全双工模型
**能力已经开放。** 向阳乔木[实测录屏](https://example.com/1)展示了操作。

### 2. 普通用户很少使用 Agent
**普及仍有距离。** 频道的[观察帖](https://example.com/2)记录了现象。

### 3. 框架自动识别 CLI 工具
**配置更省事。** 开发者在[实测推文](https://example.com/3)中给出结果。

### 4. 跑分差距来自论文原表
**数字需要还原。** 作者的[基准对比分析](https://example.com/4)列出原始数据。`;

  const normalized = normalizeDailyTopEvidenceLinkLabels(markdown);

  for (const label of ["实测录屏", "观察帖", "实测推文", "基准对比分析"]) {
    assert.doesNotMatch(normalized, new RegExp(`\\[${label}\\]`));
  }
  assert.match(normalized, /\[豆包上线全双工模型\]\(https:\/\/example\.com\/1\)/);
  assert.match(normalized, /\[跑分差距来自论文原表\]\(https:\/\/example\.com\/4\)/);
});

test("normalizeDailyTopEvidenceLinkLabels catches named attribution-only labels", () => {
  const markdown = `## **🔥 今日焦点 TOP 3**

### 1. Cursor 推出代码托管平台 Origin
**平台已经上线。** [宝玉整理的技术细节](https://example.com/1)列出性能指标。

### 2. 豆包支持手机遥控电脑 Agent
**远程任务能跑了。** [宝玉的实测记录](https://example.com/2)展示操作路径。

### 3. 快手校招新增 AI 能力栏
**招聘要求变化了。** [Gorden Sun 的截图推文](https://example.com/3)展示新字段。`;

  const normalized = normalizeDailyTopEvidenceLinkLabels(markdown);

  for (const label of ["宝玉整理的技术细节", "宝玉的实测记录", "Gorden Sun 的截图推文"]) {
    assert.doesNotMatch(normalized, new RegExp(`\\[${label}\\]`));
  }
  assert.match(normalized, /\[Cursor 推出代码托管平台 Origin\]\(https:\/\/example\.com\/1\)/);
  assert.match(normalized, /\[豆包支持手机遥控电脑 Agent\]\(https:\/\/example\.com\/2\)/);
  assert.match(normalized, /\[快手校招新增 AI 能力栏\]\(https:\/\/example\.com\/3\)/);
});

test("ensureDailyTopHighlightDensity adds factual highlights without styling links", () => {
  const markdown = `## **🔥 今日焦点 TOP 3**

### 1. Origin 单仓库并发性能已经公开
**性能数字出来了。** 宝玉介绍，[Origin 达到每秒 22.6 次提交](https://example.com/1)，全球同步延迟低于 400 毫秒。内置 **自动合并冲突**机制。

### 2. Gemini 上线完整 SAT 模拟考试
**完整模拟题免费开放。** Google Gemini [公布了考试入口](https://example.com/2)。考后立即获得反馈，并能 **标注强弱项**。

### 3. AI 找到数学猜想反例
**八十年猜想被推翻。** [十项数学成果已经发布](https://example.com/3)。模型更擅长 **找到反例**，而不是构造证明，当前主要依靠穷举反例。`;

  const normalized = ensureDailyTopHighlightDensity(markdown);
  const items = extractNumberedDailyItems(normalized);

  assert.equal(items.length, 3);
  for (const item of items) {
    assert.equal((item.body.match(/\*\*[^*\r\n]+\*\*/g) || []).length, 3);
  }
  assert.match(normalized, /\*\*低于 400 毫秒\*\*/);
  assert.match(normalized, /\*\*立即获得反馈\*\*/);
  assert.match(normalized, /\*\*穷举反例\*\*/);
  assert.doesNotMatch(normalized, /\*\*\[[^\]]+\]\(/);
  assert.match(normalized, /\[Origin 达到每秒 22\.6 次提交\]\(https:\/\/example\.com\/1\)/);
});

test("ensureDailyTopHighlightDensity leaves an already balanced item unchanged", () => {
  const markdown = `## **🔥 今日焦点 TOP 1**

### 1. 模型价格已经下调
**调用成本降了。** [三档模型都下调调用费率](https://example.com/price)。最高降幅达到 **80%**，批量任务成本降低 **一半以上**。`;

  assert.equal(ensureDailyTopHighlightDensity(markdown), markdown);
});

test("ensureDailyTopHighlightDensity prefers useful facts over bare dates and author names", () => {
  const markdown = `## **🔥 今日焦点 TOP 2**

### 1. Cursor 发布代码托管平台 Origin
**Origin 正式开放体验。** [Origin 面向多 Agent 仓库](https://example.com/origin)，支持从 GitHub 无缝迁移仓库。底层来自 **Graphite 团队**，该团队在 2025 年加入 Cursor。

### 2. 宝玉实测 AI 下棋漏洞
**旧模型会被故意带偏。** [围棋对局视频展示了漏洞](https://example.com/go)。这说明早期模型存在 **对局漏洞**，可能遭到策略性欺骗。视频摄于 2023 年。`;

  const normalized = ensureDailyTopHighlightDensity(markdown);

  assert.match(normalized, /\*\*无缝迁移仓库\*\*/);
  assert.match(normalized, /\*\*策略性欺骗\*\*/);
  assert.doesNotMatch(normalized, /\*\*2025 年\*\*/);
  assert.doesNotMatch(normalized, /\*\*宝玉\*\*/);
});

test("ensureDailyTopHighlightDensity replaces low-value emotional highlights with facts", () => {
  const markdown = `## **🔥 今日焦点 TOP 1**

### 1. AI 找到数学猜想反例
**猜想被推翻。** [十项数学成果已经发布](https://example.com/math)。研究者称 **松了一口气**，模型主要依靠 **穷举反例**，而不是构造严格证明。`;

  const normalized = ensureDailyTopHighlightDensity(markdown);

  assert.doesNotMatch(normalized, /\*\*松了一口气\*\*/);
  assert.match(normalized, /\*\*严格证明\*\*/);
  assert.equal((normalized.match(/\*\*[^*\r\n]+\*\*/g) || []).length, 4);
});

test("ensureUniqueDailyTopSources replaces duplicate TOP sources with independent section items", () => {
  const markdown = `## **🔥 今日焦点 TOP 3**

### 1. 聚合稿里的模型价格

**价格准备调整。** [模型价格消息](https://example.com/digest)。

### 2. 聚合稿里的影像工具

**影像工具发布。** [影像工具消息](https://example.com/digest)。

### 3. 独立模型更新

**模型已经更新。** [独立更新说明](https://example.com/model)。

## **⚡ 产品与功能更新**

### 新工具加入批处理

**批处理已经开放。** [批处理能力说明](https://example.com/batch)。

## **◎ 行业变化与个人影响**

### 企业开始招聘 AI 编辑

**新岗位正在出现。** [招聘页面](https://example.com/job)。`;

  const normalized = ensureUniqueDailyTopSources(markdown);

  assert.equal((normalized.match(/https:\/\/example\.com\/digest/g) || []).length, 1);
  assert.match(normalized, /^### 3\. 新工具加入批处理$/m);
  assert.doesNotMatch(normalized, /^### 新工具加入批处理$/m);
  assert.match(normalized, /^### 企业开始招聘 AI 编辑$/m);
});

test("enforceDailyTopGithubLimit removes extra repositories without blocking the daily", () => {
  const markdown = `## **🔥 今日焦点 TOP 3**

### 1. 第一个 GitHub 日榜项目

**项目热度上涨。** [第一个项目](https://github.com/example/first)新增关注。

### 2. 第二个 GitHub 日榜项目

**另一个项目也上涨。** [第二个项目](https://github.com/example/second)进入日榜。

### 3. 官方模型更新

**模型能力更新。** [官方公告](https://example.com/model)列出变化。

## **❓ 相关问题**

### 模型更新后怎么用？

以官方公告为准。`;

  const normalized = enforceDailyTopGithubLimit(markdown);

  assert.match(normalized, /^## \*\*🔥 今日焦点 TOP 2\*\*$/m);
  assert.match(normalized, /^### 1\. 第一个 GitHub 日榜项目$/m);
  assert.match(normalized, /^### 2\. 官方模型更新$/m);
  assert.doesNotMatch(normalized, /第二个 GitHub 日榜项目|example\/second/);
  assert.match(normalized, /^## \*\*❓ 相关问题\*\*$/m);
});

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
