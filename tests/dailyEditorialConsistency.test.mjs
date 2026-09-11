import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDailyGenerationPromptInput, getDailyEditorialChecklist, countDailyTopEligiblePromptItems } from "../src/dailyGenerationPromptInput.js";
import { buildDailyPromptSelection } from "../src/dailyPromptSelection.js";
import { hasDailyFunStorySignal, getDailyFunWritingRules, removeSolicitationDailyFun, selectStandaloneDailyFunCandidates, buildStandaloneDailyFunPromptInput, normalizeStandaloneDailyFunSection } from "../src/dailyFunSection.js";

const preference = "深度搜索工具偏好榜出炉。日常最爱两个 DeepResearch 工具，一个精炼，一个内容丰富，Gemini 质量一般。";
const story = "开发者让 Codex 写脚本，结果模型先给自己写了一份使用说明。";
const item = (text, id) => `News Title: ${text}\nUrl: https://example.org/${id}\nContent Summary: ${text}`;

test("initial and repair use the same final evidence checklist", () => {
  const checklist = getDailyEditorialChecklist();
  const prompt = buildDailyGenerationPromptInput([item("AI 工具更新", "news")]);
  assert.ok(prompt.endsWith(checklist));
  assert.match(checklist, /旧稿不是证据/);
  assert.match(checklist, /答案只重组已有事实/);
  assert.match(checklist, /没有共同测算条件/);
  const scheduled = readFileSync(new URL("../src/handlers/scheduled.js", import.meta.url), "utf8");
  const repair = scheduled.slice(scheduled.indexOf("function buildDailyRepairPrompt("), scheduled.indexOf("function getDailyBodyGenerationEnv("));
  assert.ok(repair.indexOf("getDailyEditorialChecklist()") > repair.indexOf("invalidMarkdown ||"));
});

test("fun is required while fabricated incidents remain prohibited", () => {
  const prompt = buildDailyGenerationPromptInput([], [item(story, "story")]);
  assert.match(prompt, /正常出稿必须选 1 条写完整趣闻/);
  assert.match(prompt, /不能伪装成发生过的事故/);
  assert.doesNotMatch(prompt, /没有真实反差时直接省略趣闻/);
});

test("story signals remain a ranking heuristic, not an eligibility requirement", () => {
  assert.equal(hasDailyFunStorySignal(story), true);
  assert.equal(hasDailyFunStorySignal(preference), false);
  assert.equal(selectStandaloneDailyFunCandidates("", [item(preference, "preference")]).length, 1);
});

test("preference vocabulary no longer automatically deletes a linked fun section", () => {
  const news = `## **今日焦点 TOP 1**\n\n### 1. 工具使用偏好\n${preference}[比较说明](https://example.org/news)\n\n`;
  const faq = "## **相关问题**\n\n### 如何判断工具适用性？\n已有事实和限制。\n";
  const fun = `## **😄 AI趣闻**\n\n### 偏好榜出炉\n${preference}[质量一般](https://example.org/preference)\n\n`;
  const result = removeSolicitationDailyFun(news + fun + faq);
  assert.equal(result.markdown, news + fun + faq);
  assert.equal(result.removedCount, 0);
  assert.equal(removeSolicitationDailyFun(result.markdown).removedCount, 0);
  assert.ok(normalizeStandaloneDailyFunSection(fun));
});

test("real tool experiences remain available to the existing standalone writer", () => {
  const candidates = [item(preference, "preference")];
  assert.deepEqual(selectStandaloneDailyFunCandidates("", candidates), candidates);
  assert.ok(buildStandaloneDailyFunPromptInput("2026-09-12", candidates).includes(getDailyFunWritingRules()));
});

test("preference filtering does not reduce primary TOP capacity", () => {
  const primary = Array.from({ length: 10 }, (_, i) => item(i === 0 ? preference : `AI 更新 ${i}`, `news-${i}`));
  assert.equal(countDailyTopEligiblePromptItems(primary), 10);
  const prompt = buildDailyGenerationPromptInput(primary);
  assert.match(prompt, /TOP 候选 10:/);
  assert.match(prompt, /深度搜索工具偏好榜/);
});

test("a real story outranks a screenshot recommendation without shrinking the backup pool", () => {
  const candidate = (title, id, image = false) => ({
    type: "news", title, url: `https://x.com/test/status/${id}`, published_date: "2026-09-11",
    details: { content_html: `<p>${title}</p>${image ? '<img src="https://pbs.twimg.com/media/example.jpg">' : ''}` },
  });
  const result = buildDailyPromptSelection({ news: [candidate(preference, 1, true), candidate(story, 2)] });
  assert.match(result.dailyFunContentItems[0], /status\/2/);
  assert.equal(result.selectedContentItems.length, 2);
  assert.ok(result.dailyFunContentItems.some((text) => /status\/1/.test(text)));
});

test("an ordinary source is not rejected by a keyword gate; the prompt forbids inventing incidents", () => {
  const url = "https://x.com/GeminiApp/status/2098090725477105980";
  const source = { url, title: "Gemini now available for Windows", plainText: "Press Alt + Space to bring Gemini alongside your favorite apps." };
  const fun = `## **😄 AI趣闻**\n\n### 快捷键抢工作\n\nGemini 回复用户时，结果抢走老工具的快捷键。[快捷键冲突](https://x.com/GeminiApp/status/2098090725477105980)\n\n`;
  const rest = "## **相关问题**\n\n### 怎么用？\n按官方文档操作。";
  assert.equal(removeSolicitationDailyFun(fun + rest).markdown, fun + rest);
  assert.match(buildDailyGenerationPromptInput([], [item(source.plainText, "shortcut")]), /【AI趣闻专用候选素材】/);
  assert.match(getDailyFunWritingRules(), /不能伪装成发生过的事故、快捷键冲突/);
});

test("source URL normalization still prevents standalone reuse of published stories", () => {
  const fun = `## **😄 AI趣闻**\n\n### 先给自己写手册\n\n${story}[动作和结果](https://x.com/dev/status/1#photo)\n`;
  assert.deepEqual(selectStandaloneDailyFunCandidates(fun, [`News Title: ${story}\nUrl: https://twitter.com/dev/status/1`]), []);
  assert.equal(hasDailyFunStorySignal("Asked the agent to fix code, but it wrote instructions for itself instead."), true);
});

test("standalone fun retains source binding and isolation without requiring story keywords", () => {
  const scheduled = readFileSync(new URL("../src/handlers/scheduled.js", import.meta.url), "utf8");
  assert.match(scheduled, /removeSolicitationDailyFun\(markdown\)/);
  assert.doesNotMatch(scheduled, /\.filter\(hasDailyFunStorySignal\)/);
  assert.match(scheduled, /screenFun\(checkSourceBindings\(standaloneDailyFunSection/);
});
