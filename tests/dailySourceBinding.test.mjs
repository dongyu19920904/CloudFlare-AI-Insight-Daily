import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quarantineDailySourceConflicts } from "../src/dailySourceBinding.js";
import { buildDailyPromptSelection } from "../src/dailyPromptSelection.js";
import { buildDailyGenerationPromptInput } from "../src/dailyGenerationPromptInput.js";
import { ensureDailyMediaCoverage, repairDailyMediaReferences } from "../src/dailyMediaCoverage.js";
import { ensureUniqueDailyTopSources } from "../src/dailySectionSanitizer.js";
import { normalizeStandaloneDailyFunSection } from "../src/dailyFunSection.js";

const deepseek = {
  title: "我不认为这是个好操作，模型大小直接决定了世界知识的丰富程度，不是所有人都用AI来写代码，Flash在非代码场景比不上Pro。",
  url: "https://x.com/Gorden_Sun/status/2097607912076272029",
  plainText: "转述称 DS 将 V4 Pro 流量路由到 V4.1 Flash。",
  placeholders: ['![DS](https://pbs.twimg.com/media/HRwzC_5asAEEM7z?format=jpg&name=orig)'],
};
const omnii = {
  title: "基因语言模型设计癌症疫苗 通过后训练的多模态基因语言模型Omnii",
  url: "https://x.com/Gorden_Sun/status/2097635961614270891",
  plainText: "Omnii 根据肿瘤突变设计疫苗。",
  placeholders: ['![Omnii](https://pbs.twimg.com/media/HRxMxNtbkAAo0r1?format=jpg&name=orig)'],
};
const records = [deepseek, omnii];
const wrong = `### 7. DeepSeek V4 Pro 请求被路由至 V4.1 Flash

**DS 官方将 V4 Pro 流量临时路由到 Flash。** 转述的说明显示，[V4.1 Pro 上线前采用此方案](${omnii.url})。

![Omnii 癌症疫苗设计](https://pbs.twimg.com/media/HRxMxNtbkAAo0r1?format=jpg&name=orig "Omnii 癌症疫苗设计")

`;
const good = `### 8. 一条没有串线的新闻

[实际说明](https://example.com/notice)。\n\n`;

test("quarantines cross-event URL plus image; does not invent a replacement source", () => {
  const input = `## 今日焦点 TOP 10\n\n${wrong}${good}`;
  const result = quarantineDailySourceConflicts(input, records);
  assert.equal(result.removedCount, 1);
  assert.equal(result.markdown, `## 今日焦点 TOP 1\n\n${good.replace("### 8.", "### 1.")}`);
  assert.equal(result.quarantined[0].sourceUrl, omnii.url);
  assert.deepEqual(result.quarantined[0].matchingSourceUrls, [deepseek.url]);
  assert.ok(!result.markdown.includes(deepseek.url));
  const media = ensureDailyMediaCoverage(repairDailyMediaReferences(result.markdown, records).markdown, records);
  assert.equal(media.insertedCount, 0);
  assert.doesNotMatch(media.markdown, /HRxMxNtbkAAo0r1/);
});

test("correct source and media remain byte-for-byte unchanged", () => {
  const correct = wrong.replace(omnii.url, deepseek.url).replaceAll("HRxMxNtbkAAo0r1", "HRwzC_5asAEEM7z");
  const result = quarantineDailySourceConflicts(correct, records);
  assert.equal(result.removedCount, 0);
  assert.equal(result.markdown, correct);
});

test("compared entity in source prevents deletion of a legitimate comparison", () => {
  const comparison = { ...omnii, plainText: `${omnii.plainText} 对比 DeepSeek V4 的用途。` };
  assert.equal(quarantineDailySourceConflicts(wrong, [deepseek, comparison]).removedCount, 0);
});

test("source entity explicitly discussed by the item prevents an assumed conflict", () => {
  assert.equal(quarantineDailySourceConflicts(wrong.replace("转述的说明", "与 Omnii 对比的说明"), records).removedCount, 0);
});

test("no alternate evidence or only a generic token does not justify removal", () => {
  assert.equal(quarantineDailySourceConflicts(wrong, [omnii]).removedCount, 0);
  assert.equal(quarantineDailySourceConflicts(wrong, [omnii, { ...deepseek, plainText: "AI Pro Flash model" }]).removedCount, 0);
});

