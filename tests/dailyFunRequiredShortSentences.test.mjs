import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getSystemPromptSummarizationStepOne } from "../src/prompt/summarizationPromptStepZero.js";
import { getSystemPromptSummarizationStepThree } from "../src/prompt/summarizationPromptStepThree.js";
import { buildDailyGenerationPromptInput } from "../src/dailyGenerationPromptInput.js";
import { getDailyFunWritingRules, buildStandaloneDailyFunPromptInput } from "../src/dailyFunSection.js";

const candidate = "News Title: 桌面 AI 助手\nUrl: https://example.org/desktop\nContent Summary: 按下快捷键即可在当前窗口旁唤起助手。";

test("all writing entrypoints share the required fun rules rather than optional fallbacks", () => {
  const rules = getDailyFunWritingRules();
  for (const prompt of [getSystemPromptSummarizationStepOne("2026-09-12"), buildDailyGenerationPromptInput([], [candidate]), buildStandaloneDailyFunPromptInput("2026-09-12", [candidate])]) {
    assert.ok(prompt.includes(rules));
    assert.doesNotMatch(prompt, /AI趣闻.*(?:可选|最多 1 条)/);
    assert.doesNotMatch(prompt, /写不出.*(?:省略整个栏目|输出空字符串)/);
  }
  const scheduled = readFileSync(new URL("../src/handlers/scheduled.js", import.meta.url), "utf8");
  const repair = scheduled.slice(scheduled.indexOf("function buildDailyRepairPrompt("), scheduled.indexOf("function getDailyBodyGenerationEnv("));
  assert.match(repair, /getDailyFunWritingRules\(\)/);
  assert.doesNotMatch(repair, /是可选栏目/);
});

test("short sentences retain article information and do not change the three-line summary", () => {
  const body = getSystemPromptSummarizationStepOne();
  assert.match(body, /120-170 个中文字符，使用 6-8 个完整短句/);
  assert.match(body, /不通过删除事实来缩短/);
  assert.match(body, /一个完整意思可以超过 7 个字/);
  assert.match(body, /URL 不计入句长，链接文字计入/);
  assert.doesNotMatch(body, /使用 4-5 个完整短句|原则上不得超过 55 个/);
  const summary = getSystemPromptSummarizationStepThree();
  assert.match(summary, /只输出 3 行纯文本/);
  assert.match(summary, /优先 18-32 个可见字符/);
});

test("required fun keeps evidence and does not invent fictional user incidents", () => {
  const rules = getDailyFunWritingRules();
  assert.match(rules, /每期写 1 条完整趣闻/);
  assert.match(rules, /5-7 个完整短句/);
  assert.match(rules, /至少两个来源支持的细节/);
  assert.match(rules, /不能伪装成发生过的事故/);
  assert.match(rules, /不要输出通用兜底段子/);
});
