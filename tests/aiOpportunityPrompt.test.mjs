import test from "node:test";
import assert from "node:assert/strict";

import { getSystemPromptAiOpportunity } from "../src/prompt/aiOpportunityPrompt.js";

test("getSystemPromptAiOpportunity applies the four-quadrant filter", () => {
  const prompt = getSystemPromptAiOpportunity(
    "2026-03-24",
    "### 当前业务\n- 核心业务：AI账号、AI内容、轻教程、代配置"
  );

  assert.match(prompt, /AI商机总编/);
  assert.match(prompt, /四象限/);
  assert.match(prompt, /左下角 = 别看/);
  assert.match(prompt, /左上角 = 知道就行/);
  assert.match(prompt, /右下角 = 可以试卖/);
  assert.match(prompt, /右上角 = 值得长期做/);
  assert.match(prompt, /优先“今天就能卖”的/);
  assert.match(prompt, /不写大段分析，不写长篇报告/);
  assert.match(prompt, /不要假装知道全网真实成交数据/);
  assert.match(prompt, /便宜 token、风险自负、多用户商业化/);
});

test("getSystemPromptAiOpportunity asks for the card-style markdown structure", () => {
  const prompt = getSystemPromptAiOpportunity("2026-03-24", "### 当前业务");

  assert.match(prompt, /# 今日AI商机/);
  assert.match(prompt, /## 先说结论/);
  assert.match(prompt, /## 今日主推/);
  assert.match(prompt, /## 本周可试/);
  assert.match(prompt, /## 今天别碰/);
  assert.match(prompt, /## 地图感/);
  assert.match(prompt, /## 今日动作/);
  assert.match(prompt, /最简单卖法/);
  assert.match(prompt, /今天先做哪一步/);
  assert.match(prompt, /今天就能发的文案/);
  assert.match(prompt, /配图建议/);
  assert.match(prompt, /先怎么试/);
});
