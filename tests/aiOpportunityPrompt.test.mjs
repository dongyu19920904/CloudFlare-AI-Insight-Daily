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
  assert.match(prompt, /不要假装知道全网真实成交数据/);
  assert.match(prompt, /便宜 token、风险自负、多用户商业化/);
});

test("getSystemPromptAiOpportunity reuses the daily writing kernel instead of only naming a style", () => {
  const prompt = getSystemPromptAiOpportunity("2026-03-24", "### 当前业务");

  assert.match(prompt, /共享写作内核/);
  assert.match(prompt, /说人话/);
  assert.match(prompt, /先给结果，再补原因/);
  assert.match(prompt, /先给画面，再补概念/);
  assert.match(prompt, /像朋友聊天，不像系统填表/);
  assert.match(prompt, /展示，而不是解释/);
  assert.match(prompt, /标题要有钩子/);
  assert.match(prompt, /可以单独截图转发/);
  assert.match(prompt, /像朋友圈转发导语/);
});

test("getSystemPromptAiOpportunity asks for a hooky and memorable card-style markdown structure", () => {
  const prompt = getSystemPromptAiOpportunity("2026-03-24", "### 当前业务");

  assert.match(prompt, /# 今日AI商机/);
  assert.match(prompt, /## 先说结论/);
  assert.match(prompt, /## 今日主推/);
  assert.match(prompt, /## 本周可试/);
  assert.match(prompt, /## 今天别碰/);
  assert.match(prompt, /## 地图感/);
  assert.match(prompt, /## 今日动作/);
  assert.match(prompt, /这钱从哪来/);
  assert.match(prompt, /今天先做哪一步/);
  assert.match(prompt, /今天就能发的文案/);
  assert.match(prompt, /配图建议/);
  assert.match(prompt, /句子要短，有记忆点/);
  assert.match(prompt, /先说结论要像一条会被转发的导语/);
  assert.match(prompt, /第一句要像朋友圈写发圈时的开场/);
  assert.match(prompt, /让小白看完后有“我也能试一下”的冲动/);
  assert.doesNotMatch(prompt, /为什么今天能卖：/);
  assert.doesNotMatch(prompt, /参考卖法：/);
});
