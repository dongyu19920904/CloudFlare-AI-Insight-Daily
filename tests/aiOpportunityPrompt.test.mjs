import test from "node:test";
import assert from "node:assert/strict";

import { getSystemPromptAiOpportunity } from "../src/prompt/aiOpportunityPrompt.js";

test("getSystemPromptAiOpportunity defines an evidence-first opportunity editor", () => {
  const prompt = getSystemPromptAiOpportunity("2026-08-03", "### 当前业务");

  assert.match(prompt, /AI 商机产品主编/);
  assert.match(prompt, /低成本机会验证器/);
  assert.match(prompt, /官方发布、原项目、原作者/);
  assert.match(prompt, /社交信息只能发现线索/);
  assert.match(prompt, /先有真实信号，再推导可测试的商机/);
  assert.match(prompt, /绝不为了完整栏目凑数/);
});

test("getSystemPromptAiOpportunity asks for actionable 48-hour validation and stop conditions", () => {
  const prompt = getSystemPromptAiOpportunity("2026-08-03", "### 当前业务");

  assert.match(prompt, /48 小时最低成本验证/);
  assert.match(prompt, /目标鱼塘/);
  assert.match(prompt, /最小可验收交付/);
  assert.match(prompt, /第一单/);
  assert.match(prompt, /复购或沉淀资产/);
  assert.match(prompt, /停止条件/);
  assert.match(prompt, /5 次目标访谈/);
  assert.match(prompt, /单纯发帖、录屏、收藏项目不算验证/);
});

test("getSystemPromptAiOpportunity keeps the concise publication structure", () => {
  const prompt = getSystemPromptAiOpportunity("2026-08-03", "### 当前业务");

  assert.match(prompt, /正文不得再输出一级标题/);
  assert.match(prompt, /- \*\*直接答案：\*\*/);
  assert.match(prompt, /## 直接结论/);
  assert.match(prompt, /## 今日主推/);
  assert.match(prompt, /## 本周小试/);
  assert.match(prompt, /## 今天别碰/);
  assert.match(prompt, /## 今日三步/);
  assert.match(prompt, /可验证信号/);
  assert.match(prompt, /证据缺口/);
  assert.match(prompt, /今日三步必须恰好 3 个一级列表项/);
  assert.match(prompt, /每项只有一个完整句子且不超过 80 个中文字符/);
  assert.doesNotMatch(prompt, /## 地图感/);
  assert.doesNotMatch(prompt, /配图建议/);
  assert.doesNotMatch(prompt, /今天就能发的文案/);
});

test("getSystemPromptAiOpportunity aligns headings, keywords, and evidence links with the daily reader", () => {
  const prompt = getSystemPromptAiOpportunity("2026-08-03", "### 当前业务");

  assert.match(prompt, /三级机会标题必须是纯文本/);
  assert.match(prompt, /不能把来源链接塞进标题/);
  assert.match(prompt, /第一句用粗体写最影响决策的关键判断/);
  assert.match(prompt, /额外加粗 2-4 个真正影响决策的短关键词/);
  assert.match(prompt, /链接负责可核验事实/);
  assert.match(prompt, /不写「原文」「点击这里」/);
});

test("getSystemPromptAiOpportunity forbids forced account resale and invented claims", () => {
  const prompt = getSystemPromptAiOpportunity("2026-08-03", "### 当前业务");

  assert.match(prompt, /不默认卖账号/);
  assert.match(prompt, /不默认挂闲鱼/);
  assert.match(prompt, /禁止虚构销量、利润率/);
  assert.match(prompt, /不要生成 aivora\.cn/);
  assert.match(prompt, /不得补写候选没有支持的事实/);
});
