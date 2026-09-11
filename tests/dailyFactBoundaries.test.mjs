import test from 'node:test';
import assert from 'node:assert/strict';
import { getSystemPromptSummarizationStepOne } from '../src/prompt/summarizationPromptStepZero.js';
import { getSystemPromptSummarizationStepThree } from '../src/prompt/summarizationPromptStepThree.js';
import { buildStandaloneDailyFunPromptInput } from '../src/dailyFunSection.js';

test('daily prompt preserves source entities, numerical basis and deal evidence', () => {
  const prompt = getSystemPromptSummarizationStepOne('2026-09-11');
  assert.match(prompt, /不能把 Codex\/ChatGPT 改写为 Cursor/);
  assert.match(prompt, /不能把性能提升 50% 写成成本降低 50%/);
  assert.match(prompt, /收购、融资金额.*一手披露时省略金额/);
  assert.match(prompt, /转载日期不等于事件日期/);
  assert.match(prompt, /FAQ 不得从演示视频推断免费\/付费功能分层/);
});

test('daily prompt does not impersonate source authors or repeat quota bypass tips', () => {
  const prompt = getSystemPromptSummarizationStepOne();
  assert.match(prompt, /有归属的第三人称/);
  assert.match(prompt, /不能把评论编成已发生的事件/);
  assert.match(prompt, /不得推荐清 Cookie、换浏览器、多账号等规避免费额度/);
});

test('three-sentence summary preserves products, metrics and uncertain deal status', () => {
  const prompt = getSystemPromptSummarizationStepThree();
  assert.match(prompt, /产品和人物归属不得互换/);
  assert.match(prompt, /不能新增“低一半”等推算结论/);
  assert.match(prompt, /来源或交易状态未确认的收购金额不要进入摘要/);
});

test('independent fun generation keeps the same attribution and evidence boundary', () => {
  const prompt = buildStandaloneDailyFunPromptInput('2026-09-11', ['A developer tested an AI tool: https://example.org/test']);
  assert.match(prompt, /有归属的第三人称/);
  assert.match(prompt, /普通偏好榜不能照搬成稿/);
  assert.match(prompt, /未经确认的最终成果/);
});
