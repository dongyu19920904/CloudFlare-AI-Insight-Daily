import test from "node:test";
import assert from "node:assert/strict";

import {
  validateDailyPublication,
  validateAccountOpportunityPublication,
  validateOpportunityPublication,
} from "../src/publishValidation.js";

test("validateDailyPublication accepts the V3 topic structure", () => {
  const pageMarkdown = `## **今日摘要**

\`\`\`
今天最重要的模型更新已经落地。
产品与开源工具开始围绕真实工作流竞争。
读者可以先看焦点，再挑一个工具小范围试用。
\`\`\`

## **🔥 今日焦点 TOP 2**

### 1. [模型价格出现新变化](https://example.com/model-price)

**调用成本下降。** 官方公布了新的模型价格与可用范围，开发者可以据此重新计算现有任务成本。

### 2. [编码工具加入审阅能力](https://example.com/code-review)

**代码审阅进入日常流程。** 新功能可以先在小仓库验证，再决定是否扩大使用范围。

## **⚡ 产品与功能更新**

### [语音模型开放新接口](https://example.com/voice-api)

**新接口已经开放。** 适合正在评估实时语音交互的开发者先做延迟测试。

## **🧪 前沿研究与行业影响**

### [实验观察编码代理的理解影响](https://example.com/coding-study)

**实验记录了交付速度与代码理解之间的差异。** 使用代理时仍需要保留人工复核环节。

## **⌘ 开源 TOP 项目**

### [example/agent-kit：本地智能体工具箱](https://github.com/example/agent-kit)

**项目来自 GitHub 当日日榜。** 它提供本地工作流组件，适合希望自行部署的开发者试用。

## **❓ 相关问题**

### 如何体验今天提到的模型？

先从官方支持的使用入口确认地区、支付和账号要求，再用一个低风险任务测试输出质量与成本。

国内用户需要更省事的账号入口时，可以访问 **[爱窝啦 Aivora](https://aivora.cn)** 查看可用方案。`;

  const result = validateDailyPublication({
    summaryText: "今天最重要的模型更新已经落地。\n产品与开源工具开始围绕真实工作流竞争。\n读者可以先看焦点，再挑一个工具小范围试用。",
    pageMarkdown,
    minimumTopItems: 2,
    allowedTopGithubProjectUrls: ["https://github.com/example/agent-kit"],
    enforceTopGithubProjectAllowlist: true,
  });

  assert.equal(result.ok, true, result.issues.join("\n"));
});

test("validateDailyPublication accepts plain TOP headings with source links in item bodies", () => {
  const pageMarkdown = `## **今日摘要**

\`\`\`
今天模型价格和编程工具都出现值得验证的变化。
读者可以先确认官方能力，再用一个小任务测试。
\`\`\`

## **🔥 今日焦点 TOP 2**

### 1. 模型降价让调用成本再松一截

这次调整覆盖 **三款模型**。[模型价格调整详情](https://example.com/model-price) 显示最高降幅达到 **80%**，开发者可以重新核算现有任务成本。

### 2. 编码工具把审阅带进日常流程

新版增加 **自动审阅**。[编码工具更新说明](https://example.com/code-review) 列出了支持范围，适合先在 **小仓库** 验证再扩大使用。

## **⚡ 产品与功能更新**

### 语音模型开放实时接口

官方开放 **实时语音** 接口，[语音 API 使用说明](https://example.com/voice-api) 给出了延迟和地区要求，开发者可以先做小流量测试。

## **⌘ 开源 TOP 项目**

### example/agent-kit 补齐本地智能体组件

[example/agent-kit 项目仓库](https://github.com/example/agent-kit) 今日新增 **120 Stars**，适合需要本地工作流组件的开发者试用。

## **❓ 相关问题**

### 如何体验今天提到的模型？

先从官方入口确认地区、支付和账号要求，再用一个低风险任务测试输出质量与成本。国内用户需要更省事的入口时，可以访问 **[爱窝啦 Aivora](https://aivora.cn)** 查看可用方案。`;

  const result = validateDailyPublication({
    summaryText: "今天模型价格和编程工具都出现值得验证的变化，读者可以先确认官方能力，再用一个小任务测试。",
    pageMarkdown,
    minimumTopItems: 2,
    allowedTopGithubProjectUrls: ["https://github.com/example/agent-kit"],
    enforceTopGithubProjectAllowlist: true,
  });

  assert.equal(result.ok, true, result.issues.join("\n"));
});

test("validateDailyPublication reports style findings as non-blocking warnings", () => {
  const pageMarkdown = `## **今日摘要**

\`\`\`
今天的产品与研究都有可以核实的新变化，读者可以先看来源再决定是否试用。
\`\`\`

## **🔥 今日焦点 TOP 1**

### 1. 模型开放新的测试能力

**测试范围已经扩大。** [模型官方说明](https://example.com/model)列出了当前开放范围。这意味着开发者可以开始小范围验证，但仍要核对地区和任务限制。

## **⚡ 产品与功能更新**

### 工具新增批量处理入口

**批量入口已经上线。** [产品更新日志](https://example.com/product)说明了支持范围。值得关注的是团队可以先拿非敏感任务检查稳定性。

## **🧪 前沿研究**

### 新评测拆开感知和推理能力

**评测口径变得更细。** [研究页面](https://example.com/research)公布了样本与方法。可以看出总分不能替代具体失败样本的人工复核。

## **❓ 相关问题**

### 这个模型国内怎么用？

先从官方入口确认账号、地区和使用限制，再用低风险任务测试。需要比较公开服务时，可查看 [**爱窝啦·AI账号店**](https://www.aivora.cn/)，商品状态以官网为准。`;

  const result = validateDailyPublication({
    summaryText: "今天的产品与研究都有可以核实的新变化，读者可以先看来源再决定是否试用。",
    pageMarkdown,
    minimumTopItems: 1,
  });

  assert.equal(result.ok, true, result.issues.join("\n"));
  assert.match(result.warnings.join("\n"), /Daily writing style repeats generic judgment phrases/);
});

