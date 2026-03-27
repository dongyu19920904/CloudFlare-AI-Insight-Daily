import test from "node:test";
import assert from "node:assert/strict";

import { getSystemPromptSummarizationStepOne } from "../src/prompt/summarizationPromptStepZero.js";

test("AI趣闻 prompt asks for people-first, lightly humorous observation instead of comment搬运", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-03-26");

  assert.match(prompt, /先写人，再写新闻/);
  assert.match(prompt, /第一人称自嘲/);
  assert.match(prompt, /小场景或小尴尬起手/);
  assert.match(prompt, /轻轻收口/);
  assert.match(prompt, /把读者逗松一点/);
  assert.match(prompt, /生活感/);
  assert.match(prompt, /非技术读者也能看懂/);
  assert.match(prompt, /不要把技术圈黑话当笑点/);
  assert.match(prompt, /不要把圈内怨气写成幽默/);
  assert.match(prompt, /不要把网友评论当正文主体/);
  assert.match(prompt, /如果素材里有 `\[图片: \.\.\.\]`，\*\*必须\*\*放在该条末尾/);
  assert.match(prompt, /不要写成吐槽贴/);
  assert.match(prompt, /不要模仿任何特定演员/);
});

test("daily prompt forbids meta commentary and requires a FAQ every day", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-03-27");

  assert.match(prompt, /不要输出任何元话术/);
  assert.match(prompt, /不要写“我看了一下今天的素材”/);
  assert.match(prompt, /今天新闻不够/);
  assert.match(prompt, /每天必须输出 1 条 FAQ/);
  assert.doesNotMatch(prompt, /可以省略此板块/);
});

test("daily prompt relaxes Top 10 backfill window for early-morning reports", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-03-27");

  assert.match(prompt, /允许补充前 2 天内/);
  assert.match(prompt, /只要没有与昨日日报明显重复/);
  assert.match(prompt, /如果当天是早上批次|早上 9 点|早间更新/);
  assert.match(prompt, /如果按 80 分筛完仍不足 10 条/);
  assert.match(prompt, /逐步放宽到 70 分|放宽到 70 分/);
});
