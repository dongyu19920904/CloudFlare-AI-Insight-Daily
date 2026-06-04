import test from "node:test";
import assert from "node:assert/strict";

import {
  buildStandaloneDailyFunPromptInput,
  insertDailyFunSection,
  normalizeStandaloneDailyFunSection,
  selectStandaloneDailyFunCandidates,
} from "../src/dailyFunSection.js";

test("selectStandaloneDailyFunCandidates excludes primary and duplicate items", () => {
  const primary = [
    "News Title: Codex 帮音频转 MP4\nUrl: https://x.com/vista8/status/1",
  ];
  const funItems = [
    "News Title: Codex 帮音频转 MP4\nUrl: https://x.com/vista8/status/1",
    "News Title: 程序员让 AI 改脚本\nUrl: https://x.com/dev/status/2",
    "News Title: 程序员让 AI 改脚本\nUrl: https://x.com/dev/status/2",
    "News Title: AI 把报错解释成小作文\nUrl: https://x.com/dev/status/3",
  ];

  const candidates = selectStandaloneDailyFunCandidates(primary, funItems, 5);

  assert.deepEqual(candidates, [
    "News Title: 程序员让 AI 改脚本\nUrl: https://x.com/dev/status/2",
    "News Title: AI 把报错解释成小作文\nUrl: https://x.com/dev/status/3",
  ]);
});

test("buildStandaloneDailyFunPromptInput asks only for the AI fun section", () => {
  const prompt = buildStandaloneDailyFunPromptInput("2026-06-04", [
    "News Title: 程序员让 AI 改脚本\nUrl: https://x.com/dev/status/2",
  ]);

  assert.match(prompt, /2026-06-04/);
  assert.match(prompt, /## \*\*😄 AI趣闻\*\*/);
  assert.match(prompt, /不要输出日报其它栏目/);
  assert.match(prompt, /Hook -> What -> Punchline/);
  assert.match(prompt, /https:\/\/x\.com\/dev\/status\/2/);
});

test("normalizeStandaloneDailyFunSection rejects source-less output", () => {
  const sourceLess = [
    "## **😄 AI趣闻**",
    "",
    "### AI 今天又犯迷糊",
    "没有来源链接的段落不能发布。",
  ].join("\n");

  assert.equal(normalizeStandaloneDailyFunSection(sourceLess), "");
});

test("insertDailyFunSection places valid section before trend prediction", () => {
  const markdown = [
    "## **今日AI资讯**",
    "",
    "## **🔥 重磅 TOP 1**",
    "",
    "### [Claude 更新](https://example.com/claude)",
    "正文。",
    "",
    "## **🔮 AI趋势预测**",
    "",
    "### 一个预测",
    "正文。",
  ].join("\n");
  const funSection = [
    "## **😄 AI趣闻**",
    "",
    "### [AI 今天负责把锅端稳](https://x.com/dev/status/2)",
    "半夜改脚本最怕两件事：一个是需求变了，另一个是 AI 说它理解了。今天有人把小工具交给 AI 改，结果代码跑起来了，报错也更客气了。以前是人看不懂机器，现在是机器先写一段安慰话，让人慢慢看不懂。",
  ].join("\n");

  const result = insertDailyFunSection(markdown, funSection);

  assert.match(result, /## \*\*😄 AI趣闻\*\*[\s\S]*## \*\*🔮 AI趋势预测\*\*/);
  assert.equal(result.match(/## \*\*😄 AI趣闻\*\*/g)?.length, 1);
});
