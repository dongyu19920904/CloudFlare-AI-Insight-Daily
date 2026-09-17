import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeDailyOutputPresentation, ensureDailyTopHighlightDensity } from '../src/dailySectionSanitizer.js';
import { collectDailyWritingStyleWarnings } from '../src/dailyWritingQuality.js';
import { getDailyReadabilityRules } from '../src/dailyGenerationPromptInput.js';
import { getSystemPromptSummarizationStepOne } from '../src/prompt/summarizationPromptStepZero.js';

const page = body => `## **🔥 今日焦点 TOP 10**\n\n### 1. 比较测试中的尝试次数\n\n${body}`;

test('does not manufacture emphasis from verbs or split numeric ranges and units', () => {
  for (const fact of ['得分提高时，需要比较尝试次数。', '响应为 70 到 500 毫秒，费用相差 40 到 400 倍。', '总预算为 5578 亿元，延迟为 400 毫秒。']) {
    const input = page(`研究者记录了[两组测试条件](https://example.com/test)。${fact}`);
    assert.equal(ensureDailyTopHighlightDensity(input), input);
  }
  assert.equal(ensureDailyTopHighlightDensity(page('得分**提高时**，先核对条件。')), page('得分提高时，先核对条件。'));
});

test('keeps one paragraph, complete highlights, natural short links and original image URLs', () => {
  const body = '研究者对比了[两组测试条件](https://example.com/test)。实验仅覆盖 **同一版本**，响应为 **70 到 500 毫秒**。';
  const media = '![测试记录](https://example.com/source.png?size=900 "测试记录")';
  const input = page(body + '\n\n' + media);
  assert.equal(normalizeDailyOutputPresentation(input), input);
});

test('one or no highlight and two informative sentences do not request cosmetic repair', () => {
  for (const emphasis of ['', '**']) {
    const body = `研究者在${emphasis}同一版本${emphasis}下比较了[两组测试条件](https://example.com/test)，分别记录尝试次数和最终得分。实验只覆盖这批样本，尚未测试其他任务。`;
    const input = page(body) + '\n\n### 2. 第二项测试\n\n' + body.replace('/test)', '/test2)');
    assert.deepEqual(collectDailyWritingStyleWarnings(input), []);
  }
});

test('draft and repair share readability rules and omit conflicting numerical quotas', () => {
  const draft = getSystemPromptSummarizationStepOne('2026-09-17');
  const scheduled = readFileSync(new URL('../src/handlers/scheduled.js', import.meta.url), 'utf8');
  const repair = scheduled.slice(scheduled.indexOf('function buildDailyRepairPrompt('), scheduled.indexOf('function getDailyBodyGenerationEnv('));
  assert.ok(draft.includes(getDailyReadabilityRules()));
  assert.match(repair, /getDailyReadabilityRules\(\)/);
  for (const text of [draft, repair]) {
    assert.doesNotMatch(text, /18-32|不得超过 55|不超过 45|恰好保留 3|必须有 3 个短高亮|使用 3-5 个|写 4-5 个/);
  }
});
