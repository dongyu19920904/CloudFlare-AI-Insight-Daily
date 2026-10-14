import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeDuplicateDailySections, removeEmptyDailyTopicSections } from "../src/dailySectionSanitizer.js";

test("a model version is one entity, not grounds to delete independent social demonstrations", () => {
  const draft = `## **🔥 今日焦点 TOP 1**

### 1. Gemini 4 Argon 正式发布

**新模型来了。** **Gemini** 4 Argon 已开放。[发布说明](https://example.com/launch)。

## **◉ 社媒精选**

### 看人类扔沙包，机器人自己搭训练场

Google AI 展示 Gemini 4 Argon 从真人视频建立训练仿真。[机器人实验](https://x.com/GoogleAI/status/2110083927620591769)。

### 用模型设计一条家具腿

Gemini 4 Argon 被用于家具腿设计。[家具设计演示](https://x.com/GeminiApp/status/2110093640177783147)。`;
  const cleaned = removeEmptyDailyTopicSections(sanitizeDuplicateDailySections(draft));
  assert.match(cleaned, /机器人实验/);
  assert.match(cleaned, /家具设计演示/);
  assert.match(cleaned, /社媒精选/);
});

test("GitHub and Star are not evidence that an independent repository repeats a book roundup", () => {
  const draft = `## **🔥 今日焦点 TOP 1**

### 1. GitHub 上的 AI 工程书籍

GitHub 上的图书累计多颗 Star。[图书介绍](https://example.com/books)。

## **⌘ 开源 TOP 项目**

### vercel-labs/skills：管理智能体技能

GitHub 项目今天新增 Star，使用 TypeScript。[项目代码](https://github.com/vercel-labs/skills)。`;
  assert.match(removeEmptyDailyTopicSections(sanitizeDuplicateDailySections(draft)), /vercel-labs\/skills/);
});
