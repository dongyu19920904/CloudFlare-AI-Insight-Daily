import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getSystemPromptSummarizationStepOne } from "../src/prompt/summarizationPromptStepZero.js";
import { getSystemPromptSummarizationStepThree } from "../src/prompt/summarizationPromptStepThree.js";
import { buildDailyPromptSelection } from "../src/dailyPromptSelection.js";
import {
  isDailyFunSolicitation,
  removeSolicitationDailyFun,
  normalizeStandaloneDailyFunSection,
  selectStandaloneDailyFunCandidates,
  buildStandaloneDailyFunPromptInput,
} from "../src/dailyFunSection.js";

const solicitation = "Codex 1000 额度邀请，符合条件的朋友留下邮箱。";
const story = "开发者让 Codex 写脚本，结果模型先写了一段给自己的使用说明。";
const scheduled = readFileSync(new URL("../src/handlers/scheduled.js", import.meta.url), "utf8");
const repair = scheduled.slice(scheduled.indexOf("function buildDailyRepairPrompt("), scheduled.indexOf("function getDailyBodyGenerationEnv("));

test("body, repair and summary carry research limitations rather than manufacturing certainty", () => {
  for (const prompt of [getSystemPromptSummarizationStepOne("2026-09-10"), getSystemPromptSummarizationStepThree(), repair]) {
    assert.match(prompt, /公布证明稿.*不等于已获独立认可/);
    assert.match(prompt, /模型预测不等于实验/);
    assert.match(prompt, /统计相关不等于因果/);
  }
  assert.match(getSystemPromptSummarizationStepThree(), /换选另一条有据的进展/);
  assert.match(getSystemPromptSummarizationStepThree(), /不自行宣布已核实/);
  assert.match(getSystemPromptSummarizationStepOne("2026-09-10"), /FAQ 的直接答案也不能跨越证据边界/);
});

test("invitation detection requires a benefit, offer and contact instruction together", () => {
  assert.equal(isDailyFunSolicitation(solicitation), true);
  assert.equal(isDailyFunSolicitation("赠送 AI 代金券，先到先得。"), true);
  for (const text of ["Codex 额度变化", "邀请同事测试 AI", "请留下邮箱获取复现日志", "没有额度了，结果 Codex 开始给任务排序。", "团队邀请用户参加额度实验，已经发布结果。"] ) {
    assert.equal(isDailyFunSolicitation(text), false, text);
  }
});

test("a solicitation is not rescued by an image, but unrelated alt text is not evidence", () => {
  assert.equal(isDailyFunSolicitation(`${solicitation}\n![邀请界面](https://example.org/image.png)`), true);
  assert.equal(isDailyFunSolicitation(`${story}\n![${solicitation}](https://example.org/image.png)`), false);
});

test("bad fun is removed without rewriting other news, links, images or FAQ", () => {
  const prefix = "## **🔥 今日焦点 TOP 10**\n\n### 1. 正常新闻\n\n**测试有结果。** [正文证据](https://example.org/news)。\n\n![真实截图](https://example.org/news.png)\n\n";
  const suffix = "## **❓ 相关问题**\n\n### 哪里找测试记录？\n\n[参考说明](https://example.org/faq)\n";
  const fun = `## **😄 AI趣闻**\n\n### 开放名额\n\n${solicitation}[领取说明](https://www.v2ex.com/t/1240764#reply0)。\n\n`;
  const result = removeSolicitationDailyFun(prefix + fun + suffix);
  assert.equal(result.removedCount, 1);
  assert.equal(result.markdown, prefix + suffix);
  assert.equal(removeSolicitationDailyFun(result.markdown).removedCount, 0);
});

test("genuine stories mentioning quota and everyday invitation stay unchanged", () => {
  const fun = `## **😄 AI趣闻**\n\n### 额度不够，先给任务排座次\n\n没有额度了，开发者邀请同事看日志，结果 Codex 先给任务排了个队。[记录](https://example.org/story)\n\n`;
  assert.equal(removeSolicitationDailyFun(fun).markdown, fun);
  assert.ok(normalizeStandaloneDailyFunSection(fun));
});

test("a solicitation outside AI fun is not deleted by this local filter", () => {
  const other = `## **值得关注**\n\n${solicitation}[说明](https://example.org/offer)\n`;
  assert.equal(removeSolicitationDailyFun(other).markdown, other);
});

test("standalone generation returns empty input when all candidates are solicitations", () => {
  const offer = `News Title: ${solicitation}\nUrl: https://example.org/offer`;
  assert.deepEqual(selectStandaloneDailyFunCandidates("", [offer]), []);
  assert.equal(buildStandaloneDailyFunPromptInput("2026-09-10", [offer]), "");
  assert.equal(normalizeStandaloneDailyFunSection(`## **😄 AI趣闻**\n\n### 招领\n${solicitation}[说明](https://example.org/offer)`), "");
});

test("standalone prompt requires real narrative without generic fallback", () => {
  const prompt = buildStandaloneDailyFunPromptInput("2026-09-10", [`News Title: ${story}\nUrl: https://example.org/story`]);
  assert.match(prompt, /每期写 1 条完整趣闻/);
  assert.match(prompt, /额度邀请.*不是趣闻/);
  assert.match(prompt, /不补写评论区热度/);
  assert.match(prompt, /不要输出通用兜底段子/);
});

function candidate(title, url, text = title) {
  return { type: "news", title, url, published_date: "2026-09-10", details: { content_html: `<p>${text}</p>` } };
}

test("fun selection excludes solicitation without removing it from the primary selection path", () => {
  const offer = candidate(solicitation, "https://www.v2ex.com/t/1240764");
  const result = buildDailyPromptSelection({ news: [offer] });
  assert.equal(result.selectedContentItems.length, 1);
  assert.equal(result.dailyFunContentItems.length, 0);
});

test("real unexpected tool actions outrank equally sourced feature announcements for fun", () => {
  const result = buildDailyPromptSelection({ news: [
    candidate("Claude 发布新的功能演示", "https://x.com/demo/status/1"),
    candidate(story, "https://x.com/demo/status/2"),
  ] });
  assert.match(result.dailyFunContentItems[0], /status\/2/);
});

test("screening is before summaries in both daily passes and absent from other task handlers", () => {
  const start = scheduled.indexOf("async function generateDailyMarkdown(");
  const end = scheduled.indexOf("function buildOpportunitySourceDigest(", start);
  const daily = scheduled.slice(start, end);
  assert.ok(daily.indexOf("screenFun(outputOfCall2, 'initial')") < daily.indexOf("[Scheduled][Daily] Generating summary"));
  assert.ok(daily.indexOf("screenFun(repairedOutputOfCall2, 'repair')") < daily.indexOf("let repairedOutputOfCall3"));
  assert.doesNotMatch(scheduled.slice(0, start) + scheduled.slice(end), /screenFun\(/);
});
