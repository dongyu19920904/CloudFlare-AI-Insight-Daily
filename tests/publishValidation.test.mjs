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

- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览
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
    "- [📰 今日 AI 资讯](#今日ai资讯) - 最新动态速览",
    "",
    "## **今日AI资讯**",
    "",
    "### **👀 只有一句话**",
    "微信 Agent 开始走向大众平台。",
    "",
    "### **🔑 3 个关键词**",
    "#Agent #微信 #开源",
    "",
    "### 1. 一条新闻",
    "这里是足够长的正文，这里是足够长的正文，这里是足够长的正文，这里是足够长的正文。",
    "这里是足够长的正文，这里是足够长的正文，这里是足够长的正文，这里是足够长的正文。",
    "这里是足够长的正文，这里是足够长的正文，这里是足够长的正文，这里是足够长的正文。",
  ].join("\n");

  const result = validateDailyPublication({
    summaryText: "今天微信 Agent 和开源框架都在加速，开发者生态正在快速成形。",
    pageMarkdown,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test("validateOpportunityPublication rejects gray phrasing and missing required fields", () => {
  const result = validateOpportunityPublication({
    markdown: `## 今日AI商机

## 今日可卖

### 一个机会
- 今天适合卖什么：便宜 token
`,
    bannedPublicPhrases: ["便宜 token", "风险自负", "多用户商业化"],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /包含禁止片段: 便宜 token/);
  assert.match(result.issues.join("\n"), /缺少必需片段: 今天就能发的 1 句话术/);
});

test("validateOpportunityPublication accepts the new publishable opportunity structure", () => {
  const result = validateOpportunityPublication({
    markdown: `## 今日AI商机

### 一句话判断
今天更适合卖账号搭售，不适合单卖教程。

## 今日可卖
### Claude 账号搭售技能包
- 可直接发布的商品标题：Claude 账号 + 技能包配置
- 今天适合卖什么：Claude 账号搭配技能包配置
- 适合卖给谁：想快速上手 Claude 的中文用户
- 买家现在最在意什么：想尽快上手，不想自己折腾入口和配置
- 为什么今天能卖：买家现在想更快用 Claude 做内容处理，今天又有明确的新变化能带来新鲜感。
- 建议卖法：账号 + 配置 + 教程
- 你实际交付什么：账号入口、技能包配置说明、3 个场景示例
- 更适合发到哪里：群里、朋友圈、商品页
- 更适合单卖还是搭售：搭售
- 如果搭售，最适合搭什么：账号 + 配置说明 + 教程
- 低价引流款：39-59 元体验版
- 标准成交款：99-149 元标准版
- 搭售利润款：199-299 元陪跑版
- 今天值不值得发：值得
- 注意事项：不要承诺长期稳定

## 本周可试
### 微信 Agent 代配置
- 可直接发布的商品标题：微信 Agent 代配置
- 如果要试，先包装成什么商品：微信 Agent 跑通体验版
- 为什么值得试：入口新、讨论热
- 更适合谁来做：愿意先跑 demo 的卖家
- 先怎么小成本试：先做 demo 再测试询盘
- 为什么现在先别放大：还要验证稳定性

## 今日动作
- 今天先发哪一类商品：账号搭售商品
- 今天先测哪一个入口：群内测试文案
- 今天先准备哪一种搭售内容：安装截图教程
- 今天就能发的 1 句话术：Claude 账号 + 技能包，配好就能直接上手
`,
    bannedPublicPhrases: ["便宜 token", "风险自负", "多用户商业化"],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});
