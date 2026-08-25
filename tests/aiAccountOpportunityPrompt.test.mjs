import test from "node:test";
import assert from "node:assert/strict";

import { getSystemPromptAiAccountOpportunity } from "../src/prompt/aiAccountOpportunityPrompt.js";

test("account opportunity prompt separates official facts from low-risk actions", () => {
  const prompt = getSystemPromptAiAccountOpportunity("2026-08-05", "### 当前业务");

  assert.match(prompt, /价格、额度、地区、支付、登录、服务状态和平台政策必须引用官方页面/);
  assert.match(prompt, /不能把普通模型新闻直接说成账号涨价、降额或封号/);
  assert.match(prompt, /低风险教程、选型说明、标题测试和 FAQ 动作/);
  assert.match(prompt, /每日只保留 1-2 个最有用的行动/);
});

test("account opportunity prompt serves sellers and ordinary buyers", () => {
  const prompt = getSystemPromptAiAccountOpportunity("2026-08-05", "### 当前业务");

  assert.match(prompt, /经营海外 AI 账号、订阅、API 和开发工具的中文卖家/);
  assert.match(prompt, /准备购买海外 AI 工具的普通买家/);
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

test("account opportunity prompt is limited to overseas AI products", () => {
  const prompt = getSystemPromptAiAccountOpportunity("2026-08-08", "### 当前业务");

  assert.match(prompt, /只处理海外 AI 产品/);
  assert.match(prompt, /OpenAI \/ ChatGPT、Anthropic \/ Claude/);
  assert.match(prompt, /DeepSeek、豆包、Kimi、MiniMax、通义/);
  assert.match(prompt, /不写成主推、观察、上新、FAQ 动作或「今天别碰」/);
  assert.match(prompt, /不能用国内产品调价或发布，反推海外账号有商机/);
});

test("account opportunity prompt publishes safe observation days without forcing a listing", () => {
  const prompt = getSystemPromptAiAccountOpportunity("2026-08-08", "### 当前业务");

  assert.match(prompt, /观察模式下/);
  assert.match(prompt, /今天没有取得可由官方页面确认的海外 AI 账号、价格、额度或政策新变化/);
  assert.match(prompt, /不新增商品/);
  assert.match(prompt, /不得新增商品、上架或承诺变化已经生效/);
});
