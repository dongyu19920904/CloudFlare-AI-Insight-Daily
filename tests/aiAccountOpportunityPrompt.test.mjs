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
