import test from "node:test";
import assert from "node:assert/strict";

import {
  validateDailyPublication,
  validateOpportunityPublication,
} from "../src/publishValidation.js";

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

test("validateDailyPublication rejects missing watch and AI fun section headings", () => {
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

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /watch section heading/i);
  assert.match(result.issues.join("\n"), /AI fun section heading/i);
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
  assert.match(result.issues.join("\n"), /AI fun section must contain at least one source item/i);
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

test("validateOpportunityPublication rejects gray phrasing and missing required fields", () => {
  const result = validateOpportunityPublication({
    markdown: `# 今日AI商机

## 今日主推
### 一个机会
- 最简单卖法：便宜 token
`,
    bannedPublicPhrases: ["便宜 token", "风险自负", "多用户商业化"],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /包含禁止片段: 便宜 token/);
  assert.match(result.issues.join("\n"), /缺少必需片段: 这钱从哪来/);
});

test("validateOpportunityPublication accepts the lighter daily-style opportunity structure", () => {
  const result = validateOpportunityPublication({
    markdown: `# 今日AI商机

## 先说结论
今天最值得试的，不是追模型热词，而是卖微信跑通包。

## 今日主推
### 微信跑通包
不是卖概念，是卖“帮别人今天就跑通”。很多人卡在配置这一步，你卖的是省时间、少踩坑和马上能用。

- 适合谁：已经买了 Claude 或 OpenClaw，但不会接进微信的人
- 这钱从哪来：买家不是不想用 AI，而是不想自己折腾配置。你把“跑通”这件事做成结果，就有成交空间
- 最简单卖法：先卖跑通包，不要一上来卖复杂定制
- 今天先做哪一步：录一个 3 分钟跑通视频，证明你真的能弄好
- 今天就能发的文案：Claude 现在能接进微信了，我这边已经整理好跑通版，不想折腾配置的直接拿现成
- 配图建议：用接入成功界面截图，证明这不是空口说法

## 本周可试
### 技能包精选安装包
这不是卖“技能市场很火”，而是卖“我帮你选好最实用的 5 个”。这类更适合先做小合集，先看哪类最容易成交。

- 适合谁：已经在用 Claude 或 OpenClaw，但不会挑技能和模板的人
- 先怎么试：先做 1 份“5 个最实用技能包合集”，别做大全
- 为什么先别冲太猛：先看哪类技能更容易成交，是办公、内容还是开发辅助
- 配图建议：用技能市场截图，帮助读者理解这是什么

## 今天别碰
### 只聊模型跑分
看着热，但小白看完还是不知道今天能卖什么，也不知道第一单从哪来。

## 地图感
### 技能市场
把它理解成 AI 世界里的小插件市场就行。以后很多商机都会从“技能包、模板包、安装包”里长出来。

## 今日动作
- 先发什么：微信跑通包
- 先录什么：跑通录屏
- 先卖哪一款：29 元低价引流款`,
    bannedPublicPhrases: ["便宜 token", "风险自负", "多用户商业化"],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});
