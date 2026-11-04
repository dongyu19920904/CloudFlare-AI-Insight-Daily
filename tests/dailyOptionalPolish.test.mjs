import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/handlers/scheduled.js', import.meta.url), 'utf8');
const start = source.indexOf('    if (!validation.ok || initialQualityTargetWarnings.length > 0) {');
const end = source.indexOf('    const funStatsBeforeStandaloneGeneration', start);
assert.ok(start > 0 && end > start);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const run = new AsyncFunction('validation', 'generateContentWithTransportFallback', `
  const initialQualityTargetWarnings = ['Daily writing has dense long sentences'];
  const debugInfo = {};
  const dailyBodyGenerationEnv = {};
  const outputOfCall2User = 'real sources';
  const outputOfCall2 = 'complete generated draft';
  const dateStr = '2026-11-04';
  const outputOfCall2System = 'editor';
  const buildDailyRepairPrompt = () => 'polish';
  const console = { warn() {} };
  ${source.slice(start, end)}
  return { validation, debugInfo, draft: outputOfCall2 };
`);

test('a polish connection reset cannot discard a complete draft that passed publication validation', async () => {
  const validation = { ok: true, issues: [], warnings: [] };
  const result = await run(validation, async () => { throw new TypeError('terminated'); });
  assert.equal(result.validation, validation);
  assert.equal(result.draft, 'complete generated draft');
  assert.equal(result.debugInfo.dailyRepairAdopted, false);
  assert.equal(result.debugInfo.dailyRepairError, 'terminated');
});

test('a failed repair never turns an invalid first draft into a publishable one', async () => {
  await assert.rejects(run({ ok: false, issues: ['Daily TOP reuses the same source URL'] },
    async () => { throw new TypeError('terminated'); }), /terminated/);
});