test("validateDailyPublication rejects a plain TOP item without a source link", () => {
  const pageMarkdown = `## **今日摘要**

\`\`\`
今天有一条模型更新值得验证，正文必须保留可核验来源。
\`\`\`

## **🔥 今日焦点 TOP 1**

### 1. 模型开放新的任务能力

这段正文有足够长度，但没有任何原始来源链接，因此不能作为完整的 TOP 条目发布。它还会继续补充一些说明文字，确保页面长度不是唯一失败原因。

## **⚡ 产品与功能更新**

### 语音模型开放新接口

[语音模型官方说明](https://example.com/voice-api) 给出了完整的接口范围，适合开发者先做小流量测试。

## **🧪 前沿研究与行业影响**

### 编码代理实验公布结果

[编码代理实验论文](https://example.com/coding-study) 记录了交付速度与代码理解之间的变化，使用代理时仍需要人工复核。

## **❓ 相关问题**

### 如何体验今天提到的模型？

先确认官方入口和地区要求，再使用一个低风险任务测试。国内用户也可以访问 **[爱窝啦 Aivora](https://aivora.cn)** 查看可用方案。`;

  const result = validateDailyPublication({
    summaryText: "今天有一条模型更新值得验证，正文必须保留可核验来源，读者可以先做小范围测试。",
    pageMarkdown,
    minimumTopItems: 1,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /TOP items must contain an original source link/i);
});

test("validateDailyPublication rejects non-daily GitHub projects in the V3 open-source section", () => {
  const pageMarkdown = `## **今日摘要**

\`\`\`
今天的模型和开源工具都有值得验证的新变化。
\`\`\`

## **🔥 今日焦点 TOP 1**

### 1. [模型开放新能力](https://example.com/model-update)

这是一条有真实来源的模型更新，正文说明新能力和读者今天可以验证的范围。

## **⚡ 产品与功能更新**

### [产品加入新的任务入口](https://example.com/product-update)

产品更新提供了新的任务入口，适合先用小任务检查效果。

## **⌘ 开源 TOP 项目**

### [example/search-only：普通搜索项目](https://github.com/example/search-only)

这个项目不是今天的 GitHub Trending Daily 候选，不应该进入开源日榜栏目。

## **❓ 相关问题**

### 如何体验今天提到的模型？

先确认官方入口和地区要求，再使用一个低风险任务测试。国内用户也可以访问 **[爱窝啦 Aivora](https://aivora.cn)** 查看可用方案。`;

  const result = validateDailyPublication({
    summaryText: "今天的模型和开源工具都有值得验证的新变化，读者可以先用一个小任务检查实际效果。",
    pageMarkdown,
    minimumTopItems: 1,
    allowedTopGithubProjectUrls: ["https://github.com/example/daily-project"],
    enforceTopGithubProjectAllowlist: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /open-source projects must come from today's GitHub Trending Daily/i);
});

test("validateDailyPublication rejects fallback refusal output", () => {
  const result = validateDailyPublication({
    summaryText: "I can't discuss that.",
    pageMarkdown: `## **今日摘要**

\`\`\`
I can't discuss that.
\`\`\`

## ⚡ 快速导航

- [📪 今日 AI 资讯](#今日ai资讯) - 最新动态速览
`,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /命中失败兜底文案/);
});

test("validateDailyPublication accepts a structured daily page", () => {
  const pageMarkdown = [
    "## **今日摘要**",
    "",
    "```",
    "今天微信 Agent 和开源框架都在加速，开发者生态正在快速成形。",
    "```",
    "",
    "## ⚡ 快速导航",
    "",
    "- [📪 今日 AI 资讯](#今日ai资讯) - 最新动态速览",
    "",
    "## **今日AI资讯**",
    "",
    "### **🤖 只有一句话**",
    "微信 Agent 开始走向大众平台。",
    "",
    "### **🔑 3 个关键词**",
    "#Agent #微信 #开源",
    "",
    "## **🔥 重磅 TOP 6**",
    "",
    "### 1. [一条新闻](https://example.com/news-1)",
    "这里是足够长的正文，这里是足够长的正文，这里是足够长的正文，这里是足够长的正文。",
    "这里是足够长的正文，这里是足够长的正文，这里是足够长的正文，这里是足够长的正文。",
    "这里是足够长的正文，这里是足够长的正文，这里是足够长的正文，这里是足够长的正文。",
    "",
    "## **📌 值得关注**",
    "",
    "- **[产品]** [一个补充动态](https://example.com/watch-1) - 这条补充动态没有和 TOP 重复。",
    "",
    "## **😄 AI趣闻**",
    "",
    "### [一个新的 AI 趣闻](https://example.com/fun-1)",
    "这个趣闻和前面的新闻不同，用来保证栏目结构完整。",
    "",
    "## **❓ 相关问题**",
    "",
    "### 如何体验 Claude 的电脑操控功能？",
    "",
    "Claude 的新能力目前仍有账号和使用门槛。",
    "",
    "**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取成品账号，极速发货，售后无忧。",
  ].join("\n");

  const result = validateDailyPublication({
    summaryText: "今天微信 Agent 和开源框架都在加速，开发者生态正在快速成形。",
    pageMarkdown,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.warnings, []);
});

test("validateDailyPublication accepts the V2 three-minute briefing without legacy wrappers", () => {
  const pageMarkdown = `## **⏱ 3分钟读懂今天**

- **发生了什么**：一家主流 AI 公司发布了新的编程助手能力，开发者可以直接在仓库里分派并检查任务。
- **为什么重要**：这把一次性问答推进到可追踪的工作流，团队能更快看见成本、质量与失败位置。
- **今天可以做**：挑一个十分钟能完成的小任务交给它，记录修改量和返工时间，再决定是否接入正式项目。

## **🔥 重磅 TOP 1**

### 1. [AI 编程助手增加任务工作流](https://example.com/news-v2)
过去开发者要在聊天窗口和代码仓库之间来回搬运上下文。新能力把任务、修改和审查放进同一条链路，今天就能用一个小修复验证它是否真的减少返工，而不是只看演示视频下结论。

## **📌 值得关注**

- **[产品]** [另一个开发工具更新](https://example.com/watch-v2) - 新增清晰的成本记录，适合先做小规模对比。

## **❓ 相关问题**

### 国内用户如何体验这类 AI 编程工具？

先确认工具支持的账号、支付方式和区域，再用一个非敏感的小项目测试效果，避免一开始就迁移正式代码。

**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取所需账号，先跑通再决定是否长期使用。`;

  const result = validateDailyPublication({
    summaryText: "今天 AI 编程助手开始进入可追踪任务流，适合先用一个小任务验证返工成本。",
    pageMarkdown,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.warnings, []);
});

test("validateDailyPublication warns on missing optional topic headings without blocking the main daily", () => {
  const result = validateDailyPublication({
    summaryText: "今天新闻足够多，日报必须保留完整栏目标题，否则重复内容会漏过校验。",
    pageMarkdown: `## **今日摘要**

\`\`\`
今天新闻足够多，日报必须保留完整栏目标题，否则重复内容会漏过校验。
\`\`\`

## ⚡ 快速导航
- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **👀 只有一句话**
今天的重点是栏目结构必须完整。

### **🔑 3 个关键词**
#结构 #去重 #日报

## **🔥 重磅 TOP 1**

### 1. [一条重要新闻](https://example.com/news-1)
这是一条足够长的重要新闻正文，用来保证校验聚焦在栏目标题缺失的问题上，而不是内容太短。这里继续补充正文，让它看起来像一条正常日报条目，并且不会触发其他结构问题。

---

**[产品]** [一个补充动态](https://example.com/watch-1) - 这里故意缺少值得关注二级标题。

### [一个趣闻](https://example.com/fun-1)
这里故意缺少 AI 趣闻二级标题。

## **❓ 相关问题**

### 如何体验今天提到的工具？

先确认官方入口，再选择适合自己的服务方式。

**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取成品账号。`,
    minimumTopItems: 1,
  });

  assert.equal(result.ok, true, result.issues.join("\n"));
  assert.match(result.warnings.join("\n"), /watch section heading/i);
  assert.doesNotMatch(result.issues.join("\n"), /AI fun section heading/i);
});

test("validateDailyPublication rejects empty secondary sections and FAQ", () => {
  const result = validateDailyPublication({
    summaryText: "今天 AI 行业主线明确，日报不能只保留栏目标题，必须给读者可读的补充内容和 FAQ。",
    pageMarkdown: `## **今日摘要**

\`\`\`
今天 AI 行业主线明确，日报不能只保留栏目标题，必须给读者可读的补充内容和 FAQ。
\`\`\`

## ⚡ 快速导航

- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **👀 只有一句话**
AI 工具正在从聊天窗口走向真实工作流。

### **🔑 3 个关键词**
#Agent #OpenAI #工作流

## **🔥 重磅 TOP 1**

### 1. [OpenAI 发布新的 Agent 工作流能力](https://example.com/openai-agent-workflow)
这是一条足够完整的 AI 产品新闻，正文说明它为什么重要，并且不依赖空栏目凑结构。开发者真正关心的是，Agent 是否能从简单对话变成可持续执行任务的工作流；这条新闻正好提供了新的观察窗口。这里继续补足正文长度，让校验聚焦在空栏目问题上，而不是内容太短。

## **📌 值得关注（5条）**

## **😄 AI趣闻**

## **❓ 相关问题**

`,
    minimumTopItems: 1,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /watch section must contain at least one source item/i);
  assert.doesNotMatch(result.issues.join("\n"), /AI fun section must contain at least one source item/i);
  assert.match(result.warnings.join("\n"), /AI fun section must contain at least one source item/i);
  assert.match(result.issues.join("\n"), /FAQ section must not be empty/i);
});

test("validateDailyPublication rejects GitHub flooding and merge-note placeholders in TOP", () => {
  const result = validateDailyPublication({
    summaryText: "今天模型、产品和开源项目都有更新，日报需要保留真正值得上榜的内容，并过滤重复占位条目。",
    pageMarkdown: `## **今日摘要**

\`\`\`
今天模型、产品和开源项目都有更新，日报需要保留真正值得上榜的内容，并过滤重复占位条目。
\`\`\`

## ⚡ 快速导航

- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **👀 只有一句话**
今天真正值得看的是模型能力、产品入口和一个最强开源项目的组合变化。

### **🔑 3 个关键词**
#模型 #开源 #产品

## **🔥 重磅 TOP 3**

### 1. [OpenAI 发布实时语音模型](https://example.com/openai-voice)
这条新闻说明实时语音、转录和同声传译正在进入产品化阶段，值得放在日报前列。这里补足正文长度，确保不是因为内容太短才触发校验失败，而是因为下面的结构问题。

### 2. [GitHub 开源项目 Alpha 登上热榜](https://github.com/example/alpha)
这个项目很热，但 TOP 里每天只应该保留最值得上榜的一个 GitHub 或开源项目。

### 3. [GitHub 开源项目 Beta 登上热榜](https://github.com/example/alpha)
⚠️ 此条与第1条为同一来源，已合并处理，见第1条。这里模拟模型把重复判断写进正文的错误输出，发布前应该被拦截。

## **📌 值得关注**

- **[产品]** [一个产品更新](https://example.com/product) - 作为补充动态保留，不重复 TOP 的核心故事。

## **😄 AI趣闻**

### [一个新的 AI 趣闻](https://example.com/fun)
这个趣闻和昨天不同，内容轻松但不重复。

## **❓ 相关问题**

### 如何体验这些 AI 工具？

优先确认官方入口，再考虑更省心的账号或服务方式。

**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取成品账号。`,
    minimumTopItems: 3,
  });

  assert.equal(result.ok, false);
  assert.match(result.warnings.join("\n"), /at most one GitHub\/open-source project item/i);
  assert.match(result.warnings.join("\n"), /same source URL/i);
  assert.match(result.issues.join("\n"), /merge-note placeholders/i);
});

test("validateDailyPublication rejects too many open-source projects in watch section", () => {
  const result = validateDailyPublication({
    summaryText: "今天日报主体保留一个核心事件，值得关注栏目可以补充动态，但开源项目不能连续刷屏。",
    pageMarkdown: `## **今日摘要**

\`\`\`
今天日报主体保留一个核心事件，值得关注栏目可以补充动态，但开源项目不能连续刷屏。
\`\`\`

## ⚡ 快速导航

- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **👀 只有一句话**
产品更新和开源生态都值得看，但同一个栏目不能被项目刷屏。

### **🔑 3 个关键词**
#产品 #生态 #筛选

## **🔥 重磅 TOP 1**

### 1. [一个重要产品更新](https://example.com/product-news)
这是一条足够完整的产品新闻，正文说明它为什么重要，并且不依赖 GitHub 项目来凑数。这里继续补足正文长度，让校验聚焦在值得关注栏目过多开源项目的问题上。

## **📌 值得关注**

- **[开源]** [项目 Alpha](https://github.com/example/alpha) - 新增能力很实用。
- **[开源]** [项目 Beta](https://github.com/example/beta) - Star 增长较快。
- **[开源]** [项目 Gamma](https://github.com/example/gamma) - 另一个 GitHub 项目，不应该继续堆在同一栏目。

## **😄 AI趣闻**

### [一个新的 AI 趣闻](https://example.com/fun-new)
这条趣闻和开源项目无关，用来测试栏目结构完整。

## **❓ 相关问题**

### 如何选择今天提到的工具？

先看是否真实解决你的工作流，再决定是否配置账号。

**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取成品账号。`,
    minimumTopItems: 1,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /watch section must contain at most two/i);
});

test("validateDailyPublication keeps welfare items out of TOP and limits them in watch section", () => {
  const result = validateDailyPublication({
    summaryText: "今天有一个 AI 产品更新，也有 LinuxDo 每日薅羊毛福利，福利可以提醒但不能挤进 TOP。",
    pageMarkdown: `## **今日摘要**

\`\`\`
今天有一个 AI 产品更新，也有 LinuxDo 每日薅羊毛福利，福利可以提醒但不能挤进 TOP。
\`\`\`

## ⚡ 快速导航

- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **👀 只有一句话**
产品主线归产品，羊毛福利归提醒，日报层级不能乱。

### **🔑 3 个关键词**
#产品 #福利 #筛选

## **🔥 重磅 TOP 2**

### 1. [重要 AI 产品更新](https://example.com/product-news)
这是一条正常产品新闻，适合进入 TOP。这里补足正文长度，让校验重点落在福利内容的位置上，而不是因为内容太短被拦截。

### 2. [LinuxDo 每日薅羊毛：一个 AI 福利](https://linux.do/t/free-ai-credit)
这个福利可以提醒读者，但不应该作为 TOP 新闻上榜，否则日报层级会变成福利列表。

## **📌 值得关注**

- **[其他]** [另一个限免福利](https://example.com/freebie) - 限免可以放一条，但不能连续堆。
- **[其他]** [第二个优惠福利](https://example.com/coupon) - 再来一条福利就超量了。

## **😄 AI趣闻**

### [一个新的 AI 趣闻](https://example.com/fun-fresh)
这条趣闻和福利无关，用来保证结构完整。

## **❓ 相关问题**

### 如何判断今天的 AI 工具值不值得试？

先看它是不是解决真实工作流，再看体验门槛。

**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取成品账号。`,
    minimumTopItems: 2,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /welfare\/freebie items should stay in watch section/i);
  assert.match(result.issues.join("\n"), /at most one welfare\/freebie item/i);
});

test("validateDailyPublication rejects meta commentary and missing FAQ section", () => {
  const result = validateDailyPublication({
    summaryText: "谷歌发了新模型，开源工具也不少。",
    pageMarkdown: `## **今日摘要**

\`\`\`
谷歌发了新模型，开源工具也不少。
\`\`\`

## ⚡ 快速导航

- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览

我看了一下素材，发现今天高质量新闻不够 10 条。

## **今日AI资讯**

### **👀 只有一句话**
今天高质量新闻不够多。

### **🔑 3 个关键词**
#AI #日报 #测试

## **🔥 重磅 TOP 6**

### 1. 一条新闻
这里是足够长的正文，这里是足够长的正文，这里是足够长的正文，这里是足够长的正文。
这里是足够长的正文，这里是足够长的正文，这里是足够长的正文，这里是足够长的正文。
这里是足够长的正文，这里是足够长的正文，这里是足够长的正文，这里是足够长的正文。`,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /包含禁止模式|元话术|AI思考/);
  assert.match(result.issues.join("\n"), /缺少必需片段: ## \*\*❓ 相关问题\*\*/);
});

test("validateDailyPublication rejects unnumbered Top items", () => {
  const result = validateDailyPublication({
    summaryText: "Claude 支付门槛在下降，AI 工具入口和工作流搭建都在继续加速。",
    pageMarkdown: `## **今日摘要**

\`\`\`
Claude 支付门槛在下降，AI 工具入口和工作流搭建都在继续加速。
\`\`\`

## ⚡ 快速导航

- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **👀 只有一句话**
- 入口变顺以后，真正拼的是谁先跑通。

### **🔑 3 个关键词**
- #Claude
- #支付
- #工作流

## **🔥 重磅 TOP 6**

### [Claude 微信支付实测](https://example.com/claude-pay)
这是一段足够长的正文，用来模拟一条可以发布的日报条目。这是一段足够长的正文，用来模拟一条可以发布的日报条目。

## **📌 值得关注**

- **[产品]** [Claude 微信支付实测](https://example.com/claude-pay) - 同一条链接不应该在别的栏目再出现。

## **😄 AI趣闻**

### [Claude 微信支付实测](https://example.com/claude-pay)
同一条链接也不应该在趣闻里再次出现。

## **❓ 相关问题**

### 如何体验 Claude？

Claude 目前更完整的体验通常还是要订阅。

**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取成品账号。`,
  });

  assert.equal(result.ok, false);
  assert.match(
    result.issues.join("\n"),
    /top items must use numbered headings/i
  );
});

test("validateDailyPublication rejects insufficient top items when enough material is expected", () => {
  const result = validateDailyPublication({
    summaryText: "OpenAI、Google 和 GitHub 项目更新很多，今天的候选素材明显够写满十条。",
    pageMarkdown: `## **今日摘要**

\`\`\`
OpenAI、Google 和 GitHub 项目更新很多，今天的候选素材明显够写满十条。
\`\`\`

## ⚡ 快速导航

- [📢 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **🧐 只有一句话**
今天明明有足够多的素材，日报不该只剩 7 条。

### **🧭 3 个关键词**
#OpenAI #GitHub #Top10

## **🔥 重磅 TOP 7**

### 1. [新闻 1](https://example.com/news-1)
这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文。

### 2. [新闻 2](https://example.com/news-2)
这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文。

### 3. [新闻 3](https://example.com/news-3)
这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文。

### 4. [新闻 4](https://example.com/news-4)
这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文。

### 5. [新闻 5](https://example.com/news-5)
这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文。

### 6. [新闻 6](https://example.com/news-6)
这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文。

### 7. [新闻 7](https://example.com/news-7)
这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文。

## **❓ 相关问题**

### 如何体验今天提到的工具？

先看官方入口，再决定要不要用更省事的成品服务。

**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取成品账号。`,
    minimumTopItems: 10,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /expected at least 10/i);
});

test("validateDailyPublication warns below quality targets without blocking an otherwise safe daily", () => {
  const topItems = Array.from({ length: 7 }, (_, index) => [
    `### ${index + 1}. [AI 新闻 ${index + 1}](https://example.com/quality-news-${index + 1})`,
    "这条内容提供了可核验的 AI 产品或行业变化，并说明读者今天可以据此调整什么判断或动作。",
  ].join("\n")).join("\n\n");
  const pageMarkdown = `## **今日摘要**

\`\`\`
今天的主体日报已经达到安全发布线，但仍值得尝试补足栏目丰富度。
\`\`\`

## **🔥 今日焦点 TOP 7**

${topItems}

## **⌘ 开源 TOP 项目**

### example/agent-kit：本地工作流组件

[example/agent-kit 项目仓库](https://github.com/example/agent-kit) 来自当日 GitHub 趋势榜。

## **◉ 社媒精选**

### 开发者实测新的上下文压缩方式

[开发者发布的完整实测](https://x.com/example/status/100) 展示了具体操作与结果。

## **⚡ 产品与功能更新**

今天没有可核验的产品条目。

## **❓ 相关问题**

### 今天提到的 AI 工具怎么试？

先通过官方入口确认账号、地区和订阅要求，再用一个低风险任务验证。可访问 [爱窝啦·AI账号店](https://www.aivora.cn/) 查看当前服务。`;

  const result = validateDailyPublication({
    summaryText: "今天的主体日报已经达到安全发布线，但仍值得尝试补足栏目丰富度和不同信息类型。",
    pageMarkdown,
    minimumTopItems: 10,
    hardMinimumTopItems: 6,
    minimumOpenSourceItems: 2,
    minimumSocialItems: 2,
    minimumResearchItems: 1,
    minimumIndustryItems: 1,
    minimumTopicSections: 3,
    allowedTopGithubProjectUrls: ["https://github.com/example/agent-kit"],
    enforceTopGithubProjectAllowlist: true,
  });

  assert.equal(result.ok, true, result.issues.join("\n"));
  assert.match(result.warnings.join("\n"), /Daily TOP is below target: expected 10, got 7/);
  assert.match(result.warnings.join("\n"), /open-source section is below target/);
  assert.match(result.warnings.join("\n"), /social section is below target/);
  assert.match(result.warnings.join("\n"), /research section is below target/);
  assert.match(result.warnings.join("\n"), /industry section is below target/);
  assert.match(result.warnings.join("\n"), /产品与功能更新 section must contain at least one source item/);
});

test("validateDailyPublication rejects repeated stories across primary sections", () => {
  const result = validateDailyPublication({
    summaryText: "同一件 OpenAI 融资新闻如果生成时没排重，可能会在多个栏目里换链接复读，但发布不应因为跨栏目重复直接失败。",
    pageMarkdown: `## **今日摘要**

\`\`\`
同一件 OpenAI 融资新闻如果生成时没排重，可能会在多个栏目里换链接复读，但发布不应因为跨栏目重复直接失败。
\`\`\`

## ⚡ 快速导航

- [📢 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **🧐 只有一句话**
今天最重要的是别把同一个故事写三遍。

### **🧭 3 个关键词**
#融资 #OpenAI #去重

## **🔥 重磅 TOP 1**

### 1. [OpenAI 完成 1250 亿美元融资](https://example.com/source-a)
这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文。

## **🎯 值得关注**

- **[商业]** [OpenAI 完成 1250 亿美元融资，估值继续走高](https://example.com/source-a) - 同一个故事只是换了来源，不应该再写一遍。

## **😆 AI趣闻**

### [OpenAI 完成 1250 亿美元融资后员工反应刷屏](https://example.com/source-a)
同一个核心事件如果只是换个讲法，也不应该再进趣闻栏目。

## **❓ 相关问题**

### 如何看懂今天的融资新闻？

先理解事件本身，再看和你的使用场景有什么关系。

**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取成品账号。`,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /primary sections reuse the same (source URL|story)/i);
});

test("validateDailyPublication rejects known non-AI topics in TOP", () => {
  const result = validateDailyPublication({
    summaryText: "今天的日报必须只保留真正与 AI 行业相关的内容，泛科技涨价新闻不能混进 TOP。",
    pageMarkdown: `## **今日摘要**

\`\`\`
今天的日报必须只保留真正与 AI 行业相关的内容，泛科技涨价新闻不能混进 TOP。
\`\`\`

## ⚡ 快速导航

- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **👀 只有一句话**
AI 行业判断必须围绕 AI 直接变化。

### **🔑 3 个关键词**
#模型 #Agent #筛选

## **🔥 重磅 TOP 1**

### 1. [任天堂全线涨价，Switch 2日本涨20%，美国9月跟进](https://example.com/nintendo-switch-price)
这条新闻讲的是游戏主机价格变化，不是 AI 模型、AI 产品、AI 公司或 AI 应用本身。即使正文可以强行联想到供应链成本，它也不应该进入 AI 日报 TOP 栏目。

## **📌 值得关注**

- **[产品]** [OpenAI Codex 使用体验更新](https://example.com/codex) - 这才是 AI 开发者真正需要关注的变化。

## **😄 AI趣闻**

### [一个新的 AI 趣闻](https://example.com/fun)
这条趣闻和 TOP 不重复，用来保证栏目结构完整。

## **❓ 相关问题**

### 如何体验 OpenAI Codex？

Codex 当前适合开发者处理异步编程任务，完整体验通常需要付费订阅和稳定访问环境。

**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取成品账号，极速发货，售后无忧。`,
    minimumTopItems: 1,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /known non-AI topic/i);
});

test("validateDailyPublication rejects known non-AI lifestyle topics in secondary sections", () => {
  const result = validateDailyPublication({
    summaryText: "今天 AI 行业主线清晰，二级栏目也不能用生活方式内容凑数。",
    pageMarkdown: `## **今日摘要**

\`\`\`
今天 AI 行业主线清晰，二级栏目也不能用生活方式内容凑数。
\`\`\`

## ⚡ 快速导航
- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **👀 只有一句话**
OpenAI Agent 工作流继续扩展。
### **🔑 3 个关键词**
#OpenAI #Agent #Codex
## **🔥 重磅 TOP 1**

### 1. [OpenAI 发布新的 Agent 工作流能力](https://example.com/openai-agent-workflow)
这是一条足够完整的 AI 产品新闻，正文说明它为什么重要，并且不依赖空栏目凑结构。开发者真正关心的是，Agent 是否能从简单对话变成可持续执行任务的工作流；这条新闻正好提供了新的观察窗口。这里继续补足正文长度，让校验聚焦在二级栏目内容是否跑偏上。
## **📌 值得关注**

- **[其他]** [告别盲目锻炼，这份周练计划直接照做](https://example.com/workout-plan) - 跟 AI 打交道的人大多久坐，这份计划可以顺手看看。
## **😄 AI趣闻**

### [一个新的 AI 趣闻](https://example.com/fun)
这条趣闻和 TOP 不重复，用来保证栏目结构完整。
## **❓ 相关问题**

### 如何体验今天提到的 AI 工具？
先确认官方入口，再考虑适合自己的服务方式。
**解决方案**：访问 **[爱窝窝 Aivora](https://aivora.cn)** 获取成品账号，极速发货，售后无忧。`,
    minimumTopItems: 1,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /watch section contains a known non-AI topic/i);
});

test("validateDailyPublication rejects GPT-4o as stale FAQ default", () => {
  const result = validateDailyPublication({
    summaryText: "今天的主线是 GPT-5.5 和 Codex 工作流，FAQ 不应该继续默认推荐 GPT-4o。",
    pageMarkdown: `## **今日摘要**

\`\`\`
今天的主线是 GPT-5.5 和 Codex 工作流，FAQ 不应该继续默认推荐 GPT-4o。
\`\`\`

## ⚡ 快速导航

- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **👀 只有一句话**
GPT-5.5 和 Codex 正在把开发流程推向异步协作。

### **🔑 3 个关键词**
#GPT55 #Codex #开发者

## **🔥 重磅 TOP 1**

### 1. [OpenAI Codex 异步编程工作流继续扩散](https://example.com/codex-workflow)
越来越多开发者开始把小任务交给 Codex 并行处理，这不是演示概念，而是工作方式变化。它真正值得关注的地方在于，开发者从盯着模型输出，转向管理一组可并行推进的任务。

## **📌 值得关注**

- **[产品]** [GPT-5.5 使用体验讨论升温](https://example.com/gpt55) - 用户更关心稳定推理和长任务完成度。

## **😄 AI趣闻**

### [一个新的 AI 趣闻](https://example.com/fun-2)
这条趣闻和 TOP 不重复，用来保证栏目结构完整。

## **❓ 相关问题**

### 如何体验 ChatGPT Plus？

ChatGPT Plus 可以使用 GPT-4o 等模型，适合日常学习、办公和代码辅助。

**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取成品账号，极速发货，售后无忧。`,
    minimumTopItems: 1,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /outdated GPT-4o/i);
});

test("validateDailyPublication warns when AI fun falls back to paper-like sources", () => {
  const result = validateDailyPublication({
    summaryText: "今天 Agent 产品和多模态能力都有更新，日报需要保留轻松但真实的观察入口。",
    pageMarkdown: `## **今日摘要**

\`\`\`
今天 Agent 产品和多模态能力都有更新，日报需要保留轻松但真实的观察入口。
\`\`\`

## ⚡ 快速导航

- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **👀 只有一句话**
AI 工具正在继续进入真实工作流。

### **🔑 3 个关键词**
#Agent #多模态 #开发者

## **🔥 重磅 TOP 1**

### 1. [OpenAI 发布新的 Agent 工作流能力](https://example.com/openai-agent-workflow)
这是一条足够完整的 AI 产品新闻，正文说明它为什么重要，并且不依赖空栏目凑结构。开发者真正关心的是，Agent 是否能从简单对话变成可持续执行任务的工作流；这条新闻正好提供了新的观察窗口。

## **📌 值得关注**

- **[产品]** [一个补充动态](https://example.com/watch-1) - 这条补充动态没有和 TOP 重复。

## **😄 AI趣闻**

### [RxEval: A Prescription-Level Benchmark for Evaluating LLM Medication Recommendation](https://arxiv.org/abs/2605.14543)
题目看着很学术，场景其实挺现实：AI 如果要进医院帮忙看用药，不能只会给一个“差不多”的建议。

## **❓ 相关问题**

### 如何体验今天提到的 Agent 工作流？

可以先从主流 AI 工具开始，确认账号、地区和付费门槛，再决定是否接入自己的工作流。

**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取成品账号，极速发货，售后无忧。`,
    minimumTopItems: 1,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.match(result.warnings.join("\n"), /AI fun section uses a paper\/arXiv source/i);
});

test("validateOpportunityPublication rejects gray phrasing and missing required fields", () => {
  const result = validateOpportunityPublication({
    markdown: `## 今日主推
### 一个机会
- 最简单卖法：便宜 token
`,
    bannedPublicPhrases: ["便宜 token", "风险自负", "多用户商业化"],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /包含禁止片段: 便宜 token/);
  assert.match(result.issues.join("\n"), /缺少必需片段: 证据与可信度/);
});

test("validateOpportunityPublication accepts an evidence-first opportunity brief", () => {
  const markdown = `## 直接结论
今天值得验证的不是卖安装教程，而是为内容团队交付一个可验收样片。
- **做不做：** 先做一次样品验证，不先上架。
- **先验证：** 目标用户是否愿意提供真实脚本并接受范围明确的样片。
- **何时停：** 五位目标用户都没有试用或询价意愿就停止。

## 今日主推
### 给内容团队交付一支可验收样片
原项目已经提供可运行的桌面工作流，但“项目能跑”不等于“有人愿意买”。先把它当生产工具，验证客户是否愿意为首支样片省时间。

- **证据与可信度：** 中；[官方仓库：证明项目代码、教程与许可说明可核验](https://github.com/HBAI-Ltd/Toonflow-app)；本次候选输入未提供目标用户付费证据。
- **鱼塘与笨办法：** 待验证假设：小型内容团队可能仍在多人传脚本、素材和修改意见。
- **最小交付：** 一支三镜头样片、实际耗时、模型成本和失败记录，不包含长期代运营。
- **48小时验证：** 复现官方教程后，把样片给五位内容团队负责人看，询问是否愿意提供真实脚本试做。
- **第一单与复购：** 固定一个脚本、三镜头和一次修改，以交付可播放样片为验收标准；若同类脚本重复出现，再沉淀配置、错误库和成本表，否则只是一次性服务。
- **风险与停止：** 中，需要核对素材版权和商业分发许可；无法复现、成本不可控，或五位目标用户都没有试做意愿就停。

## 本周小试
今天没有第二个达到证据门槛的机会，不凑数。

## 今天别碰
今天没有额外需要点名的高风险方向。

## 今日三步
- **今天确认：** 核对原项目许可与商业分发边界。
- **今天制作：** 只做一支三镜头样片并记录真实成本。
- **今天询价：** 找五位内容团队负责人问是否愿意拿真实脚本试做。`;
  const validationOptions = {
    markdown,
    bannedPublicPhrases: ["便宜 token", "风险自负", "多用户商业化"],
    allowedSourceUrls: ["https://github.com/HBAI-Ltd/Toonflow-app"],
    sourceEvidence: [
      {
        url: "https://github.com/HBAI-Ltd/Toonflow-app",
        isPrimary: true,
      },
    ],
  };
  const result = validateOpportunityPublication(validationOptions);

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);

  const unsupportedMarketClaim = validateOpportunityPublication({
    ...validationOptions,
    markdown: markdown.replace(
      "待验证假设：小型内容团队可能仍在多人传脚本、素材和修改意见。",
      "目前没有针对中文内容团队的现成方案，内容团队反复手动传脚本、素材和修改意见。"
    ),
  });
  assert.equal(unsupportedMarketClaim.ok, false);
  assert.match(
    unsupportedMarketClaim.issues.join("\n"),
    /未经需求证据支持的市场缺口或群体痛点/
  );

  const unsupportedPainTitle = validateOpportunityPublication({
    ...validationOptions,
    markdown: markdown.replace(
      "### 给内容团队交付一支可验收样片",
      "### 帮反复手工传素材的内容团队交付样片"
    ),
  });
  assert.equal(unsupportedPainTitle.ok, false);
  assert.match(
    unsupportedPainTitle.issues.join("\n"),
    /未经需求证据支持的市场缺口或群体痛点/
  );
});

test("validateDailyPublication enforces daily trending allowlist for GitHub TOP projects", () => {
  const markdown = [
    "## **今日摘要**",
    "",
    "```",
    "今天 GitHub 项目很多，但 TOP 只能用当天日榜里的 AI 相关项目。",
    "```",
    "",
    "## ⚡ 快速导航",
    "",
    "- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览",
    "",
    "## **今日AI资讯**",
    "",
    "### **👀 只有一句话**",
    "Claude Code 生态继续升温。",
    "",
    "### **🔑 3 个关键词**",
    "#ClaudeCode #GitHub日榜 #AI项目",
    "",
    "## **🔥 重磅 TOP 1**",
    "",
    "### 1. [Search 里来的 Claude 项目](https://github.com/example/search-only)",
    "这条仓库链接不是当天 GitHub 日榜候选，不能写进 TOP。这里补足正文长度，让校验聚焦在来源限制上。",
    "",
    "## **📌 值得关注**",
    "",
    "- **[产品]** [一个补充动态](https://example.com/watch-1) - 这条补充动态没有和 TOP 重复。",
    "",
    "## **❓ 相关问题**",
    "",
    "### 如何体验 Claude Code？",
    "可以访问 [爱窝啦 Aivora](https://aivora.cn) 获取账号支持，适合国内用户快速体验。",
  ].join("\n");

  const result = validateDailyPublication({
    summaryText: "今天 GitHub 项目很多，但 TOP 只能用当天日榜里的 AI 相关项目。",
    pageMarkdown: markdown,
    minimumTopItems: 1,
    allowedTopGithubProjectUrls: ["https://github.com/example/daily-trending"],
    enforceTopGithubProjectAllowlist: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /GitHub project must come from today's GitHub Trending Daily/i);
});

test("validateDailyPublication accepts allowlisted daily trending GitHub TOP project", () => {
  const markdown = [
    "## **今日摘要**",
    "",
    "```",
    "今天 GitHub 日榜里出现了一个 AI 编程项目，值得开发者关注。",
    "```",
    "",
    "## ⚡ 快速导航",
    "",
    "- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览",
    "",
    "## **今日AI资讯**",
    "",
    "### **👀 只有一句话**",
    "Claude Code 生态继续升温。",
    "",
    "### **🔑 3 个关键词**",
    "#ClaudeCode #GitHub日榜 #AI项目",
    "",
    "## **🔥 重磅 TOP 1**",
    "",
    "### 1. [日榜里的 Claude 项目](https://github.com/example/daily-trending)",
    "这条仓库来自当天 GitHub 日榜候选，主题也直接指向 AI 编程工具。它适合进入 TOP，而不是从搜索结果里反复抓老项目。这里补足正文长度，保证页面结构完整。",
    "",
    "## **📌 值得关注**",
    "",
    "- **[产品]** [一个补充动态](https://example.com/watch-1) - 这条补充动态没有和 TOP 重复。",
    "",
    "## **❓ 相关问题**",
    "",
    "### 如何体验 Claude Code？",
    "可以访问 [爱窝啦 Aivora](https://aivora.cn) 获取账号支持，适合国内用户快速体验。",
  ].join("\n");

  const result = validateDailyPublication({
    summaryText: "今天 GitHub 日榜里出现了一个 AI 编程项目，值得开发者关注。",
    pageMarkdown: markdown,
    minimumTopItems: 1,
    allowedTopGithubProjectUrls: ["https://github.com/example/daily-trending"],
    enforceTopGithubProjectAllowlist: true,
  });

  assert.equal(result.ok, true);
});

test("validateOpportunityPublication keeps titles plain and source links in evidence fields", () => {
  const result = validateOpportunityPublication({
    markdown: `## 直接结论
今天先验证一个内容交付样品。

## 今日主推
### [把视频工作流变成样片](https://github.com/example/video-workflow)
- **可验证信号：** 项目发布。
- **证据来源：** [官方仓库](https://github.com/example/video-workflow)
- **可信度：** 中
- **目标鱼塘与笨办法：** 内容团队手工协作。
- **最小交付：** 三镜头样片。
- **48小时验证：** 找五位用户看样片。
- **第一单：** 固定范围样片。
- **复购或资产：** 沉淀配置。
- **证据缺口：** 无付费证据。
- **售后与合规风险：** 中。
- **停止条件：** 无人愿意试用。

## 本周小试
今天没有第二个达到证据门槛的机会，不凑数。

## 今天别碰
今天没有额外需要点名的高风险方向。

## 今日三步
- **今天确认：** 许可。
- **今天制作：** 样片。
- **今天询价：** 问五位用户。`,
    allowedSourceUrls: ["https://github.com/example/video-workflow"],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /标题必须是纯文本/);
});

const validAccountOpportunityMarkdown = `## 30 秒结论

- **今天发生什么：** OpenAI 官方更新了 ChatGPT 订阅额度说明。
- **今天做什么：** 先修改现有 FAQ，不新增无法证明需求的商品。
- **最大风险：** 把官方套餐变化误写成闲鱼销量或账号稳定性承诺。

## 今日硬信号

- [OpenAI 官方订阅说明证明额度字段已更新](https://openai.com/news/subscription-quota-update)，但它不证明二手市场需求。

## 今日可执行

### 先修改套餐 FAQ，不急着新增商品

**判断：** 今天适合核对现有商品说明，不适合凭一次更新猜测买家需求。

- **证据与可信度：** [OpenAI 官方订阅说明证明额度字段已更新](https://openai.com/news/subscription-quota-update)；可信度：高；本次候选没有真实询价记录。
- **供给形态：** 官方订阅。
- **适合买家与真实需求：** 适合正在比较套餐额度的用户；是否愿意购买仍是待验证假设。
- **是否今天能挂闲鱼：** 观察；先核对旧商品说明。
- **今天最小动作：** 修改一个额度 FAQ，并记录当天出现的真实询问。
- **售后与合规：** 售后风险：中；交付说明必须与官方套餐和平台条款一致。
- **不能承诺与停止：** 不承诺额度长期不变；48 小时内没有明确询问就停止制作新商品页。

## 买家避坑

- 付款前核对卖家交付的是官方订阅、账号、API 还是代配置服务。
- 要求卖家写清套餐、使用范围、退款条件和不能承诺的事项。

## 今天别碰

- 今天没有额外需要点名的高风险方向。

## 今日三步

- **今天确认：** 对照官方页面核对现有商品中的额度描述。
- **今天修改：** 删除一个无法由官方页面支持的稳定性承诺。
- **今天记录：** 记录真实询问及买家最关心的套餐差异。`;

test("validateAccountOpportunityPublication accepts evidence-first account actions", () => {
  const sourceUrl = "https://openai.com/news/subscription-quota-update";
  const result = validateAccountOpportunityPublication({
    markdown: validAccountOpportunityMarkdown,
    allowedSourceUrls: [sourceUrl],
    allowedRejectedSourceUrls: [],
    sourceEvidence: [
      {
        url: sourceUrl,
        tier: "primary",
        isPrimary: true,
        reason: "官方来源",
      },
    ],
    aivoraLinkPolicy: { allowedUrls: [] },
  });

  assert.equal(result.ok, true, result.issues.join("\n"));
  assert.equal(result.opportunityCount, 1);
});

test("validateAccountOpportunityPublication rejects linked titles and weak critical facts", () => {
  const weakUrl = "https://example.com/claude-price-rumor";
  const invalid = validAccountOpportunityMarkdown
    .replace("### 先修改套餐 FAQ，不急着新增商品", `### [Claude 已经降价](https://example.com/claude-price-rumor)`)
    .replaceAll("https://openai.com/news/subscription-quota-update", weakUrl)
    .replaceAll("OpenAI 官方订阅说明", "社交转述");
  const result = validateAccountOpportunityPublication({
    markdown: invalid,
    allowedSourceUrls: [weakUrl],
    allowedRejectedSourceUrls: [],
    sourceEvidence: [
      {
        url: weakUrl,
        tier: "social",
        isPrimary: false,
        reason: "社交线索",
      },
    ],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /标题必须是纯文本/);
  assert.match(result.issues.join("\n"), /每条硬信号都必须引用官方页面或原项目/);
  assert.match(result.issues.join("\n"), /必须引用对应官方页面/);
});

test("validateAccountOpportunityPublication rejects unsafe trading advice and invented seller prices", () => {
  const invalid = validAccountOpportunityMarkdown
    .replace("修改一个额度 FAQ", "提供绕过风控步骤并共享账号")
    .replace("先核对旧商品说明", "建议售价 9.9 元");
  const result = validateAccountOpportunityPublication({
    markdown: invalid,
    allowedSourceUrls: ["https://openai.com/news/subscription-quota-update"],
    allowedRejectedSourceUrls: [],
    sourceEvidence: [
      {
        url: "https://openai.com/news/subscription-quota-update",
        tier: "primary",
        isPrimary: true,
      },
    ],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /不得提供共享滥用/);
  assert.match(result.issues.join("\n"), /不得编造或建议具体卖家售价/);
});

test("validateAccountOpportunityPublication rejects unsupported sales claims but allows warnings", () => {
  const invalid = validAccountOpportunityMarkdown.replace(
    "本次候选没有真实询价记录",
    "闲鱼实时销量已经爆发"
  );
  const result = validateAccountOpportunityPublication({
    markdown: invalid,
    allowedSourceUrls: ["https://openai.com/news/subscription-quota-update"],
    allowedRejectedSourceUrls: [],
    sourceEvidence: [
      {
        url: "https://openai.com/news/subscription-quota-update",
        tier: "primary",
        isPrimary: true,
      },
    ],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /不得编造销量/);
});

test("validateOpportunityPublication accepts a clearly bounded observation edition", () => {
  const sourceUrl = "https://github.com/acme/observe-only";
  const result = validateOpportunityPublication({
    markdown: `## 直接结论

- **直接答案：** 今天没有新的差异化商机，不凑数。只观察一个新实体是否带来不同需求。
- **做不做：** 不启动新交付，也不把同类方案换标题重发。
- **先验证：** 先找三位目标用户核对问题是否真实存在。
- **何时停：** 三位用户都没有不同需求就停止。

## 今日主推

### 观察：核验新实体是否形成不同需求

**判断：** 项目本身可核验，但近七天已经出现同类交付，今天只做需求观察。

- **证据与可信度：** 中；[官方仓库证明项目与公开说明存在](${sourceUrl})；本次候选输入未提供目标用户付费证据。
- **鱼塘与笨办法：** 待验证假设：小团队可能需要核对这项能力是否解决不同于旧方案的问题。
- **最小交付：** 一页需求核对表，不提供部署或代运营。
- **48小时验证：** 找三位目标用户访谈，记录他们是否提出不同于旧方案的验收结果。
- **第一单与复购：** 尚不进入成交阶段；只有出现新的可验收需求才重新评估。
- **风险与停止：** 风险中；若没有不同需求，立即停止，不把旧交付换壳。

## 本周小试

今天没有第二个达到证据门槛的机会，不凑数。

## 今天别碰

今天没有额外需要点名的高风险方向。

## 今日三步

- **今天确认：** 核对项目公开说明与可复现范围。
- **今天制作：** 只做一页需求核对表。
- **今天询价：** 问三位目标用户是否存在不同验收需求。`,
    allowedSourceUrls: [sourceUrl],
    allowedRejectedSourceUrls: [],
    sourceEvidence: [
      {
        url: sourceUrl,
        tier: "primary",
        isPrimary: true,
        reason: "原项目",
      },
    ],
    observationMode: true,
  });

  assert.equal(result.ok, true, result.issues.join("\n"));
});

const validAccountObservationMarkdown = `## 30 秒结论

- **今天发生什么：** 今天只有待核验线索，没有官方确认的新变化。
- **今天做什么：** 不新增商品，只核对现有 FAQ 的证据边界。
- **最大风险：** 把社区讨论误写成官方事实，给售后留下无法兑现的承诺。

## 今日硬信号

- 今天没有取得可由官方页面确认的账号、价格、额度或政策新变化；不新增商品。

## 今日可执行

### 观察：核对一条社区讨论，不新增商品

**判断：** 这只是待核验线索，今天不把它写进商品承诺。

- **证据与可信度：** [社区页面只证明有人提出这条线索](https://example.com/account-clue)；可信度：低；仍缺官方确认。
- **供给形态：** 官方订阅。
- **适合买家与真实需求：** 是否影响现有买家仍是待验证假设，先记录真实询问。
- **是否今天能挂闲鱼：** 观察；不新增商品。
- **今天最小动作：** 检查现有 FAQ，把无法追溯到官方页面的句子标记待核验。
- **售后与合规：** 售后风险：中；不得把社区线索当成平台承诺。
- **不能承诺与停止：** 不承诺线索已经生效；48 小时内没有官方确认就停止跟进。

## 买家避坑

- 购买前要求卖家说明信息来自官方页面还是社区讨论。
- 无法给出官方依据的承诺，只能当作待核验线索。

## 今天别碰

- 今天没有额外需要点名的高风险方向。

## 今日三步

- **今天确认：** 检查官方页面是否出现对应说明。
- **今天修改：** 标记现有 FAQ 中没有官方依据的句子。
- **今天记录：** 记录买家是否真的问到这项变化。`;

test("validateAccountOpportunityPublication accepts observation without an invented hard signal", () => {
  const sourceUrl = "https://example.com/account-clue";
  const result = validateAccountOpportunityPublication({
    markdown: validAccountObservationMarkdown,
    allowedSourceUrls: [sourceUrl],
    allowedRejectedSourceUrls: [],
    sourceEvidence: [
      {
        url: sourceUrl,
        tier: "social",
        isPrimary: false,
        reason: "待核验线索",
      },
    ],
    observationMode: true,
  });

  assert.equal(result.ok, true, result.issues.join("\n"));
});

test("validateAccountOpportunityPublication allows an explicitly unconfirmed sensitive clue in observation mode", () => {
  const sourceUrl = "https://example.com/account-clue";
  const result = validateAccountOpportunityPublication({
    markdown: validAccountObservationMarkdown.replace(
      "社区页面只证明有人提出这条线索",
      "社区页面只证明有人讨论额度变化，尚未获官方确认"
    ),
    allowedSourceUrls: [sourceUrl],
    allowedRejectedSourceUrls: [],
    sourceEvidence: [
      {
        url: sourceUrl,
        tier: "social",
        isPrimary: false,
        reason: "待核验线索",
      },
    ],
    observationMode: true,
  });

  assert.equal(result.ok, true, result.issues.join("\n"));
});

test("validateAccountOpportunityPublication still rejects a positive sensitive claim in observation mode", () => {
  const sourceUrl = "https://example.com/account-clue";
  const result = validateAccountOpportunityPublication({
    markdown: validAccountObservationMarkdown.replace(
      "社区页面只证明有人提出这条线索",
      "社区页面证明官方额度已经翻倍"
    ),
    allowedSourceUrls: [sourceUrl],
    allowedRejectedSourceUrls: [],
    sourceEvidence: [
      {
        url: sourceUrl,
        tier: "social",
        isPrimary: false,
        reason: "待核验线索",
      },
    ],
    observationMode: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /必须引用对应官方页面/);
});

test("validateAccountOpportunityPublication forbids listing in observation mode", () => {
  const sourceUrl = "https://example.com/account-clue";
  const result = validateAccountOpportunityPublication({
    markdown: validAccountObservationMarkdown.replace(
      "是否今天能挂闲鱼：** 观察",
      "是否今天能挂闲鱼：** 是"
    ),
    allowedSourceUrls: [sourceUrl],
    allowedRejectedSourceUrls: [],
    sourceEvidence: [
      {
        url: sourceUrl,
        tier: "social",
        isPrimary: false,
        reason: "待核验线索",
      },
    ],
    observationMode: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /不得建议今天上架/);
});
