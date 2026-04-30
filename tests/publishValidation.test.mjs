import test from "node:test";
import assert from "node:assert/strict";

import {
  validateDailyPublication,
  validateAccountOpportunityPublication,
  validateOpportunityPublication,
} from "../src/publishValidation.js";

function buildDailyValidationPage({ topItems, moreItems }) {
  const topMarkdown = topItems
    .map(
      (item, index) => [
        `### ${index + 1}. [${item.title}](${item.url})`,
        "这是一段足够长的日报正文，用来模拟真实发布内容。它会说明这条消息的新意、读者为什么今天需要知道，以及下一步可以关注什么变化，避免测试样例因为正文太短被误伤。",
      ].join("\n")
    )
    .join("\n\n");
  const moreMarkdown = moreItems
    .map(
      (item) =>
        `- **[${item.category || "其他"}]** [${item.title}](${item.url}) - 这条补充了 TOP 没覆盖的角度，也保持了真实链接和独立主题。`
    )
    .join("\n");

  return [
    "## **今日摘要**",
    "",
    "```",
    "今天 AI 工具、模型和开源生态都有更新，日报结构完整，内容可以直接发布给读者阅读。",
    "```",
    "",
    "## ⚡ 快速导航",
    "",
    "- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览",
    "",
    "## **今日AI资讯**",
    "",
    "### **👀 只有一句话**",
    "今天真正值得关注的是不同类型信号一起出现，而不是单一来源刷屏。",
    "",
    "### **🔎 3 个关键词**",
    "#模型 #开源 #工具",
    "",
    `## **🔥 重磅 TOP ${topItems.length}**`,
    "",
    topMarkdown,
    "",
    "## **📊 更多动态**",
    "",
    moreMarkdown,
    "",
    "## **😄 AI趣闻**",
    "",
    "### [一个轻松但真实的 AI 小插曲](https://example.com/fun-unique)",
    "一个开发者把自动化流程跑通后，第一反应不是庆祝，而是先检查有没有写错配置。这个小场景很轻，但能让读者看到工具更新背后真实的人。",
    "",
    "## **❓ 相关问题**",
    "",
    "### 今天提到的 AI 工具怎么体验？",
    "",
    "先确认官方入口和适用门槛，再判断是否需要成品服务辅助。",
    "",
    "**解决方案**：访问 **[爱窝客 Aivora](https://aivora.cn)** 获取成品账号。",
  ].join("\n");
}

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
    "## **📊 更多动态**",
    "",
    "- **[开源]** [另一个项目](https://example.com/watch-1) - 这条补充了 TOP 未覆盖的开发者工具。",
    "",
    "## **😄 AI趣闻**",
    "",
    "### [一个轻松观察](https://example.com/fun-1)",
    "这条用轻一点的方式补充今天的产品变化，不重复 TOP 的同一条链接。",
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
});

