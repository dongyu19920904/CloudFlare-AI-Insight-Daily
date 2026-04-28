import test from "node:test";
import assert from "node:assert/strict";

import { getSystemPromptAiAccountOpportunity } from "../src/prompt/aiAccountOpportunityPrompt.js";

test("getSystemPromptAiAccountOpportunity keeps account signals central", () => {
  const prompt = getSystemPromptAiAccountOpportunity("2026-04-07", "### 当前业务");

  assert.match(prompt, /账号卖家今天该盯什么、该挂什么、该避开什么/);
  assert.match(prompt, /封号|风控|登录限制|支付失败/);
  assert.match(prompt, /平替机会/);
  assert.match(prompt, /闲鱼新品/);
});

test("getSystemPromptAiAccountOpportunity asks for varied sellable modes beyond raw accounts", () => {
  const prompt = getSystemPromptAiAccountOpportunity("2026-04-07", "### 当前业务");

  assert.match(prompt, /不要天天只写原账号体验号/);
  assert.match(prompt, /迁移包|组合体验|镜像筛选服务|标题实验/);
  assert.match(prompt, /至少覆盖两种不同卖法模式/);
  assert.match(prompt, /今晚就能先试挂|先改标题|先发一版商品/);
});

test("getSystemPromptAiAccountOpportunity asks for diverse 24h signals and open-source alternatives", () => {
  const prompt = getSystemPromptAiAccountOpportunity("2026-04-07", "### 当前业务");

  assert.match(prompt, /最近 24 小时/);
  assert.match(prompt, /同一家公司、同一产品线、同一核心人物/);
  assert.match(prompt, /GPT Image、ChatGPT、Sam Altman/);
  assert.match(prompt, /开源平替、部署包、跑通包或筛选服务/);
  assert.match(prompt, /不要让今日主推、平替机会、闲鱼新品都围着 OpenAI\/GPT 转/);
  assert.match(prompt, /如果主推已经写 Gemini 或 Claude/);
  assert.match(prompt, /不要让 Claude、Gemini、OpenAI\/GPT 任何一个品牌在全文形成刷屏感/);
});
