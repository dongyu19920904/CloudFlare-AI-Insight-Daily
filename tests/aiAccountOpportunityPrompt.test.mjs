import test from "node:test";
import assert from "node:assert/strict";

import { getSystemPromptAiAccountOpportunity } from "../src/prompt/aiAccountOpportunityPrompt.js";

test("account opportunity prompt requires account-specific official signals", () => {
  const prompt = getSystemPromptAiAccountOpportunity("2026-08-05", "### 当前业务");

  assert.match(prompt, /价格、额度、地区、支付、登录、服务状态和平台政策必须引用官方页面/);
  assert.match(prompt, /不要把模型新闻硬拗成账号商机/);
  assert.match(prompt, /没有足够证据就写「观察」或「否」/);
  assert.match(prompt, /每日只保留 1-2 个强行动/);
});

test("account opportunity prompt serves sellers and ordinary buyers", () => {
  const prompt = getSystemPromptAiAccountOpportunity("2026-08-05", "### 当前业务");

  assert.match(prompt, /账号卖家和 AI 工具经营者/);
  assert.match(prompt, /普通买家/);
  assert.match(prompt, /今天发生什么/);
  assert.match(prompt, /今天做什么/);
  assert.match(prompt, /最大风险/);
  assert.match(prompt, /买家避坑/);
  assert.match(prompt, /不能承诺与停止/);
});

test("account opportunity prompt rejects unsafe or invented trading advice", () => {
  const prompt = getSystemPromptAiAccountOpportunity("2026-08-05", "### 当前业务");

  assert.match(prompt, /共享滥用、凭据转卖、盗号、黑卡、接码、绕过验证/);
  assert.match(prompt, /不得编造建议售价、闲鱼销量、搜索热度、利润率/);
  assert.match(prompt, /标题使用纯文本，不挂链接/);
  assert.match(prompt, /不得生成 aivora\.cn 或 news\.aivora\.cn 链接/);
  assert.match(prompt, /正文没有一级标题/);
});