test("validateDailyPublication rejects more than one GitHub project in Top 10", () => {
  const result = validateDailyPublication({
    summaryText: "今天模型、工具和开源项目都有更新，GitHub 项目不能在 TOP 里连续刷屏。",
    pageMarkdown: buildDailyValidationPage({
      topItems: [
        { title: "AI 项目一发布新版本", url: "https://github.com/example/project-one" },
        { title: "AI 项目二登上趋势榜", url: "https://github.com/example/project-two" },
      ],
      moreItems: [
        { category: "产品", title: "一个产品补充动态", url: "https://example.com/product-extra" },
      ],
    }),
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /TOP 10 GitHub\/开源项目最多只能 1 条/);
});

test("validateDailyPublication rejects more than one GitHub project in more dynamics", () => {
  const result = validateDailyPublication({
    summaryText: "今天模型、工具和开源项目都有更新，更多动态里也不能连续堆 GitHub 链接。",
    pageMarkdown: buildDailyValidationPage({
      topItems: [
        { title: "一个模型发布动态", url: "https://example.com/model-news" },
      ],
      moreItems: [
        { category: "开源", title: "AI 项目三发布新版本", url: "https://github.com/example/project-three" },
        { category: "开源", title: "AI 项目四登上趋势榜", url: "https://github.com/example/project-four" },
      ],
    }),
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /更多动态 GitHub\/开源项目最多只能 1 条/);
});

test("validateDailyPublication accepts one GitHub project in Top and one in more dynamics", () => {
  const result = validateDailyPublication({
    summaryText: "今天模型、工具和开源项目都有更新，开源项目在 TOP 和更多动态中各保留一条。",
    pageMarkdown: buildDailyValidationPage({
      topItems: [
        { title: "AI 项目五发布新版本", url: "https://github.com/example/project-five" },
        { title: "一个模型发布动态", url: "https://example.com/model-news" },
      ],
      moreItems: [
        { category: "开源", title: "AI 项目六登上趋势榜", url: "https://github.com/example/project-six" },
        { category: "产品", title: "一个产品补充动态", url: "https://example.com/product-extra" },
      ],
    }),
    requireGithubProjectInTop: true,
    requireGithubProjectInMore: true,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test("validateDailyPublication rejects missing secondary daily sections", () => {
  const result = validateDailyPublication({
    summaryText: "今天模型和工具更新不少，日报结构必须完整，不能丢掉补充栏目。",
    pageMarkdown: `## **今日摘要**

\`\`\`
今天模型和工具更新不少，日报结构必须完整，不能丢掉补充栏目。
\`\`\`

## ⚡ 快速导航

- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **👀 只有一句话**
今天 AI 工具更新密集。

### **🔑 3 个关键词**
#模型 #工具 #日报

## **🔥 重磅 TOP 1**

### 1. [一条新闻](https://example.com/news-1)
这里是足够长的正文，这里是足够长的正文，这里是足够长的正文，这里是足够长的正文。
这里是足够长的正文，这里是足够长的正文，这里是足够长的正文，这里是足够长的正文。
这里是足够长的正文，这里是足够长的正文，这里是足够长的正文，这里是足够长的正文。

## **❓ 相关问题**

### 如何体验今天提到的工具？

先确认官方入口，再决定是否使用成品服务。

**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取成品账号。`,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /更多动态/);
  assert.match(result.issues.join("\n"), /AI趣闻/);
});

test("validateDailyPublication rejects unlinked light-observation fun section", () => {
  const pageMarkdown = [
    "## **今日摘要**",
    "",
    "```",
    "今天模型、图片和开发工作流都有更新，日报结构完整且有可读性。",
    "```",
    "",
    "## ⚡ 快速导航",
    "",
    "- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览",
    "",
    "## **今日AI资讯**",
    "",
    "### **👀 只有一句话**",
    "今天 AI 图像和开发工具都很热。",
    "",
    "### **🔑 3 个关键词**",
    "#图像 #开发 #工具",
    "",
    "## **🔥 重磅 TOP 1**",
    "",
    "### 1. [一条新闻](https://example.com/news-1)",
    "这里是足够长的正文，这里是足够长的正文，这里是足够长的正文，这里是足够长的正文。",
    "这里是足够长的正文，这里是足够长的正文，这里是足够长的正文，这里是足够长的正文。",
    "这里是足够长的正文，这里是足够长的正文，这里是足够长的正文，这里是足够长的正文。",
    "",
    "## **📊 更多动态**",
    "",
    "- **[其他]** [另一个素材](https://example.com/more-1) - 这条补充 TOP 未覆盖的角度。",
    "",
    "## **😄 AI趣闻**",
    "",
    "今天的轻观察：这段没有真实素材链接，只是在概括今天的气氛。",
    "",
    "## **❓ 相关问题**",
    "",
    "### 如何体验今天提到的工具？",
    "",
    "先确认官方入口，再决定是否使用成品服务。",
    "",
    "**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取成品账号。",
  ].join("\n");

  const result = validateDailyPublication({
    summaryText: "今天模型、图片和开发工作流都有更新，日报结构完整且有可读性。",
    pageMarkdown,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /AI趣闻.*链接|轻观察/);
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

test("validateDailyPublication rejects unnumbered Top items and duplicated links across sections", () => {
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

## **📊 更多动态**

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
    /top items must use numbered headings|reuse the same source url/i
  );
});

test("validateDailyPublication rejects insufficient top items when enough material is expected", () => {
  const result = validateDailyPublication({
    summaryText: "OpenAI、Google 和 GitHub 项目更新很多，今天的候选素材明显够写满十条。",
    pageMarkdown: `## **今日摘要**

\`\`\`
OpenAI、Google 和 GitHub 项目更新很多，今天的候选素材明显够写满十条。
\`\`\`

## 📌 快速导航

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

test("validateDailyPublication rejects repeated stories across sections even when urls differ", () => {
  const result = validateDailyPublication({
    summaryText: "同一件 OpenAI 融资新闻不能在三个栏目里换链接复读。",
    pageMarkdown: `## **今日摘要**

\`\`\`
同一件 OpenAI 融资新闻不能在三个栏目里换链接复读。
\`\`\`

## 📌 快速导航

- [📢 今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **🧐 只有一句话**
今天最重要的是别把同一个故事写三遍。

### **🧭 3 个关键词**
#融资 #OpenAI #去重

## **🔥 重磅 TOP 1**

### 1. [OpenAI 完成 1250 亿美元融资](https://example.com/source-a)
这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文，这里是一段足够长的正文。

## **📊 更多动态**

- **[商业]** [OpenAI 完成 1250 亿美元融资，估值继续走高](https://example.com/source-b) - 同一个故事只是换了来源，不应该再写一遍。

## **😆 AI趣闻**

### [OpenAI 完成 1250 亿美元融资后员工反应刷屏](https://example.com/source-c)
同一个核心事件如果只是换个讲法，也不应该再进趣闻栏目。

## **❓ 相关问题**

### 如何看懂今天的融资新闻？

先理解事件本身，再看和你的使用场景有什么关系。

**解决方案**：访问 **[爱窝啦 Aivora](https://aivora.cn)** 获取成品账号。`,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /reuse the same story across sections/i);
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

test("validateOpportunityPublication rejects one brand dominating the whole article", () => {
  const result = validateOpportunityPublication({
    markdown: `# 今日AI商机

## 先说结论
今天先试 Claude 跑通包，但不要整篇只念 Claude。

## 今日主推
### Claude 中文跑通包
Claude 今天很热，Claude Code 也很热，很多人有 Claude 账号但不会用 Claude Code。这个机会不是卖 Claude 概念，而是把 Claude 的配置、Claude 的模板、Claude 的常见报错整理成 Claude 新手包。

- 适合谁：买了 Claude 但不会配置的人
- 这钱从哪来：Claude 用户想省时间，Claude 配置本身有门槛
- 最简单卖法：Claude 跑通包
- 今天先做哪一步：跑通 Claude 模板
- 今天就能发的文案：Claude 不会配，我帮你整理好
- 配图建议：Claude 配置截图

## 本周可试
### Claude 模板精选
继续围着 Claude 写，Claude 模板、Claude 示例、Claude 场景都可以试。
- 适合谁：Claude 新手
- 先怎么试：先做 Claude 清单
- 为什么先别冲太猛：Claude 售后边界要写清楚
- 配图建议：Claude 截图

## 今天别碰
### 只讲模型参数
看着热，但不适合小白直接卖。

## 地图感
### 跑通包
跑通包卖的是省折腾，不是技术名词。

## 今日动作
- 先发什么：Claude 跑通包
- 先录什么：Claude 配置录屏
- 先卖哪一款：Claude 新手包`,
    bannedPublicPhrases: ["便宜 token", "风险自负", "多用户商业化"],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /品牌露出过密: Claude/);
});

test("validateAccountOpportunityPublication rejects Gemini dominating account opportunities", () => {
  const result = validateAccountOpportunityPublication({
    markdown: `# 今日AI账号商机

## 先看信号
- Gemini 讨论升温，Gemini 体验号有人问，Gemini 平替也有人看。
- 继续写 Gemini 容易刷屏，所以这里故意构造不合格内容。

## 今日主推
### Gemini 低门槛体验号
Gemini 今天被讨论，Gemini 买家想试，Gemini 账号可以低价挂，Gemini 体验号适合今天主推。

- 发生了什么：Gemini 热度起来
- 今天先挂什么：Gemini 体验号
- 今天先测什么：Gemini 标题
- 售后风险：Gemini 时效边界要写清

## 平替机会
- Gemini 短期号
- Gemini 组合包
- Gemini 对照包

## 闲鱼新品
- Gemini 低价先试
- Gemini 不想年付先体验

## 今天别碰
- Gemini 长期稳定承诺不要写。

## 今日动作
- 先发什么：Gemini 体验号
- 先录什么：Gemini 登录录屏
- 先卖哪一款：Gemini 低价款`,
    bannedPublicPhrases: ["便宜 token", "风险自负", "多用户商业化"],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /品牌露出过密: Gemini/);
});
