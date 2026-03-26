import test from "node:test";
import assert from "node:assert/strict";

import { getSystemPromptSummarizationStepOne } from "../src/prompt/summarizationPromptStepZero.js";

test("AI趣闻 prompt asks for people-first, lightly humorous observation instead of comment搬运", () => {
  const prompt = getSystemPromptSummarizationStepOne("2026-03-26");

  assert.match(prompt, /先写人，再写新闻/);
  assert.match(prompt, /第一人称自嘲/);
  assert.match(prompt, /小场景或小尴尬起手/);
  assert.match(prompt, /轻轻收口/);
  assert.match(prompt, /把读者逗松一点/);
  assert.match(prompt, /生活感/);
  assert.match(prompt, /非技术读者也能看懂/);
  assert.match(prompt, /不要把技术圈黑话当笑点/);
  assert.match(prompt, /不要把圈内怨气写成幽默/);
  assert.match(prompt, /不要把网友评论当正文主体/);
  assert.match(prompt, /如果素材里有 `\[图片: \.\.\.\]`，\*\*必须\*\*放在该条末尾/);
  assert.match(prompt, /不要写成吐槽贴/);
  assert.match(prompt, /不要模仿任何特定演员/);
});
