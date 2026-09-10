import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getSystemPromptSummarizationStepOne } from "../src/prompt/summarizationPromptStepZero.js";
import { normalizeDailyOutputPresentation } from "../src/dailySectionSanitizer.js";

const prompt = getSystemPromptSummarizationStepOne("2026-09-10");
const scheduled = readFileSync(new URL("../src/handlers/scheduled.js", import.meta.url), "utf8");
const start = scheduled.indexOf("function buildDailyRepairPrompt(");
const end = scheduled.indexOf("function getDailyBodyGenerationEnv(", start);
assert.ok(start >= 0 && end > start, "The actual daily repair prompt must be inspected");
const repair = scheduled.slice(start, end);

test("generation and repair allow event-first prose but retain conditional attribution", () => {
  for (const text of [prompt, repair]) {
    assert.match(text, /需要署名时才放在链接外/);
    assert.match(text, /省略没有信息增量的转发者/);
    assert.match(text, /来源 URL 必须保留/);
    assert.match(text, /个人实测保留/);
    assert.match(text, /观点.*提出者/);
    assert.match(text, /独家数字保留估算或自述主体/);
    assert.match(text, /仅有二手转述时写清“转述的测试”或“案例称”/);
    assert.match(text, /不得假装读过未提供的一手材料/);
    assert.match(text, /普遍能力/);
    assert.doesNotMatch(text, /宝玉在推文中介绍|据 36氪报道|来源名称必须留在链接外/);
  }
  assert.match(prompt, /不把转发者误写成创作者/);
  assert.match(prompt, /不要求每条都复述媒体名/);
  assert.match(prompt, /不能叫“官方公告”或“官网”/);
});

test("natural prose retains density, short evidence links and optional actions", () => {
  for (const text of [prompt, repair]) {
    assert.match(text, /120-170/);
    assert.match(text, /4-5 个/);
    assert.match(text, /不固定第二句报来源、第三句列参数、第四句给行动/);
    assert.match(text, /不通过删除事实来/);
    assert.match(text, /具体可行的动作/);
    assert.match(text, /8-24/);
    assert.doesNotMatch(text, /第二句写来源能够证明的事实，第三句补一个关键细节/);
  }
  assert.match(prompt, /8-18 个显示字符、一般不超过 24 个/);
  assert.match(prompt, /不强制每条以行动建议结尾/);
  assert.match(prompt, /较短的专业栏目保留 2-3 处/);
  assert.match(prompt, /不得虚构现场、心理、销量、口碑或因果/);
  assert.match(prompt, /缺少趣闻不得影响其他栏目发布/);
});

// Synthetic editorial fixtures test Markdown processing, not model factuality.
const samples = [
  { name: "news", text: "**接口支持批量导出。** 示例工具支持[按筛选条件批量导出](https://example.org/news)。每次最多 **20 条**，目前仅限 **测试环境**。", boundary: "测试环境" },
  { name: "personal test", text: "**这次测试保住了排版。** 在这次测试中，小林用 **两份文档**检查[文本修改后的排版保留](https://example.org/test)。样本有限，不能推断所有文件都能保持排版。", boundary: "样本有限，不能推断所有文件" },
  { name: "secondhand claim", text: "**案例称扩店未增员。** 转述的案例称，这家企业将 **门店数**扩至原来三倍，[中后台人数维持不变](https://example.org/claim)。成本口径未披露，不能证明增长来自 Agent。", boundary: "成本口径未披露，不能证明增长来自 Agent" },
  { name: "project", text: "**脚本提供迁移预检。** example/migrate 展示[迁移前检查字段差异](https://example.org/project)的方法。输入仅包含 **演示记录**，不代表生产数据已完成迁移。", boundary: "不代表生产数据已完成迁移" },
  { name: "fun", text: "**测试结果出人意料。** 转述的测试中，研究者要求模型[只用十六进制生成动画](https://example.org/fun)。记录称模型先生成汇编器；这个步骤来自记录，不补写围观者的心理。", boundary: "转述的测试中" },
];

for (const sample of samples) {
  test(`presentation keeps ${sample.name} evidence, caveat, and original image`, () => {
    const image = `![测试记录配图](https://example.org/${encodeURIComponent(sample.name)}.png "测试记录配图")`;
    const markdown = `## **🔥 今日焦点 TOP 10**\n\n### 1. 示例条目仅用于呈现层回归测试\n\n${sample.text}\n\n${image}`;
    const result = normalizeDailyOutputPresentation(markdown);
    const links = sample.text.match(/\[[^\]]+\]\(https:\/\/[^)]+\)/g);
    for (const link of links) assert.ok(result.includes(link), link);
    assert.ok(result.replace(/\*\*/g, "").includes(sample.boundary));
    assert.ok(result.includes(image));
  });
}
