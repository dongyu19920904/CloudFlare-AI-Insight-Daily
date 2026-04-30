import test from "node:test";
import assert from "node:assert/strict";

import { getSystemPromptSummarizationStepOne } from "../src/prompt/summarizationPromptStepZero.js";
import { getSystemPromptSummarizationStepThree } from "../src/prompt/summarizationPromptStepThree.js";

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

test("daily prompt sharpens one-liner, watchlist, trend, and FAQ sections without changing structure", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-03-27");

  assert.match(prompt, /今天最该记住的判断/);
  assert.match(prompt, /趋势词、冲突词、变化词/);
  assert.match(prompt, /这条真正的新意是什么/);
  assert.match(prompt, /为什么值得多看一眼/);
  assert.match(prompt, /更多动态/);
  assert.match(prompt, /标题写几条，正文就必须真的给几条/);
  assert.doesNotMatch(prompt, /## \*\*📌 值得关注/);
  assert.match(prompt, /基于今天信号做近未来推演/);
  assert.match(prompt, /像真人答疑/);
});

test("daily prompt requires numbered Top items, section exclusivity, and GitHub project exposure", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-04-07");

  assert.match(prompt, /### 1\./);
  assert.match(prompt, /同一条内容只能出现在一个栏目|同一链接只允许出现一次/);
  assert.match(prompt, /同一家公司、同一产品线、同一核心人物最多只能占 \*\*1 条\*\*/);
  assert.match(prompt, /GPT Image、ChatGPT、Sam Altman/);
  assert.match(prompt, /最近 24 小时/);
  assert.match(prompt, /GitHub|Project Name|开源项目/);
  assert.match(prompt, /TOP 10 里每天至少保留 \*\*1 条\*\*、最多 \*\*1 条\*\*项目\/开源更新/);
  assert.match(prompt, /「更多动态」也至少保留 \*\*1 条\*\*、最多 \*\*1 条\*\*不同的项目\/开源更新/);
  assert.match(prompt, /不要让 GitHub\/开源项目刷屏/);
});

test("summary prompt asks for a three-line progression instead of three parallel headlines", () => {
  const prompt = getSystemPromptSummarizationStepThree();

  assert.match(prompt, /为什么值得在意/);
  assert.match(prompt, /今天发生了什么大事/);
  assert.match(prompt, /这件事背后说明了什么变化/);
  assert.match(prompt, /这对读者意味着什么/);
  assert.match(prompt, /不要把 3 行都写成并列新闻播报/);
  assert.match(prompt, /bottom line/);
});

test("daily prompt requires AI fun to use a real unused source link", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-04-26");

  assert.match(prompt, /每天必须输出 \*\*1 条\*\*/);
  assert.match(prompt, /独立素材链接/);
  assert.match(prompt, /要换一条素材/);
  assert.match(prompt, /不要写“今日轻观察”/);
  assert.doesNotMatch(prompt, /可以不写这一栏/);
  assert.doesNotMatch(prompt, /\u4e0d\u5e26\u94fe\u63a5\u7684\u4eca\u65e5\u8f7b\u89c2\u5bdf/);
});