test("unknown links, missing records and Chinese-only headlines are left unchanged", () => {
  for (const input of [wrong.replace(omnii.url, "https://example.com/official"), wrong.replace(/^###[^\n]+/, "### 国产模型调整服务")]) {
    assert.equal(quarantineDailySourceConflicts(input, records).markdown, input);
  }
  assert.equal(quarantineDailySourceConflicts(wrong).markdown, wrong);
  assert.equal(quarantineDailySourceConflicts(wrong, [{ url: "not a URL" }]).markdown, wrong);
});

test("checks social news without requiring either source to have images", () => {
  const input = `## 社媒精选\n\n${wrong.replace(/!\[[^\n]+/g, "")}`;
  assert.equal(quarantineDailySourceConflicts(input, records.map(({ placeholders, ...record }) => record)).removedCount, 1);
});

test("handles twitter alias, ignores URL fragments and preserves path case", () => {
  const input = wrong.replace(omnii.url, omnii.url.replace("x.com", "mobile.twitter.com") + "#details");
  assert.equal(quarantineDailySourceConflicts(input, records).removedCount, 1);
  const otherCase = wrong.replace("Gorden_Sun", "gorden_sun");
  assert.equal(quarantineDailySourceConflicts(otherCase, records).removedCount, 0);
});

test("FAQ and code examples are not treated as event articles", () => {
  const faq = `## **相关问题**\n\n${wrong}`;
  assert.equal(quarantineDailySourceConflicts(faq, records).markdown, faq);
  const code = wrong + "```js\nconst version = 4;\n```";
  assert.equal(quarantineDailySourceConflicts(code, records).markdown, code);
});

test("bad standalone fun disappears without changing any sibling item", () => {
  const input = `## **😄 AI趣闻**\n\n${wrong}`;
  const result = quarantineDailySourceConflicts(input, records);
  assert.equal(result.removedCount, 1);
  assert.equal(normalizeStandaloneDailyFunSection(result.markdown), "");
});

test("quarantine renumbers TOP before existing normalization; no numbering gaps", () => {
  const result = quarantineDailySourceConflicts(`## **🔥 今日焦点 TOP 10**\n\n${wrong}${good}`, records);
  assert.match(ensureUniqueDailyTopSources(result.markdown), /### 1\. 一条没有串线/);
});

test("selection retains structured evidence without media and includes social titles", () => {
  const selection = buildDailyPromptSelection({ news: [
    { type: "news", title: "DeepSeek V4 新功能", url: deepseek.url, published_date: "2026-09-10", details: { content_html: "<p>DeepSeek V4.1 AI model</p>" } },
  ] });
  assert.equal(selection.mediaCandidates.length, 0);
  assert.ok(selection.dailySourceCandidates.some((record) => record.url === deepseek.url && record.plainText.includes("V4.1")));
  assert.match(selection.selectedContentItems.join("\n"), /Title: DeepSeek V4 新功能/);
  assert.match(buildDailyGenerationPromptInput(selection.selectedContentItems), /【来源绑定】/);
});

test("guard is wired before both media passes and only inside independent daily generation", () => {
  const code = readFileSync(new URL("../src/handlers/scheduled.js", import.meta.url), "utf8");
  const start = code.indexOf("async function generateDailyMarkdown(");
  const end = code.indexOf("function buildOpportunitySourceDigest(", start);
  const daily = code.slice(start, end);
  assert.ok(daily.indexOf("checkSourceBindings(outputOfCall2, 'initial')") < daily.indexOf("repairDailyMediaReferences(outputOfCall2"));
  assert.ok(daily.indexOf("checkSourceBindings(repairedOutputOfCall2, 'repair')") < daily.indexOf("repairDailyMediaReferences(repairedOutputOfCall2"));
  assert.match(daily, /checkSourceBindings\(standaloneDailyFunSection, 'standalone-fun'\)/);
  assert.doesNotMatch(code.slice(0, start) + code.slice(end), /checkSourceBindings\(/);
  assert.match(code.slice(code.indexOf("export async function handleScheduledDaily")), /dailySourceCandidates,/);
});
