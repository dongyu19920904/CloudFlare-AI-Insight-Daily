import test from "node:test";
import assert from "node:assert/strict";

import { getSystemPromptSummarizationStepOne } from "../src/prompt/summarizationPromptStepZero.js";

test("daily prompt keeps publisher diversity and factual TOP priority aligned", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-09-29");
  assert.match(prompt, /全篇同一发布者最多写 1 条/);
  assert.match(prompt, /转发日期不等于事件日期/);
  assert.match(prompt, /多件交易拼成一条的社媒汇总/);
  assert.match(prompt, /招募愿景和泛泛观点留给后面的栏目或丢弃/);
});
