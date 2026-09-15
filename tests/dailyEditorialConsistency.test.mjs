import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDailyGenerationPromptInput, getDailyEditorialChecklist, countDailyTopEligiblePromptItems } from "../src/dailyGenerationPromptInput.js";
import { buildDailyPromptSelection } from "../src/dailyPromptSelection.js";
import { hasDailyFunStorySignal, isDailyFunPreferenceOnly, removeSolicitationDailyFun, selectStandaloneDailyFunCandidates, buildStandaloneDailyFunPromptInput, normalizeStandaloneDailyFunSection } from "../src/dailyFunSection.js";

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

test("fun input no longer instructs the model to turn every ordinary recommendation into a joke", () => {
  const prompt = buildDailyGenerationPromptInput([], [item(story, "story")]);
  assert.match(prompt, /不代表已经通过趣味审核/);
  assert.doesNotMatch(prompt, /只要这里有可用素材，就必须/);
  assert.match(prompt, /没有真实反差时直接省略趣闻/);
});

test("preference-only detection ignores media and keeps stories with actual reversals", () => {
  assert.equal(isDailyFunPreferenceOnly(preference), true);
  assert.equal(isDailyFunPreferenceOnly(`更喜欢 Codex。${story}`), false);
  assert.equal(hasDailyFunStorySignal(story), true);
  assert.equal(isDailyFunPreferenceOnly(`${preference}\n![AI 写脚本结果报错](https://example.org/img.jpg)`), true);
  assert.equal(isDailyFunPreferenceOnly("团队发布 AI 工具，今天可查看完整文档。"), false);
});

test("reject preference-only fun without touching news, FAQ or their source links", () => {
  const news = `## **今日焦点 TOP 1**\n\n### 1. 工具使用偏好\n${preference}[比较说明](https://example.org/news)\n\n`;
  const faq = "## **相关问题**\n\n### 如何判断工具适用性？\n已有事实和限制。\n";
  const fun = `## **😄 AI趣闻**\n\n### 偏好榜出炉\n${preference}[质量一般](https://example.org/preference)\n\n`;
  const result = removeSolicitationDailyFun(news + fun + faq);
  assert.equal(result.markdown, news + faq);
  assert.equal(result.removedCount, 1);
  assert.equal(removeSolicitationDailyFun(result.markdown).removedCount, 0);
  assert.equal(normalizeStandaloneDailyFunSection(fun), "");
});

test("preference-only sources do not trigger a standalone fun model call", () => {
  const candidates = [item(preference, "preference")];
  assert.deepEqual(selectStandaloneDailyFunCandidates("", candidates), []);
  assert.equal(buildStandaloneDailyFunPromptInput("2026-09-11", candidates), "");
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

test("a generated punchline cannot manufacture story evidence missing from the source", () => {
  const url = "https://x.com/GeminiApp/status/2098090725477105980";
  const source = { url, title: "Gemini now available for Windows", plainText: "Press Alt + Space to bring Gemini alongside your favorite apps." };
  const fun = `## **😄 AI趣闻**\n\n### 快捷键抢工作\n\nGemini 回复用户时，结果抢走老工具的快捷键。[快捷键冲突](https://x.com/GeminiApp/status/2098090725477105980)\n\n`;
  const rest = "## **相关问题**\n\n### 怎么用？\n按官方文档操作。";
  assert.equal(removeSolicitationDailyFun(fun + rest, [source]).markdown, rest);
  assert.equal(removeSolicitationDailyFun(fun + rest, []).markdown, rest);
  assert.doesNotMatch(buildDailyGenerationPromptInput([], [item(source.plainText, "shortcut")]), /【AI趣闻专用候选素材】/);
});

test("source-grounded story survives with canonicalized source URL while a wrong source does not", () => {
  const source = { url: "https://twitter.com/dev/status/1", plainText: story };
  const fun = `## **😄 AI趣闻**\n\n### 先给自己写手册\n\n${story}[动作和结果](https://x.com/dev/status/1#photo)\n`;
  assert.equal(removeSolicitationDailyFun(fun, [source]).markdown, fun);
  assert.equal(removeSolicitationDailyFun(fun, [{ ...source, url: "https://x.com/other/status/2" }]).markdown, "");
  assert.equal(hasDailyFunStorySignal("Asked the agent to fix code, but it wrote instructions for itself instead."), true);
});

test("standalone fun uses the same source guard and does not select non-story material", () => {
  const scheduled = readFileSync(new URL("../src/handlers/scheduled.js", import.meta.url), "utf8");
  assert.match(scheduled, /removeSolicitationDailyFun\(markdown, options.dailySourceCandidates \|\| \[\]\)/);
  assert.match(scheduled, /dailyFunContentItems \|\| \[\]\)\.filter\(hasDailyFunStorySignal\)/);
  assert.match(scheduled, /screenFun\(checkSourceBindings\(standaloneDailyFunSection/);
});
