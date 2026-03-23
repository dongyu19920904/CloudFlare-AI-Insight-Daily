import test from "node:test";
import assert from "node:assert/strict";

import { getSystemPromptAiOpportunity } from "../src/prompt/aiOpportunityPrompt.js";

test("getSystemPromptAiOpportunity focuses on low-barrier practical AI opportunities", () => {
  const prompt = getSystemPromptAiOpportunity("2026-03-22");

  assert.match(prompt, /低门槛|小白/);
  assert.match(prompt, /AI 工具|AI账号|账号/);
  assert.match(prompt, /风险|注意事项/);
  assert.match(prompt, /怎么低成本开始|低成本开始/);
  assert.match(prompt, /值得我亲自尝试|值不值得亲自试/);
});

test("getSystemPromptAiOpportunity asks for publishable markdown structure", () => {
  const prompt = getSystemPromptAiOpportunity("2026-03-22");

  assert.match(prompt, /Markdown/);
  assert.match(prompt, /## \*\*今日AI商机\*\*/);
  assert.match(prompt, /## \*\*可做的机会\*\*/);
  assert.match(prompt, /## \*\*行动建议\*\*/);
});
