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
    markdown: `# 今日AI商机

## 今日主推
### 一个机会
- 最简单卖法：便宜 token
`,
    bannedPublicPhrases: ["便宜 token", "风险自负", "多用户商业化"],
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /包含禁止片段: 便宜 token/);
  assert.match(result.issues.join("\n"), /缺少必需片段: 今天就能发的文案/);
});

test("validateOpportunityPublication accepts the card-style opportunity structure", () => {
  const result = validateOpportunityPublication({
    markdown: `# 今日AI商机

## 先说结论
今天最值得试的，不是追模型热词，而是卖微信跑通包。

## 今日主推
### 微信跑通包
不是卖概念，是卖“帮别人今天就跑通”。

- 适合谁：已经买了 Claude 或 OpenClaw，但不会接进微信的人
- 为什么今天能卖：新接入方案出来了，很多人想试，但不想自己折腾
- 最简单卖法：先卖跑通包，不要一上来卖复杂定制
- 参考卖法：29 元基础说明，59 元跑通包，139 元账号 + 跑通 + 答疑
- 今天先做哪一步：录一个 3 分钟跑通视频，证明你真的能弄好
- 今天就能发的文案：Claude 现在能接进微信了，我这边已经整理好跑通版，不想折腾配置的直接拿现成
- 配图建议：用接入成功界面截图，证明这不是空口说法

## 本周可试
### 技能包精选安装包
不是卖“技能市场很火”，而是卖“我帮你选好 5 个最实用的”。

- 适合谁：已经在用 Claude 或 OpenClaw，但不会挑技能和模板的人
- 先怎么试：先做 1 份“5 个最实用技能包合集”，别做大全
- 为什么别一下冲太猛：先看哪类技能更容易成交，是办公、内容还是开发辅助
- 配图建议：用技能市场截图，帮助读者理解这是什么

## 今天别碰
### 只聊模型跑分
看着热，但小白看完还是不知道今天能卖什么。

## 地图感
### 技能市场
把它理解成 AI 世界里的小插件市场就行，知道就行，不用今天深挖。

## 今日动作
- 先发什么：微信跑通包
- 先录什么：跑通录屏
- 先卖哪一款：29 元低价引流款`,
    bannedPublicPhrases: ["便宜 token", "风险自负", "多用户商业化"],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});
