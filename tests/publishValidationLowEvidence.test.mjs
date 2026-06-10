import test from "node:test";
import assert from "node:assert/strict";

import { validateDailyPublication } from "../src/publishValidation.js";

test("validateDailyPublication keeps low-evidence AI workflow pitches out of TOP", () => {
  const result = validateDailyPublication({
    summaryText: "今天有 AI 编程工具更新，也有一个低证据短视频自动化说法，需要放在观察而不是 TOP。",
    pageMarkdown: `## **今日摘要**

\`\`\`
今天有 AI 编程工具更新，也有一个低证据短视频自动化说法，需要放在观察而不是 TOP。
\`\`\`

## ⚡ 快速导航

- [今日 AI 资讯](#今日ai资讯) - 最新动态速览

## **今日AI资讯**

### **👀 只有一句话**
AI 编程工具是真更新，短视频自动化暴富说法先观察。

### **🔑 3 个关键词**
#ClaudeCode #AI工作流 #信息源筛选

## **🔥 重磅 TOP 2**

### 1. [AI 批量视频工作流实战：四步从文案到四平台自动发布](https://t.me/aigc1024/21091)
这条内容说 AI 可以自动生成文案、配音、剪辑并四平台自动发布，还强调一个人批量跑十条视频。但原始素材只有视频和文案，没有 GitHub、工作流文件、配置文档或官方链接，所以不应该进 TOP。

### 2. [Claude Code adds a safer planning mode](https://example.com/claude-code-plan)
这是一条正常的 AI 编程工具更新，面向开发者的变化明确，适合放在 TOP 里作为今天的主要信息。

## **📌 值得关注**

- **[产品]** [OpenAI releases a small developer update](https://example.com/openai-update) - 这是一个普通补充信息，用来保证值得关注栏目有真实来源链接。

## **😄 AI趣闻**

### [Cursor 用户的一天](https://example.com/fun)
一个开发者把需求拆得很细，最后发现 AI 没偷懒，偷懒的是自己写需求时的手。

## **❓ 相关问题**

### 今天怎么判断 AI 工作流信息能不能信？

先看有没有可复现证据，再看有没有官方或开源链接。只有视频演示和夸张结果时，适合观察，不适合当成教程。

**解决方案**：访问 **[爱沃哥 Aivora](https://aivora.cn)** 获取更稳的 AI 工具和账号方案。`,
    minimumTopItems: 2,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /low-evidence AI workflow pitches should stay in watch section/i);
});
