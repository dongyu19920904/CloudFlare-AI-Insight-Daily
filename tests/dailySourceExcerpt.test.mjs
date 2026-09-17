import test from 'node:test';
import assert from 'node:assert/strict';
import { excerptDailyNewsEvidence, getDailySourceProvenanceHint } from '../src/dailySourceExcerpt.js';

test('a bounded news excerpt keeps the baseline and adapter behind a headline score', () => {
  const source = `模型在半私有测试集上达到 99.9%。${'背景说明。'.repeat(100)}标准框架得到 62.7%。接入 Provider Adapter 后，同一模型才达到 99.9%。`;
  const excerpt = excerptDailyNewsEvidence(source);
  assert.ok(excerpt.length <= 500);
  assert.match(excerpt, /半私有测试集上达到 99\.9%/);
  assert.match(excerpt, /标准框架得到 62\.7%/);
  assert.match(excerpt, /Provider Adapter 后/);
});

test('ordinary short news stays intact and relay sources receive a provenance hint', () => {
  assert.equal(excerptDailyNewsEvidence('模型更新了价格。'), '模型更新了价格。');
  assert.match(getDailySourceProvenanceHint('AI 探索频道 - Telegram Channel', 'https://t.me/example/123'), /只能称频道转述/);
  assert.equal(getDailySourceProvenanceHint('Google', 'https://blog.google/example'), '');
});
