import test from "node:test";
import assert from "node:assert/strict";

import { getSystemPromptAiOpportunity } from "../src/prompt/aiOpportunityPrompt.js";

test("getSystemPromptAiOpportunity focuses on zero-manual sellable output", () => {
  const prompt = getSystemPromptAiOpportunity(
    "2026-03-22",
    "### 当前业务\n- 核心业务: AI账号、AI内容"
  );

  assert.match(prompt, /中文新手用户/);
  assert.match(prompt, /不要假装知道闲鱼实时销量、成交量、主流售价/);
  assert.match(prompt, /不要把官方定价直接当成卖价/);
  assert.match(prompt, /账号类/);
  assert.match(prompt, /轻服务类/);
  assert.match(prompt, /插件\/SDK\/模板\/工作流\/接入\/开源发布/);
  assert.match(prompt, /围观、吐槽、求 token、情绪讨论/);
  assert.match(prompt, /账号类或账号搭售机会/);
  assert.match(prompt, /不要让纯教程包或纯服务类占满/);
  assert.match(prompt, /便宜 token、风险自负、多用户商业化/);
  assert.match(prompt, /不要输出“我不能讨论”/);
  assert.match(prompt, /如果证据不够强，也要输出保守版成稿/);
  assert.match(prompt, /每个机会都先写成“今天就能发的商品”/);
  assert.match(prompt, /少写“技术圈热闹”/);
  assert.match(prompt, /GitHub stars、安装量、SDK 名词/);
  assert.match(prompt, /先写买家今天卡在哪里/);
});

test("getSystemPromptAiOpportunity asks for the new practical markdown structure", () => {
  const prompt = getSystemPromptAiOpportunity("2026-03-22", "### 当前业务");

  assert.match(prompt, /Markdown/);
  assert.match(prompt, /## 今日AI商机/);
  assert.match(prompt, /## 今日可卖/);
  assert.match(prompt, /## 本周可试/);
  assert.match(prompt, /## 今日动作/);
  assert.match(prompt, /可直接发布的商品标题/);
  assert.match(prompt, /更适合单卖还是搭售/);
  assert.match(prompt, /买家现在最在意什么/);
  assert.match(prompt, /你实际交付什么/);
  assert.match(prompt, /更适合发到哪里/);
  assert.match(prompt, /低价引流款/);
  assert.match(prompt, /标准成交款/);
  assert.match(prompt, /搭售利润款/);
  assert.match(prompt, /如果要试，先包装成什么商品/);
  assert.match(prompt, /今天就能发的 1 句话术/);
});
